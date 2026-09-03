"use client";

import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import { handleClipboardFilePaste } from "@/lib/clipboardFiles";
import {
  createCompatibleAudioRecorder,
  createRecordedAudioFile,
  getMediaKind,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  validateMediaFile,
} from "@/lib/mediaFiles";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import type { TrackerPlan } from "@/lib/trackerPlanDomain";
import { ChevronRight, FileText, MessageCircle, Mic, Paperclip, Square, X } from "lucide-react";
import Image from "next/image";
import { type ClipboardEvent, useEffect, useRef, useState } from "react";

export type TrackerComment = {
  id: string;
  plan_id: string;
  couple_id: string;
  user_id: string;
  text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: "image" | "video" | "audio" | "file" | null;
  mime_type: string | null;
  created_at: string;
  attachment_signed_url?: string | null;
};

type TrackerLabDiscussionProps = {
  plan: TrackerPlan;
  couple: { id: string; partner_one_id: string; partner_two_id: string | null };
  currentUserId: string;
  comments: TrackerComment[];
  getPersonMeta: (id: string | null) => { name: string; avatar: string | null; initial: string };
  onReload: () => void;
  onMessage: (message: string) => void;
};

type RecordingPhase = "idle" | "requesting" | "recording" | "stopping";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function validateAttachment(file: File) {
  const kind = getMediaKind(file);
  const maximum = kind === "audio" ? MAX_AUDIO_SIZE : kind === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  return validateMediaFile(file, ["image", "video", "audio", "file"], maximum).error;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// The parent keys this component by plan.id. Closing the sheet unmounts the
// recorder and discards drafts instead of carrying private content into a new plan.
export default function TrackerLabDiscussion({
  plan, couple, currentUserId, comments, getPersonMeta, onReload, onMessage,
}: TrackerLabDiscussionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const recordingRequestRef = useRef(0);
  const recordingPendingRef = useRef(false);
  const sendingRef = useRef(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingRequestRef.current += 1;
      const recorder = recorderRef.current;
      if (recorder) {
        // Never create a file or update state after the discussion is hidden.
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") {
          try { recorder.stop(); } catch { /* Tracks are stopped below regardless. */ }
        }
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      streamRef.current = null;
    };
  }, []);

  function report(message: string) {
    if (mountedRef.current) setFeedback(message);
    onMessage(message);
  }

  function selectFile(files: File[]) {
    if (sendingRef.current || recordingPendingRef.current) return;
    const next = files[0];
    if (!next) return;
    const validation = validateAttachment(next);
    if (validation) {
      report(validation);
      return;
    }
    setFeedback("");
    setFile(next);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    handleClipboardFilePaste(event, selectFile);
  }

  async function toggleRecording() {
    if (sendingRef.current) return;
    const activeRecorder = recorderRef.current;
    if (activeRecorder?.state === "recording") {
      setRecordingPhase("stopping");
      activeRecorder.stop();
      return;
    }
    if (recordingPendingRef.current) return;
    recordingPendingRef.current = true;
    const request = ++recordingRequestRef.current;
    setRecordingPhase("requesting");
    setFeedback("");
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Запись голоса не поддерживается этим браузером.");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || request !== recordingRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = createCompatibleAudioRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      let recordedBytes = 0;
      recorder.ondataavailable = (event) => {
        if (!mountedRef.current || request !== recordingRequestRef.current) return;
        if (event.data.size) {
          chunks.push(event.data);
          recordedBytes += event.data.size;
          if (recordedBytes > MAX_AUDIO_SIZE && recorder.state === "recording") {
            setRecordingPhase("stopping");
            recorder.stop();
          }
        }
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        streamRef.current = null;
        recordingPendingRef.current = false;
        if (mountedRef.current && request === recordingRequestRef.current) {
          setRecordingPhase("idle");
          report("Запись прервалась. Попробуйте ещё раз или прикрепите аудиофайл.");
        }
      };
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        streamRef.current = null;
        recordingPendingRef.current = false;
        if (!mountedRef.current || request !== recordingRequestRef.current) return;
        setRecordingPhase("idle");
        try {
          const recording = createRecordedAudioFile(chunks, recorder.mimeType, "tracker-voice");
          const validation = validateAttachment(recording);
          if (validation) report(validation);
          else setFile(recording);
        } catch (error) {
          report(errorMessage(error, "Не удалось сохранить голосовую запись"));
        }
      };
      // Periodic chunks bound memory use and allow the upload limit to stop recording.
      recorder.start(1000);
      setRecordingPhase("recording");
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      recordingPendingRef.current = false;
      if (mountedRef.current && request === recordingRequestRef.current) {
        setRecordingPhase("idle");
        report(errorMessage(error, "Разрешите доступ к микрофону или прикрепите готовый аудиофайл."));
      }
    }
  }

  async function addComment() {
    if (sendingRef.current || recordingPendingRef.current || (!text.trim() && !file)) return;
    const draftText = text.trim();
    const draftFile = file;
    if (draftFile) {
      const validation = validateAttachment(draftFile);
      if (validation) { report(validation); return; }
    }
    sendingRef.current = true;
    setIsSending(true);
    setFeedback("");
    const commentId = crypto.randomUUID();
    let storagePath: string | null = null;
    let commentInsertStarted = false;
    let committed = false;
    try {
      const attachmentType = draftFile ? getMediaKind(draftFile) : null;
      if (draftFile) {
        const safeName = draftFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-180) || "attachment";
        storagePath = `${couple.id}/${plan.id}/${currentUserId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("tracker-media").upload(storagePath, draftFile);
        if (error) throw error;
      }
      commentInsertStarted = true;
      const { error: commentError } = await supabase.from("tracker_plan_comments").insert({
        id: commentId,
        plan_id: plan.id,
        couple_id: couple.id,
        user_id: currentUserId,
        text: draftText || null,
        attachment_url: storagePath,
        attachment_name: draftFile?.name || null,
        attachment_type: attachmentType,
        mime_type: draftFile?.type || null,
      });
      if (commentError) throw commentError;
      if (storagePath && draftFile && attachmentType) {
        const { error } = await supabase.from("tracker_plan_attachments").insert({
          plan_id: plan.id,
          comment_id: commentId,
          couple_id: couple.id,
          owner_id: currentUserId,
          storage_path: storagePath,
          url: storagePath,
          name: draftFile.name,
          mime_type: draftFile.type || null,
          media_type: attachmentType,
          size_bytes: draftFile.size,
        });
        if (error) throw error;
      }
      // Notifications and the activity feed are best-effort side effects, never
      // a reason to remove an already committed comment or its private media.
      committed = true;
      if (mountedRef.current) {
        setText("");
        setFile(null);
      }
      onReload();
    } catch (error) {
      if (committed) {
        report("Комментарий сохранён. Обновите обсуждение, если он пока не появился.");
      } else {
        let mayRemoveUpload = !commentInsertStarted;
        if (commentInsertStarted) {
          try {
            const { data: removedComments, error: rollbackError } = await supabase.from("tracker_plan_comments")
              .delete().eq("id", commentId).eq("plan_id", plan.id)
              .eq("couple_id", couple.id).eq("user_id", currentUserId).select("id");
            // A successful zero-row DELETE can mean RLS hid the comment. Keep
            // its media unless this attempt's exact row was proved deleted.
            mayRemoveUpload = !rollbackError && Boolean(removedComments?.some((row) => row.id === commentId));
          } catch {
            mayRemoveUpload = false;
          }
        }
        if (storagePath && mayRemoveUpload) {
          // Only this attempt's freshly generated path is eligible for cleanup.
          await supabase.storage.from("tracker-media").remove([storagePath]).catch(() => undefined);
        }
        if (!mayRemoveUpload) {
          if (mountedRef.current) { setText(""); setFile(null); }
          onReload();
          report("Комментарий мог сохраниться частично. Проверьте обсуждение перед повторной отправкой; вложение не удалено.");
        } else {
          report(`Не удалось добавить комментарий: ${errorMessage(error, "попробуйте снова")}`);
        }
      }
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setIsSending(false);
    }
    if (!committed) return;
    await Promise.allSettled([
      supabase.from("tracker_plan_activity").insert({
        plan_id: plan.id,
        couple_id: couple.id,
        actor_id: currentUserId,
        activity_type: "commented",
      }),
      ...(plan.visibility === "couple" ? [createPartnerNotification(couple, currentUserId, {
        type: "tracker_plan_comment",
        title: "Комментарий к плану",
        body: plan.title,
        href: "/tracker/lab",
      })] : []),
    ]);
  }

  const isRecording = recordingPhase === "recording";
  const recordingBusy = recordingPhase !== "idle";
  return (
    <section className="tracker-lab-comments">
      <div className="tracker-lab-section-heading"><div><span>{plan.visibility === "private" ? "Только вам" : "Вместе"}</span><h3>Обсуждение</h3></div><MessageCircle /></div>
      <div className="tracker-lab-comment-list">
        {comments.map((comment) => {
          const person = getPersonMeta(comment.user_id);
          return (
            <article key={comment.id}>
              <span className="tracker-lab-avatar">{person.avatar ? <Image src={person.avatar} alt="" width={32} height={32} unoptimized /> : person.initial}</span>
              <div><strong>{person.name}</strong>{comment.text && <p>{comment.text}</p>}
                {comment.attachment_signed_url && comment.attachment_type === "image" && <Image src={comment.attachment_signed_url} alt={comment.attachment_name || "Фото"} width={620} height={420} unoptimized />}
                {comment.attachment_signed_url && comment.attachment_type === "video" && <video src={comment.attachment_signed_url} controls playsInline />}
                {comment.attachment_signed_url && comment.attachment_type === "audio" && <AccentAudioPlayer src={comment.attachment_signed_url} accent="#d97706" label={comment.attachment_name || "Голосовая запись"} />}
                {comment.attachment_signed_url && comment.attachment_type === "file" && <a href={comment.attachment_signed_url} target="_blank" rel="noreferrer"><FileText />{comment.attachment_name || "Файл"}</a>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="tracker-lab-comment-composer" aria-busy={isSending}>
        <input ref={fileInputRef} type="file" className="sr-only" disabled={isSending || recordingBusy} onChange={(event) => { selectFile(Array.from(event.target.files || [])); event.target.value = ""; }} />
        <textarea value={text} disabled={isSending} onChange={(event) => setText(event.target.value)} onPaste={handlePaste} aria-label="Комментарий к событию" placeholder="Напишите или вставьте файл через Ctrl+V…" rows={2} />
        {file && <span className="tracker-lab-pending-file"><Paperclip />{file.name}<button type="button" disabled={isSending || recordingBusy} onClick={() => setFile(null)} aria-label="Убрать вложение"><X /></button></span>}
        <div>
          <button type="button" disabled={isSending || recordingBusy} onClick={() => fileInputRef.current?.click()} aria-label="Прикрепить файл"><Paperclip /></button>
          <button type="button" disabled={isSending || recordingPhase === "requesting" || recordingPhase === "stopping"} className={isRecording ? "is-recording" : ""} onClick={() => void toggleRecording()} aria-label={isRecording ? "Остановить запись" : "Записать голос"}>{isRecording ? <Square /> : <Mic />}</button>
          <button type="button" className="is-send" onClick={() => void addComment()} disabled={isSending || recordingBusy || (!text.trim() && !file)} aria-label="Отправить комментарий"><ChevronRight /></button>
        </div>
        {(feedback || recordingBusy) && <p role="status" aria-live="polite">{feedback || (recordingPhase === "requesting" ? "Ожидаем разрешение на микрофон…" : recordingPhase === "stopping" ? "Сохраняем запись…" : "Идёт запись. Нажмите квадрат, чтобы закончить.")}</p>}
      </div>
    </section>
  );
}
