"use client";

import EmojiPicker from "@/components/EmojiPicker";
import { compressImageFile } from "@/lib/imageCompression";
import {
  createCompatibleAudioRecorder,
  createRecordedAudioFile,
  getMediaKind,
  getSafeStoragePath,
  MAX_AUDIO_SIZE,
} from "@/lib/mediaFiles";
import { createPartnerNotification } from "@/lib/notifications";
import { quickReactionEmojis } from "@/lib/emojis";
import { supabase } from "@/lib/supabaseClient";
import { authorizedFetch } from "@/lib/authorizedFetch";
import { toBrowserSupabaseUrl, toPortableSupabaseUrl } from "@/lib/supabaseUrls";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  ImageIcon,
  List,
  Maximize2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Music2,
  Paperclip,
  Pause,
  Pin,
  Play,
  Send,
  Smile,
  Square,
  Star,
  Sticker,
  X,
} from "lucide-react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

type ChatReaction = {
  emoji: string;
  user_id: string;
};

type ChatAttachment = {
  id: string;
  url: string;
  type: "image" | "video" | "audio" | "file" | "sticker";
  name: string;
  size: number;
  mime_type: string;
};

type PendingAttachment = {
  id: string;
  file: File;
  type: ChatAttachment["type"];
  previewUrl: string | null;
};

type LinkPreviewData = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  domain: string;
};

type ProfileTab = "media" | "files" | "links" | "voices" | "gifs";

type ProfileAttachmentItem = {
  id: string;
  messageId: string;
  createdAt: string;
  attachment?: ChatAttachment;
  url?: string;
  body?: string | null;
};

type StickerPack = {
  id: string;
  name: string;
  icon: string;
  stickers: {
    id: string;
    name: string;
    emoji: string;
    url: string;
  }[];
};

type ChatMessage = {
  id: string;
  couple_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
  reply_to_id: string | null;
  reactions: ChatReaction[] | null;
  attachment_url: string | null;
  attachment_type: "image" | "audio" | null;
  attachment_name: string | null;
  attachments: ChatAttachment[] | null;
  pinned_at: string | null;
  deleted_for: string[] | null;
  deleted_for_everyone: boolean | null;
};

const chatSelect =
  "id, couple_id, sender_id, body, created_at, edited_at, read_at, reply_to_id, reactions, attachment_url, attachment_type, attachment_name, attachments, pinned_at, deleted_for, deleted_for_everyone";
const draftStoragePrefix = "couple-space:chat-draft:";
const recentStickerStorageKey = "couple-space:chat-recent-stickers";
const favoriteStickerStorageKey = "couple-space:chat-favorite-stickers";
const externalChatDraftKey = "couple-space:chat-draft";
const reactions = quickReactionEmojis;
const CHAT_PAGE_SIZE = 80;
const maxMediaSize = 25 * 1024 * 1024;
const maxFileSize = 50 * 1024 * 1024;

function notoStickerUrl(code: string) {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.webp`;
}

const stickerPacks: StickerPack[] = [
  {
    id: "love",
    name: "Love",
    icon: "💘",
    stickers: [
      { id: "love-1", name: "Влюбленность", emoji: "🥰", url: notoStickerUrl("1f970") },
      { id: "love-2", name: "Сердца в глазах", emoji: "😍", url: notoStickerUrl("1f60d") },
      { id: "love-3", name: "Поцелуй", emoji: "😘", url: notoStickerUrl("1f618") },
      { id: "love-4", name: "Сердце", emoji: "💖", url: notoStickerUrl("1f496") },
      { id: "love-5", name: "Письмо", emoji: "💌", url: notoStickerUrl("1f48c") },
      { id: "love-6", name: "Два сердца", emoji: "💕", url: notoStickerUrl("1f495") },
    ],
  },
  {
    id: "mood",
    name: "Mood",
    icon: "🥳",
    stickers: [
      { id: "mood-1", name: "Смех", emoji: "😂", url: notoStickerUrl("1f602") },
      { id: "mood-2", name: "Вечеринка", emoji: "🥳", url: notoStickerUrl("1f973") },
      { id: "mood-3", name: "Круто", emoji: "😎", url: notoStickerUrl("1f60e") },
      { id: "mood-4", name: "Ого", emoji: "😮", url: notoStickerUrl("1f62e") },
      { id: "mood-5", name: "Сон", emoji: "😴", url: notoStickerUrl("1f634") },
      { id: "mood-6", name: "Плач", emoji: "😭", url: notoStickerUrl("1f62d") },
    ],
  },
  {
    id: "cute",
    name: "Cute",
    icon: "🧸",
    stickers: [
      { id: "cute-1", name: "Просьба", emoji: "🥺", url: notoStickerUrl("1f97a") },
      { id: "cute-2", name: "Обнимашки", emoji: "🤗", url: notoStickerUrl("1f917") },
      { id: "cute-3", name: "Кот", emoji: "🐱", url: notoStickerUrl("1f431") },
      { id: "cute-4", name: "Пёс", emoji: "🐶", url: notoStickerUrl("1f436") },
      { id: "cute-5", name: "Единорог", emoji: "🦄", url: notoStickerUrl("1f984") },
      { id: "cute-6", name: "Подарок", emoji: "🎁", url: notoStickerUrl("1f381") },
    ],
  },
];

const allStickers = stickerPacks.flatMap((pack) => pack.stickers.map((sticker) => ({ ...sticker, packId: pack.id })));

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "♡";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(fileName: string, mimeType?: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (mimeType?.includes("pdf") || extension === "pdf") return "PDF";
  if (["doc", "docx"].includes(extension || "")) return "DOC";
  if (["zip", "rar", "7z"].includes(extension || "")) return "ZIP";
  if (["xls", "xlsx", "csv"].includes(extension || "")) return "XLS";
  if (["ppt", "pptx"].includes(extension || "")) return "PPT";
  return "FILE";
}

function extractFirstUrl(text: string) {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] || null;
}

function getMessageAttachments(message: ChatMessage): ChatAttachment[] {
  if (message.attachments?.length) {
    return message.attachments.map((attachment) => ({
      ...attachment,
      url: toBrowserSupabaseUrl(attachment.url) || attachment.url,
    }));
  }
  if (!message.attachment_url || !message.attachment_type) return [];

  return [
    {
      id: message.id,
      url: toBrowserSupabaseUrl(message.attachment_url) || message.attachment_url,
      type: message.attachment_type === "audio" ? "audio" : "image",
      name: message.attachment_name || "Вложение",
      size: 0,
      mime_type: message.attachment_type === "audio" ? "audio/webm" : "image/*",
    },
  ];
}

function isGifAttachment(attachment: ChatAttachment) {
  return (
    attachment.type === "image" &&
    (attachment.mime_type.toLowerCase().includes("gif") ||
      attachment.name.toLowerCase().endsWith(".gif"))
  );
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

function readStoredStringList(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function isSingleEmojiText(text?: string | null) {
  const value = text?.trim();
  if (!value) return false;
  return /^\p{Extended_Pictographic}\uFE0F?$/u.test(value);
}

function isMessageVisible(message: ChatMessage, currentUserId: string | null) {
  if (!currentUserId) return false;
  if (message.deleted_for_everyone) return true;
  return !(message.deleted_for || []).includes(currentUserId);
}

function LinkPreviewCard({
  url,
  isMine,
}: {
  url: string;
  isMine: boolean;
}) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadPreview() {
      setIsLoadingPreview(true);
      try {
        const response = await authorizedFetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
        );
        const data = (await response.json()) as LinkPreviewData;
        if (!ignore) setPreview(data);
      } catch {
        if (!ignore) {
          setPreview({
            url,
            title: url,
            description: "",
            image: null,
            domain: new URL(url).hostname.replace(/^www\./, ""),
          });
        }
      } finally {
        if (!ignore) setIsLoadingPreview(false);
      }
    }

    loadPreview();

    return () => {
      ignore = true;
    };
  }, [url]);

  if (isLoadingPreview) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl bg-white/12 p-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/25" />
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-white/15" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className={`mt-2 block overflow-hidden rounded-xl border-l-4 text-left shadow-inner transition hover:scale-[1.01] ${
        isMine
          ? "border-white/70 bg-white/14"
          : "border-sky-400 bg-white/8"
      }`}
    >
      {preview.image && (
        <div
          className="h-36 w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${preview.image}")` }}
          aria-label={preview.title}
        />
      )}
      <div className="p-2">
        <p className="truncate text-[11px] font-black uppercase opacity-50">
          {preview.domain}
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-black">{preview.title}</p>
        {preview.description && (
          <p className="mt-1 line-clamp-2 text-xs font-semibold opacity-60">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const appliedCursorRequestRef = useRef<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<number | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const partnerTypingTimeoutRef = useRef<number | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);
  const prependScrollRef = useRef<{ height: number; top: number } | null>(null);
  const scrollFrameRef = useRef<number | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"emoji" | "stickers" | null>(null);
  const [stickerSearch, setStickerSearch] = useState("");
  const [activeStickerPack, setActiveStickerPack] = useState(stickerPacks[0]?.id || "love");
  const [recentStickerIds, setRecentStickerIds] = useState<string[]>(() => readStoredStringList(recentStickerStorageKey));
  const [favoriteStickerIds, setFavoriteStickerIds] = useState<string[]>(() => readStoredStringList(favoriteStickerStorageKey));
  const [draftSelection, setDraftSelection] = useState({ start: 0, end: 0 });
  const [nextCursorPosition, setNextCursorPosition] = useState<{ position: number; requestId: string } | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [stickerPreview, setStickerPreview] = useState<ChatAttachment | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>("media");
  const [profileTabLimit, setProfileTabLimit] = useState(24);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);
  const [isPinnedListOpen, setIsPinnedListOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const partnerId = useMemo(() => {
    if (!couple || !currentUserId) return null;
    return currentUserId === couple.partner_one_id
      ? couple.partner_two_id
      : couple.partner_one_id;
  }, [couple, currentUserId]);

  const partnerProfile = useMemo(() => {
    if (!couple || !currentUserId || !profile) {
      return { name: "Партнёр", avatar: null as string | null };
    }

    const isPartnerOne = currentUserId === couple.partner_one_id;
    return {
      name: isPartnerOne ? profile.partner_two || "Партнёр" : profile.partner_one || "Партнёр",
      avatar: isPartnerOne
        ? profile.avatar_two || profile.avatar || null
        : profile.avatar_one || profile.avatar || null,
    };
  }, [couple, currentUserId, profile]);

  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter((message) => {
      if (!isMessageVisible(message, currentUserId)) return false;
      if (!query) return true;
      return (
        message.body?.toLowerCase().includes(query) ||
        message.attachment_name?.toLowerCase().includes(query)
      );
    });
  }, [currentUserId, messages, search]);

  useEffect(() => {
    queueMicrotask(() => {
      const externalDraft = localStorage.getItem(externalChatDraftKey);
      if (!externalDraft) return;
      setDraft(externalDraft);
      localStorage.removeItem(externalChatDraftKey);
    });
  }, []);

  const pinnedMessages = useMemo(
    () =>
      visibleMessages
        .filter((message) => message.pinned_at && !message.deleted_for_everyone)
        .sort(
          (a, b) =>
            new Date(b.pinned_at || b.created_at).getTime() -
            new Date(a.pinned_at || a.created_at).getTime()
        ),
    [visibleMessages]
  );
  const safePinnedIndex =
    pinnedMessages.length === 0
      ? 0
      : Math.min(activePinnedIndex, pinnedMessages.length - 1);
  const activePinnedMessage = pinnedMessages[safePinnedIndex] || null;

  const unreadCount = useMemo(
    () =>
      visibleMessages.filter(
        (message) => message.sender_id !== currentUserId && !message.read_at
      ).length,
    [currentUserId, visibleMessages]
  );

  const replyMessage = replyToId
    ? messages.find((message) => message.id === replyToId) || null
    : null;
  const editingMessage = editingId
    ? messages.find((message) => message.id === editingId) || null
    : null;
  const menuMessage = menuMessageId
    ? messages.find((message) => message.id === menuMessageId) || null
    : null;
  const profileItems = useMemo(() => {
    const media: ProfileAttachmentItem[] = [];
    const files: ProfileAttachmentItem[] = [];
    const voices: ProfileAttachmentItem[] = [];
    const gifs: ProfileAttachmentItem[] = [];
    const links: ProfileAttachmentItem[] = [];

    visibleMessages.forEach((message) => {
      getMessageAttachments(message).forEach((attachment) => {
        const item = {
          id: `${message.id}:${attachment.id}`,
          messageId: message.id,
          createdAt: message.created_at,
          attachment,
        };

        if (attachment.type === "audio") voices.push(item);
        if (attachment.type === "file") files.push(item);
        if (attachment.type === "image" || attachment.type === "video") {
          if (isGifAttachment(attachment)) gifs.push(item);
          else media.push(item);
        }
      });

      const url = extractFirstUrl(message.body || "");
      if (url) {
        links.push({
          id: `${message.id}:link`,
          messageId: message.id,
          createdAt: message.created_at,
          url,
          body: message.body,
        });
      }
    });

    const sortNewest = (a: ProfileAttachmentItem, b: ProfileAttachmentItem) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    return {
      media: media.sort(sortNewest),
      files: files.sort(sortNewest),
      links: links.sort(sortNewest),
      voices: voices.sort(sortNewest),
      gifs: gifs.sort(sortNewest),
    };
  }, [visibleMessages]);

  const visibleStickers = useMemo(() => {
    const query = stickerSearch.trim().toLowerCase();
    let stickers =
      activeStickerPack === "recent"
        ? recentStickerIds
            .flatMap((id) => {
              const sticker = allStickers.find((item) => item.id === id);
              return sticker ? [sticker] : [];
            })
        : activeStickerPack === "favorites"
          ? favoriteStickerIds
              .flatMap((id) => {
                const sticker = allStickers.find((item) => item.id === id);
                return sticker ? [sticker] : [];
              })
          : allStickers.filter((sticker) => sticker.packId === activeStickerPack);

    if (query) {
      stickers = stickers.filter(
        (sticker) =>
          sticker?.name.toLowerCase().includes(query) ||
          sticker?.emoji.includes(query)
      );
    }

    return stickers;
  }, [activeStickerPack, favoriteStickerIds, recentStickerIds, stickerSearch]);

  const stickerSuggestions = useMemo(() => {
    const value = draft.trim().toLowerCase();
    if (!value || pickerMode) return [];
    const loveWords = ["люблю", "любимый", "любимая", "серд", "love", "целую", "скучаю"];
    if (!loveWords.some((word) => value.includes(word))) return [];
    return allStickers.filter((sticker) => ["love-4", "love-2", "love-3"].includes(sticker.id));
  }, [draft, pickerMode]);

  const profileMediaItems = useMemo(
    () => [...profileItems.media, ...profileItems.gifs],
    [profileItems.gifs, profileItems.media]
  );

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerMode(null);
        setReactionTargetId(null);
      }
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!pickerMode) return;
      const target = event.target as Node;
      if (pickerRef.current?.contains(target)) return;
      setPickerMode(null);
      setReactionTargetId(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [pickerMode]);

  useEffect(() => {
    if (nextCursorPosition === null) return;
    if (appliedCursorRequestRef.current === nextCursorPosition.requestId) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(nextCursorPosition.position, nextCursorPosition.position);
    appliedCursorRequestRef.current = nextCursorPosition.requestId;
  }, [draft, nextCursorPosition]);
  useEffect(() => {
    async function loadChat() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNeedsLogin(true);
        setIsLoading(false);
        return;
      }

      setNeedsLogin(false);
      setCurrentUserId(user.id);

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (coupleError) {
        setErrorMessage(coupleError.message);
        setIsLoading(false);
        return;
      }

      if (!coupleData) {
        setCouple(null);
        setMessages([]);
        setHasOlderMessages(false);
        setIsLoading(false);
        return;
      }

      setCouple(coupleData);
      setDraft(localStorage.getItem(`${draftStoragePrefix}${coupleData.id}`) || "");

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      if (profileData) setProfile(profileData);

      const { data: messageData, error: messagesError } = await supabase
        .from("couple_chat_messages")
        .select(chatSelect)
        .eq("couple_id", coupleData.id)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (messagesError) {
        setErrorMessage(
          `${messagesError.message}. Запустите обновлённый supabase-chat-messages.sql в Supabase.`
        );
      } else {
        const recentMessages = ((messageData || []) as ChatMessage[]).reverse();
        setMessages(recentMessages);
        setHasOlderMessages(recentMessages.length === CHAT_PAGE_SIZE);
      }

      setIsLoading(false);
    }

    loadChat();
  }, [router]);

  useEffect(() => {
    if (!couple?.id || !currentUserId) return;
    localStorage.setItem(`${draftStoragePrefix}${couple.id}`, draft);
  }, [couple?.id, currentUserId, draft]);

  useEffect(() => {
    if (!isProfilePanelOpen) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setIsProfilePanelOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProfilePanelOpen]);

  useEffect(() => {
    if (!couple?.id || !currentUserId) return;

    const channel = supabase
      .channel(`couple-chat:${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_chat_messages",
          filter: `couple_id=eq.${couple.id}`,
        },
        (payload) => {
          const nextMessage = payload.new as ChatMessage;
          setMessages((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((message) => message.id !== payload.old.id);
            }

            const exists = current.some((message) => message.id === nextMessage.id);
            const next = exists
              ? current.map((message) =>
                  message.id === nextMessage.id ? nextMessage : message
                )
              : [...current, nextMessage];

            return next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== currentUserId) {
          setIsPartnerTyping(true);
          if (partnerTypingTimeoutRef.current) {
            window.clearTimeout(partnerTypingTimeoutRef.current);
          }
          partnerTypingTimeoutRef.current = window.setTimeout(() => {
            setIsPartnerTyping(false);
          }, 2200);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string; online_at: string }>();
        const partnerPresence = Object.values(state)
          .flat()
          .find((presence) => presence.user_id === partnerId);

        if (partnerPresence?.online_at) {
          setPartnerLastSeen(partnerPresence.online_at);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          chatChannelRef.current = channel;
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      chatChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [couple?.id, currentUserId, partnerId]);

  useEffect(() => {
    if (!couple?.id || !currentUserId) return;

    const unreadIds = messages
      .filter((message) => message.sender_id !== currentUserId && !message.read_at)
      .map((message) => message.id);

    if (!unreadIds.length) return;

    supabase
      .from("couple_chat_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .eq("couple_id", couple.id)
      .then();
  }, [couple?.id, currentUserId, messages]);

  useEffect(() => {
    if (!showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, showScrollButton]);

  useEffect(() => {
    if (!isRecording || isRecordingPaused) {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return;
    }

    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);

    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording, isRecordingPaused]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setShowScrollButton(false);
  }

  function getChatUserMeta(userId: string) {
    if (!couple) return { name: "?", avatar: null as string | null, initial: "?" };
    if (userId === couple.partner_one_id) {
      const name = profile?.partner_one || "A";
      return {
        name,
        avatar: profile?.avatar_one || profile?.avatar || null,
        initial: getInitial(name),
      };
    }

    const name = profile?.partner_two || "B";
    return {
      name,
      avatar: profile?.avatar_two || profile?.avatar || null,
      initial: getInitial(name),
    };
  }

  function openProfileMediaViewer(item: ProfileAttachmentItem) {
    if (!couple || !item.attachment) return;
    setViewerMessage({
      id: item.messageId,
      couple_id: couple.id,
      sender_id: partnerId || "",
      body: null,
      created_at: item.createdAt,
      edited_at: null,
      read_at: null,
      reply_to_id: null,
      reactions: [],
      attachment_url: item.attachment.url,
      attachment_type: "image",
      attachment_name: item.attachment.name,
      attachments: [item.attachment],
      pinned_at: null,
      deleted_for: [],
      deleted_for_everyone: false,
    });
  }

  function showNextViewerMedia(direction: 1 | -1) {
    if (!viewerMessage?.attachment_url || profileMediaItems.length === 0) return;
    const currentIndex = profileMediaItems.findIndex(
      (item) => item.attachment?.url === viewerMessage.attachment_url
    );
    if (currentIndex === -1) return;
    const nextIndex =
      (currentIndex + direction + profileMediaItems.length) % profileMediaItems.length;
    openProfileMediaViewer(profileMediaItems[nextIndex]);
  }

  function handleScroll() {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element) {
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        setShowScrollButton(distance > 220);
      }
      scrollFrameRef.current = null;
    });
  }

  async function loadOlderMessages() {
    const firstMessage = messages[0];
    const element = scrollRef.current;
    if (!couple?.id || !firstMessage || !element || isLoadingOlder) return;

    setIsLoadingOlder(true);
    prependScrollRef.current = {
      height: element.scrollHeight,
      top: element.scrollTop,
    };

    const { data, error } = await supabase
      .from("couple_chat_messages")
      .select(chatSelect)
      .eq("couple_id", couple.id)
      .lt("created_at", firstMessage.created_at)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE);

    if (error) {
      prependScrollRef.current = null;
      setErrorMessage("Не удалось загрузить старые сообщения.");
      setIsLoadingOlder(false);
      return;
    }

    const olderMessages = ((data || []) as ChatMessage[]).reverse();
    setMessages((current) => [...olderMessages, ...current]);
    setHasOlderMessages(olderMessages.length === CHAT_PAGE_SIZE);
    setIsLoadingOlder(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const anchor = prependScrollRef.current;
        const currentElement = scrollRef.current;
        if (anchor && currentElement) {
          currentElement.scrollTop =
            anchor.top + currentElement.scrollHeight - anchor.height;
        }
        prependScrollRef.current = null;
      });
    });
  }

  async function sendTyping() {
    if (!couple?.id || !currentUserId) return;
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      chatChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId },
      });
    }, 80);
  }

  async function uploadPendingAttachments(items: PendingAttachment[]) {
    if (!couple) return { attachments: [], storagePaths: [] };

    const uploaded: ChatAttachment[] = [];
    const storagePaths: string[] = [];

    try {
      for (const item of items) {
        setUploadProgress((current) => ({ ...current, [item.id]: 12 }));
        const uploadFile = item.type === "image"
          ? await compressImageFile(item.file, {
              maxWidth: 1600,
              maxHeight: 1600,
              quality: 0.78,
            })
          : item.file;
        setUploadProgress((current) => ({ ...current, [item.id]: 46 }));

        const filePath = getSafeStoragePath(couple.id, uploadFile);
        const { error } = await supabase.storage
          .from("chat-media")
          .upload(filePath, uploadFile, { upsert: false });

        if (error) {
          throw new Error("Не удалось загрузить вложение. Проверьте bucket chat-media.");
        }

        storagePaths.push(filePath);
        setUploadProgress((current) => ({ ...current, [item.id]: 86 }));
        const { data } = supabase.storage.from("chat-media").getPublicUrl(filePath);
        uploaded.push({
          id: item.id,
          url: toPortableSupabaseUrl(data.publicUrl) || data.publicUrl,
          type: item.type,
          name: uploadFile.name,
          size: uploadFile.size,
          mime_type: uploadFile.type || item.file.type || "application/octet-stream",
        });
        setUploadProgress((current) => ({ ...current, [item.id]: 100 }));
      }
    } catch (error) {
      if (storagePaths.length > 0) {
        await supabase.storage.from("chat-media").remove(storagePaths);
      }
      throw error;
    }

    return { attachments: uploaded, storagePaths };
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>, directAttachments: PendingAttachment[] = []) {
    event?.preventDefault();
    if (!couple || !currentUserId || isSending) return;

    const body = draft.trim();
    const attachmentsToSend = directAttachments.length ? directAttachments : pendingAttachments;
    if (!body && attachmentsToSend.length === 0) return;

    setIsSending(true);
    setErrorMessage("");

    if (editingId && attachmentsToSend.length === 0) {
      const { data, error } = await supabase
        .from("couple_chat_messages")
        .update({ body, edited_at: new Date().toISOString() })
        .eq("id", editingId)
        .eq("sender_id", currentUserId)
        .select(chatSelect)
        .single<ChatMessage>();

      if (error || !data) {
        setErrorMessage(error?.message || "Не удалось изменить сообщение");
      } else {
        setMessages((current) =>
          current.map((message) => (message.id === data.id ? data : message))
        );
        setDraft("");
        setEditingId(null);
      }

      setIsSending(false);
      return;
    }

    let uploadedAttachments: ChatAttachment[] = [];
    let uploadedStoragePaths: string[] = [];
    try {
      const upload = await uploadPendingAttachments(attachmentsToSend);
      uploadedAttachments = upload.attachments;
      uploadedStoragePaths = upload.storagePaths;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить вложение");
      if (directAttachments.length > 0) {
        setPendingAttachments((current) => [...current, ...directAttachments].slice(0, 10));
      }
      setIsSending(false);
      return;
    }

    const storedBody =
      body ||
      (uploadedAttachments[0]?.type === "audio"
        ? "Голосовое сообщение"
        : uploadedAttachments[0]?.type === "file"
          ? uploadedAttachments[0].name
          : uploadedAttachments.length
            ? "Вложение"
            : "");

    const optimisticId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      couple_id: couple.id,
      sender_id: currentUserId,
      body: storedBody || null,
      created_at: new Date().toISOString(),
      edited_at: null,
      read_at: null,
      reply_to_id: replyToId,
      reactions: [],
      attachment_url: uploadedAttachments[0]?.url || null,
      attachment_type:
        uploadedAttachments[0]?.type === "audio" || uploadedAttachments[0]?.type === "image"
          ? uploadedAttachments[0].type
          : null,
      attachment_name: uploadedAttachments[0]?.name || null,
      attachments: uploadedAttachments,
      pinned_at: null,
      deleted_for: [],
      deleted_for_everyone: false,
    };

    setMessages((current) => [...current, optimisticMessage]);

    const { data, error } = await supabase
      .from("couple_chat_messages")
      .insert([
        {
          couple_id: couple.id,
          sender_id: currentUserId,
          body: storedBody,
          reply_to_id: replyToId,
          attachment_url: uploadedAttachments[0]?.url || null,
          attachment_type:
            uploadedAttachments[0]?.type === "audio" || uploadedAttachments[0]?.type === "image"
              ? uploadedAttachments[0].type
              : null,
          attachment_name: uploadedAttachments[0]?.name || null,
          attachments: uploadedAttachments,
        },
      ])
      .select(chatSelect)
      .single<ChatMessage>();

    if (error || !data) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      if (uploadedStoragePaths.length > 0) {
        await supabase.storage.from("chat-media").remove(uploadedStoragePaths);
      }
      if (directAttachments.length > 0) {
        setPendingAttachments((current) => [...current, ...directAttachments].slice(0, 10));
      }
      setErrorMessage(error?.message || "Не удалось отправить сообщение");
      setIsSending(false);
      return;
    }

    setMessages((current) =>
      current.map((message) => (message.id === optimisticId ? data : message))
    );
    setDraft("");
    attachmentsToSend.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
    if (directAttachments.length === 0) {
      setPendingAttachments([]);
    }
    setUploadProgress({});
    setReplyToId(null);
    setIsSending(false);

    await createPartnerNotification(couple, currentUserId, {
      type: uploadedAttachments.length ? "chat_media" : "chat_message",
      title: uploadedAttachments.length ? "Новое вложение в чате" : "Новое сообщение",
      body: storedBody,
      href: "/chat",
    });
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    sendTyping();
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleEmojiSelect(emoji: string) {
    if (reactionTargetId) {
      const targetMessage = messages.find((message) => message.id === reactionTargetId);
      if (targetMessage) toggleReaction(targetMessage, emoji);
      setReactionTargetId(null);
      setPickerMode(null);
      return;
    }

    const selectionStart = draftSelection.start;
    const selectionEnd = draftSelection.end;
    const nextDraft = `${draft.slice(0, selectionStart)}${emoji}${draft.slice(selectionEnd)}`;
    const cursor = selectionStart + emoji.length;

    setDraft(nextDraft);
    setDraftSelection({ start: cursor, end: cursor });
    setNextCursorPosition({ position: cursor, requestId: crypto.randomUUID() });
  }

  function rememberSticker(stickerId: string) {
    setRecentStickerIds((current) => {
      const next = [stickerId, ...current.filter((id) => id !== stickerId)].slice(0, 24);
      localStorage.setItem(recentStickerStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function toggleFavoriteSticker(stickerId: string) {
    setFavoriteStickerIds((current) => {
      const next = current.includes(stickerId)
        ? current.filter((id) => id !== stickerId)
        : [stickerId, ...current].slice(0, 48);
      localStorage.setItem(favoriteStickerStorageKey, JSON.stringify(next));
      return next;
    });
  }

  async function sendSticker(sticker: (typeof allStickers)[number]) {
    if (!couple || !currentUserId || isSending) return;

    const attachment: ChatAttachment = {
      id: sticker.id,
      url: sticker.url,
      type: "sticker",
      name: sticker.name,
      size: 0,
      mime_type: "image/webp",
    };
    const optimisticId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      couple_id: couple.id,
      sender_id: currentUserId,
      body: sticker.name,
      created_at: new Date().toISOString(),
      edited_at: null,
      read_at: null,
      reply_to_id: replyToId,
      reactions: [],
      attachment_url: null,
      attachment_type: null,
      attachment_name: sticker.name,
      attachments: [attachment],
      pinned_at: null,
      deleted_for: [],
      deleted_for_everyone: false,
    };

    setIsSending(true);
    setErrorMessage("");
    setMessages((current) => [...current, optimisticMessage]);
    setReplyToId(null);
    rememberSticker(sticker.id);
    setPickerMode(null);

    const { data, error } = await supabase
      .from("couple_chat_messages")
      .insert([
        {
          couple_id: couple.id,
          sender_id: currentUserId,
          body: sticker.name,
          reply_to_id: replyToId,
          attachment_url: null,
          attachment_type: null,
          attachment_name: sticker.name,
          attachments: [attachment],
        },
      ])
      .select(chatSelect)
      .single<ChatMessage>();

    if (error || !data) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setErrorMessage(error?.message || "Не удалось отправить стикер");
      setIsSending(false);
      return;
    }

    setMessages((current) =>
      current.map((message) => (message.id === optimisticId ? data : message))
    );
    setIsSending(false);

    await createPartnerNotification(couple, currentUserId, {
      type: "chat_media",
      title: "Новый стикер в чате",
      body: sticker.name,
      href: "/chat",
    });
  }

  function addPendingFiles(files: File[]) {
    setErrorMessage("");
    const nextItems: PendingAttachment[] = [];

    for (const file of files) {
      const type = getMediaKind(file);
      const limit =
        type === "audio" ? MAX_AUDIO_SIZE : type === "file" ? maxFileSize : maxMediaSize;

      if (file.size <= 0) {
        setErrorMessage(`${file.name}: файл пустой.`);
        continue;
      }

      if (file.size > limit) {
        setErrorMessage(
          `${file.name}: файл слишком большой. Лимит ${
            type === "audio" ? "15 MB" : type === "file" ? "50 MB" : "25 MB"
          }.`
        );
        continue;
      }

      nextItems.push({
        id: crypto.randomUUID(),
        file,
        type,
        previewUrl:
          type === "image" || type === "video" ? URL.createObjectURL(file) : null,
      });
    }

    if (nextItems.length) {
      setPendingAttachments((current) => {
        const availableSlots = Math.max(0, 10 - current.length);
        const acceptedItems = nextItems.slice(0, availableSlots);
        nextItems.slice(availableSlots).forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        if (acceptedItems.length < nextItems.length) {
          setErrorMessage("Можно прикрепить не больше 10 файлов к одному сообщению.");
        }
        return [...current, ...acceptedItems];
      });
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => {
      const item = current.find((attachment) => attachment.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createCompatibleAudioRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      discardRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingSeconds(0);
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          audioChunksRef.current = [];
          return;
        }
        try {
          const audioFile = createRecordedAudioFile(
            audioChunksRef.current,
            recorder.mimeType,
            "voice"
          );
          sendMessage(undefined, [
            {
              id: crypto.randomUUID(),
              file: audioFile,
              type: "audio",
              previewUrl: null,
            },
          ]);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить запись");
        }
      };

      recorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);
    } catch {
      setErrorMessage(
        "Не удалось включить микрофон. Разрешите доступ или загрузите готовый аудиофайл."
      );
    }
  }

  function stopRecording() {
    discardRecordingRef.current = false;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsRecordingPaused(false);
  }

  function cancelRecording() {
    discardRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordingSeconds(0);
  }

  function toggleRecordingPause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;

    if (recorder.state === "recording") {
      recorder.pause();
      setIsRecordingPaused(true);
      return;
    }

    if (recorder.state === "paused") {
      recorder.resume();
      setIsRecordingPaused(false);
    }
  }

  async function updateMessage(id: string, patch: Partial<ChatMessage>) {
    const { data, error } = await supabase
      .from("couple_chat_messages")
      .update(patch)
      .eq("id", id)
      .select(chatSelect)
      .single<ChatMessage>();

    if (error || !data) {
      setErrorMessage(error?.message || "Не удалось обновить сообщение");
      return;
    }

    setMessages((current) =>
      current.map((message) => (message.id === id ? data : message))
    );
  }

  async function toggleReaction(message: ChatMessage, emoji: string) {
    if (!currentUserId) return;
    const existing = message.reactions || [];
    const hasReaction = existing.some(
      (reaction) => reaction.user_id === currentUserId && reaction.emoji === emoji
    );
    const nextReactions = hasReaction
      ? existing.filter(
          (reaction) =>
            !(reaction.user_id === currentUserId && reaction.emoji === emoji)
        )
      : [...existing.filter((reaction) => reaction.user_id !== currentUserId), { emoji, user_id: currentUserId }];

    await updateMessage(message.id, { reactions: nextReactions });
    setMenuMessageId(null);
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id);
    setDraft(message.body || "");
    setReplyToId(null);
    setMenuMessageId(null);
  }

  function startReply(message: ChatMessage) {
    setReplyToId(message.id);
    setEditingId(null);
    setMenuMessageId(null);
  }

  async function deleteForMe(message: ChatMessage) {
    if (!currentUserId) return;
    await updateMessage(message.id, {
      deleted_for: Array.from(new Set([...(message.deleted_for || []), currentUserId])),
    });
    setMenuMessageId(null);
  }

  async function deleteForEveryone(message: ChatMessage) {
    await updateMessage(message.id, {
      body: null,
      attachment_url: null,
      attachment_type: null,
      attachment_name: null,
      deleted_for_everyone: true,
    });
    setMenuMessageId(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, message: ChatMessage) {
    swipeStartRef.current = { id: message.id, x: event.clientX };
    longPressTimeoutRef.current = window.setTimeout(() => {
      setMenuMessageId(message.id);
    }, 520);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>, message: ChatMessage) {
    if (longPressTimeoutRef.current) window.clearTimeout(longPressTimeoutRef.current);
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start?.id === message.id && event.clientX - start.x > 72) {
      startReply(message);
    }
  }

  function jumpToMessage(id: string | null) {
    if (!id) return;
    document.getElementById(`message-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function scrollToMessage(messageId: string) {
    setIsProfilePanelOpen(false);
    window.setTimeout(() => jumpToMessage(messageId), 80);
  }

  function toggleAudio(messageId: string) {
    const activeAudio = audioRefs.current[messageId];
    if (!activeAudio) return;

    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (id !== messageId) audio?.pause();
    });

    if (playingAudioId === messageId && !activeAudio.paused) {
      activeAudio.pause();
      setPlayingAudioId(null);
      return;
    }

    activeAudio.play();
    setPlayingAudioId(messageId);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] px-6 pt-28 text-[#0284c7] dark:from-[#031b2e] dark:via-[#021526] dark:to-black dark:text-white">
        <div className="w-full max-w-xl space-y-4 rounded-[2rem] bg-white/55 p-6 shadow-2xl backdrop-blur-xl dark:bg-white/10">
          <p className="text-center text-sm font-black uppercase tracking-[0.18em] text-[#0284c7]/70 dark:text-white/60">
            Загружаем чат...
          </p>
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-16 animate-pulse rounded-[1.5rem] bg-white/70 dark:bg-white/10 ${
                item % 2 ? "ml-20" : "mr-20"
              }`}
            />
          ))}
        </div>
      </main>
    );
  }

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] px-6 pb-24 pt-28 text-[#075985] dark:from-[#031b2e] dark:via-[#021526] dark:to-black dark:text-white">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/60 bg-white/55 p-8 text-center shadow-[0_32px_110px_rgba(2,132,199,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-500/70">
            Чат
          </p>
          <h1 className="mt-3 text-4xl font-black">Войдите, чтобы открыть чат</h1>
          <p className="mt-4 font-semibold text-[#075985]/68 dark:text-white/60">
            Сообщения пары доступны только после входа в аккаунт.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex rounded-full bg-[#0284c7] px-7 py-4 font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#0ea5e9]"
          >
            Перейти ко входу
          </Link>
        </section>
      </main>
    );
  }

  if (!couple) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] px-6 pb-24 pt-28 text-[#075985] dark:from-[#031b2e] dark:via-[#021526] dark:to-black dark:text-white">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/60 bg-white/55 p-8 text-center shadow-[0_32px_110px_rgba(2,132,199,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-sky-500/70">
            Чат
          </p>
          <h1 className="mt-3 text-4xl font-black">Сначала создайте пару</h1>
          <p className="mt-4 font-semibold text-[#075985]/68 dark:text-white/60">
            Чат работает только для двух пользователей, которые уже находятся в одной паре.
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="mt-7 rounded-full bg-[#0284c7] px-7 py-4 font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#0ea5e9]"
          >
            Перейти в профиль
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDraggingFile(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingFile(false);
        addPendingFiles(Array.from(event.dataTransfer.files));
      }}
      className="chat-page mobile-fullscreen relative h-[100dvh] overflow-hidden bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] px-0 pb-0 pt-0 text-[#075985] dark:from-[#031b2e] dark:via-[#021526] dark:to-black dark:text-white md:min-h-screen md:px-6 md:pb-8 md:pt-28"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="chat-blob absolute left-[-8rem] top-24 h-80 w-80 rounded-full bg-sky-300/35 blur-3xl dark:bg-sky-500/12" />
        <div className="chat-blob chat-blob-delay absolute right-[-9rem] top-48 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/12" />
      </div>

      <section className="relative mx-auto flex h-[100dvh] min-h-0 max-w-5xl flex-col overflow-hidden border-y border-white/60 bg-white/44 shadow-[0_32px_110px_rgba(2,132,199,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:h-[calc(100vh-9rem)] md:rounded-[2rem] md:border">
        {isDraggingFile && (
          <div className="pointer-events-none absolute inset-3 z-50 grid place-items-center rounded-[1.5rem] border-2 border-dashed border-[#0284c7]/55 bg-white/55 text-center text-xl font-black text-[#0284c7] shadow-inner backdrop-blur-xl dark:bg-black/45 dark:text-white">
            Отпустите файл, чтобы добавить вложение
          </div>
        )}
        <header className="chat-mobile-header sticky top-0 z-20 shrink-0 overflow-hidden border-b border-white/50 bg-white/70 px-14 py-2.5 backdrop-blur-2xl dark:border-white/10 dark:bg-black/35 md:px-6 md:py-3">
          <Link
            href="/dashboard"
            className="absolute left-3 top-2.5 grid h-10 w-10 place-items-center rounded-full bg-white/72 text-xl font-black text-[#0284c7] shadow-inner backdrop-blur transition hover:bg-sky-50 dark:bg-white/10 dark:text-white md:hidden"
            aria-label="В кабинет"
          >
            <ArrowLeft aria-hidden="true" size={22} />
          </Link>
          <div className="flex min-w-0 items-center justify-center gap-2 md:justify-between">
            <button
              type="button"
              onClick={() => setIsProfilePanelOpen(true)}
              className="flex min-w-0 max-w-full items-center gap-2 rounded-full bg-white/68 px-3 py-1.5 text-left shadow-inner transition hover:bg-sky-50 dark:bg-white/10 dark:hover:bg-white/14 md:gap-3 md:rounded-2xl md:bg-transparent md:px-0 md:py-0 md:shadow-none"
            >
              <div className="relative flex">
                {partnerProfile.avatar ? (
                  <Image src={partnerProfile.avatar} alt={partnerProfile.name} width={44} height={44} sizes="44px" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/80 md:h-11 md:w-11" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 font-black shadow-inner ring-2 ring-white/80 dark:bg-white/10 md:h-11 md:w-11">{getInitial(partnerProfile.name)}</span>
                )}
              </div>
              <div className="min-w-0 pr-1">
                <h1 className="max-w-[9.5rem] truncate text-base font-black min-[380px]:max-w-[11rem] md:max-w-none md:text-2xl">
                  {partnerProfile.name}
                </h1>
                <p className="max-w-[9.5rem] truncate text-[11px] font-black text-sky-500/70 min-[380px]:max-w-[11rem] md:max-w-none md:text-xs">
                  {isPartnerTyping ? (
                    <span className="inline-flex items-center gap-1">
                      печатает
                      <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-sky-500/70" />
                      <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-sky-500/70" />
                      <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-sky-500/70" />
                    </span>
                  ) : partnerLastSeen
                      ? `последний раз в сети ${formatMessageTime(partnerLastSeen)}`
                      : "личный чат пары"}
                  {unreadCount > 0 ? ` · новых: ${unreadCount}` : ""}
                </p>
              </div>
            </button>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск"
              className="hidden h-10 w-48 rounded-full border border-sky-200/70 bg-white/72 px-4 text-sm font-bold outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-white/10 md:block"
            />
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по чату"
            className="mt-3 hidden h-10 w-full rounded-full border border-sky-200/70 bg-white/72 px-4 text-sm font-bold outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-white/10"
          />
          {activePinnedMessage && (
            <div className="relative mt-3 rounded-2xl bg-sky-100/80 px-3 py-2 text-sm font-black text-sky-700 shadow-inner dark:bg-white/10 dark:text-sky-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextIndex =
                      safePinnedIndex + 1 >= pinnedMessages.length
                        ? 0
                        : safePinnedIndex + 1;
                    setActivePinnedIndex(nextIndex);
                    jumpToMessage(pinnedMessages[nextIndex]?.id || activePinnedMessage.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <Pin aria-hidden="true" className="mr-2 inline" size={15} />
                  <span className="opacity-60">
                    {safePinnedIndex + 1}/{pinnedMessages.length}
                  </span>{" "}
                  <span className="line-clamp-1">
                    {activePinnedMessage.body ||
                      activePinnedMessage.attachment_name ||
                      "Закреплённое сообщение"}
                  </span>
                </button>
                <button
                  onClick={() => setIsPinnedListOpen((current) => !current)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/75 text-base shadow-inner transition hover:bg-white dark:bg-black/25"
                  aria-label="Открыть список закреплённых"
                >
                  <List aria-hidden="true" size={18} />
                </button>
              </div>

              {isPinnedListOpen && (
                <div className="chat-menu-in absolute left-0 right-0 top-12 z-30 max-h-72 overflow-y-auto rounded-2xl border border-white/60 bg-white/96 p-2 shadow-[0_18px_55px_rgba(127,29,29,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/90">
                  {pinnedMessages.map((message, index) => (
                    <div
                      key={message.id}
                      className="mb-1 flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-sky-50 dark:hover:bg-white/10"
                    >
                      <button
                        onClick={() => {
                          setActivePinnedIndex(index);
                          setIsPinnedListOpen(false);
                          jumpToMessage(message.id);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-xs font-black opacity-55">
                          {formatMessageTime(message.created_at)}
                        </p>
                        <p className="truncate text-sm font-black">
                          {message.body || message.attachment_name || "Вложение"}
                        </p>
                      </button>
                      <button
                        onClick={() => {
                          setActivePinnedIndex(index);
                          setIsPinnedListOpen(false);
                          jumpToMessage(message.id);
                        }}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 shadow-inner dark:bg-white/10 dark:text-white"
                        aria-label="Показать сообщение в чате"
                      >
                        <ExternalLink aria-hidden="true" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {errorMessage && (
          <div className="mx-4 mt-4 rounded-2xl bg-sky-100/85 px-4 py-3 text-sm font-black text-sky-700 shadow-inner dark:bg-sky-500/15 dark:text-sky-100 md:mx-6">
            {errorMessage}
          </div>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto px-2 py-3 pb-28 md:px-6 md:py-4 md:pb-4">
          {visibleMessages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-sm rounded-[2rem] bg-white/55 p-7 shadow-inner backdrop-blur dark:bg-white/8">
                <MessageCircle aria-hidden="true" className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-2xl font-black">Начните ваш чат</h2>
                <p className="mt-3 font-semibold text-[#075985]/60 dark:text-white/55">
                  Сообщения, фото и голосовые появятся здесь.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {hasOlderMessages && !search.trim() && (
                <div className="flex justify-center pb-2">
                  <button
                    type="button"
                    onClick={loadOlderMessages}
                    disabled={isLoadingOlder}
                    className="rounded-full bg-white/88 px-4 py-2 text-sm font-black text-sky-700 shadow-md transition disabled:opacity-60 dark:bg-slate-900 dark:text-sky-100"
                  >
                    {isLoadingOlder ? "Загружаем…" : "Показать предыдущие сообщения"}
                  </button>
                </div>
              )}
              {visibleMessages.map((message, index) => {
                const previous = visibleMessages[index - 1];
                const next = visibleMessages[index + 1];
                const isMine = message.sender_id === currentUserId;
                const sameDay =
                  previous &&
                  new Date(previous.created_at).toDateString() ===
                    new Date(message.created_at).toDateString();
                const isLastInGroup = !next || next.sender_id !== message.sender_id;
                const sourceReply = message.reply_to_id
                  ? messages.find((item) => item.id === message.reply_to_id)
                  : null;
                const attachments = getMessageAttachments(message);
                const mediaAttachments = attachments.filter(
                  (attachment) => attachment.type === "image" || attachment.type === "video"
                );
                const fileAttachments = attachments.filter(
                  (attachment) => attachment.type === "file"
                );
                const voiceAttachment = attachments.find(
                  (attachment) => attachment.type === "audio"
                );
                const stickerAttachment = attachments.find(
                  (attachment) => attachment.type === "sticker"
                );
                const isVoiceMessage = Boolean(voiceAttachment);
                const isStickerMessage = Boolean(stickerAttachment);
                const isBigEmojiMessage =
                  !message.deleted_for_everyone &&
                  !isVoiceMessage &&
                  !isStickerMessage &&
                  attachments.length === 0 &&
                  isSingleEmojiText(message.body);
                const linkUrl = extractFirstUrl(message.body || "");
                const metaNode = (
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap align-baseline text-[10px] font-semibold ${
                      isStickerMessage
                        ? "text-white/55"
                        : isMine
                          ? "text-white/55"
                          : "text-white/38"
                    }`}
                  >
                    {message.edited_at && <span>изм.</span>}
                    <span>{formatMessageTime(message.created_at)}</span>
                    {isMine && <span>{message.read_at ? "✓✓" : "✓"}</span>}
                  </span>
                );
                const groupedReactions = (message.reactions || []).reduce<Record<string, string[]>>(
                  (acc, reaction) => {
                    acc[reaction.emoji] = [...(acc[reaction.emoji] || []), reaction.user_id];
                    return acc;
                  },
                  {}
                );

                return (
                  <div key={message.id} id={`message-${message.id}`} className="performance-list-item">
                    {!sameDay && (
                      <div className="sticky top-2 z-10 mx-auto my-3 w-fit rounded-full bg-white/72 px-4 py-1 text-xs font-black text-sky-600 shadow-lg backdrop-blur dark:bg-black/45 dark:text-sky-100">
                        {formatDay(message.created_at)}
                      </div>
                    )}
                    <div className={`chat-message-pop group relative flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        onPointerDown={(event) => handlePointerDown(event, message)}
                        onPointerUp={(event) => handlePointerUp(event, message)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setMenuMessageId(message.id);
                        }}
                        className={`relative w-fit max-w-[84%] break-words rounded-[14px] shadow-[0_4px_14px_rgba(0,0,0,0.1)] transition hover:-translate-y-0.5 sm:max-w-[78%] md:max-w-[62%] ${
                          isStickerMessage || isBigEmojiMessage ? "px-0 py-0 shadow-none" : isVoiceMessage ? "px-3 py-2" : "px-3 py-1.5"
                        } ${
                          isStickerMessage || isBigEmojiMessage
                            ? "bg-transparent text-white"
                            : isVoiceMessage
                            ? `bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-white shadow-sky-500/18 ${
                                isLastInGroup
                                  ? isMine
                                    ? "rounded-br-[4px]"
                                    : "rounded-bl-[4px]"
                                  : ""
                              }`
                            : isMine
                            ? `bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-white shadow-sky-500/18 ${isLastInGroup ? "rounded-br-[4px]" : ""}`
                            : `bg-[#0f2638] text-white shadow-black/10 ${isLastInGroup ? "rounded-bl-[4px]" : ""}`
                        }`}
                      >
                        {isLastInGroup && !isStickerMessage && !isBigEmojiMessage && (
                          <span
                            className={`pointer-events-none absolute bottom-0 h-3 w-3 ${
                              isMine
                                ? "-right-1 bg-[#0369a1] [clip-path:polygon(0_0,100%_100%,0_100%)]"
                                : `-left-1 ${isVoiceMessage ? "bg-[#0284c7]" : "bg-[#0f2638]"} [clip-path:polygon(100%_0,100%_100%,0_100%)]`
                            }`}
                          />
                        )}
                        {sourceReply && (
                          <button
                            onClick={() => jumpToMessage(sourceReply.id)}
                            className={`mb-1.5 block w-full rounded-[10px] border-l-4 px-2.5 py-1.5 text-left text-[11px] font-black ${
                              isMine
                                ? "border-white/70 bg-white/14 text-white/82"
                                : "border-sky-400 bg-white/8 text-white/72"
                            }`}
                          >
                            {sourceReply.body || sourceReply.attachment_name || "Вложение"}
                          </button>
                        )}
                        {message.deleted_for_everyone ? (
                          <p className="italic opacity-60">Сообщение удалено</p>
                            ) : (
                          <>
                            {isBigEmojiMessage && (
                              <div className={`chat-big-emoji-message ${isMine ? "ml-auto" : ""}`}>
                                <div className="text-6xl leading-none drop-shadow-[0_12px_26px_rgba(0,0,0,0.25)] md:text-7xl">
                                  {message.body}
                                </div>
                                <div className={`mt-1 flex ${isMine ? "justify-end" : "justify-start"}`}>
                                  <span className="rounded-full bg-black/34 px-2 py-0.5 backdrop-blur">
                                    {metaNode}
                                  </span>
                                </div>
                              </div>
                            )}
                            {stickerAttachment && (
                              <div className={`chat-sticker-message ${isMine ? "ml-auto" : ""}`}>
                                <button
                                  type="button"
                                  onClick={() => setStickerPreview(stickerAttachment)}
                                  className="chat-sticker-send relative block h-36 w-36 rounded-[1.5rem] bg-contain bg-center bg-no-repeat transition hover:scale-110 md:h-40 md:w-40"
                                  style={{ backgroundImage: `url("${stickerAttachment.url}")` }}
                                  aria-label={stickerAttachment.name}
                                >
                                  <span className="sr-only">{stickerAttachment.name}</span>
                                </button>
                                <div className={`mt-0.5 flex ${isMine ? "justify-end" : "justify-start"}`}>
                                  <span className="rounded-full bg-black/34 px-2 py-0.5 backdrop-blur">
                                    {metaNode}
                                  </span>
                                </div>
                              </div>
                            )}
                            {mediaAttachments.length > 0 && (
                              <div
                                className={`mb-1.5 grid gap-1 overflow-hidden rounded-[10px] ${
                                  mediaAttachments.length === 1
                                    ? "grid-cols-1"
                                    : "grid-cols-2"
                                }`}
                              >
                                {mediaAttachments.map((attachment) => (
                                  <button
                                    key={attachment.id}
                                    onClick={() => {
                                      if (attachment.type === "video") {
                                        window.open(attachment.url, "_blank", "noreferrer");
                                        return;
                                      }

                                      setViewerMessage({
                                        ...message,
                                        attachment_url: attachment.url,
                                        attachment_type: "image",
                                        attachment_name: attachment.name,
                                      });
                                    }}
                                    className="relative block overflow-hidden bg-white/10"
                                  >
                                    {attachment.type === "image" ? (
                                      <Image
                                        src={attachment.url}
                                        alt={attachment.name}
                                        width={640}
                                        height={420}
                                        sizes="(max-width: 768px) 80vw, 520px"
                                        className="h-44 w-full object-cover blur-0 transition duration-500"
                                      />
                                    ) : (
                                      <video
                                        src={attachment.url}
                                        preload="none"
                                        playsInline
                                        className="h-44 w-full object-cover"
                                        muted
                                      />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                            {fileAttachments.length > 0 && (
                              <div className="mb-1.5 space-y-1.5">
                                {fileAttachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex min-w-60 items-center gap-3 rounded-[12px] bg-white/12 p-2.5 shadow-inner transition hover:bg-white/18"
                                  >
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[10px] font-black text-[#0284c7]">
                                      {getFileIcon(attachment.name, attachment.mime_type)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-black">
                                        {attachment.name}
                                      </span>
                                      <span className="text-xs font-semibold opacity-55">
                                        {formatFileSize(attachment.size)}
                                      </span>
                                    </span>
                                    <ExternalLink aria-hidden="true" size={17} />
                                  </a>
                                ))}
                              </div>
                            )}
                            {voiceAttachment && (
                              <div className="flex w-[min(20.5rem,76vw)] items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => toggleAudio(message.id)}
                                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-black shadow-lg transition hover:scale-105 ${
                                    isMine
                                      ? "bg-white text-[#0284c7]"
                                      : "bg-white text-[#0284c7]"
                                  }`}
                                  aria-label={
                                    playingAudioId === message.id
                                      ? "Пауза"
                                      : "Воспроизвести"
                                  }
                                >
                                  {playingAudioId === message.id ? <Pause aria-hidden="true" size={15} fill="currentColor" /> : <Play aria-hidden="true" size={15} fill="currentColor" />}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex h-7 items-center gap-[1.5px]">
                                    {Array.from({ length: 46 }).map((_, barIndex) => {
                                      const progress = audioProgress[message.id] || 0;
                                      const isFilled = barIndex / 45 <= progress;
                                      const wave =
                                        Math.sin(barIndex * 0.72) * 9 +
                                        Math.sin(barIndex * 1.9) * 4 +
                                        Math.cos(barIndex * 0.33) * 5;
                                      const height = Math.max(5, Math.min(30, 16 + wave));
                                      const width = barIndex % 5 === 0 ? 3 : barIndex % 2 === 0 ? 2 : 1;

                                      return (
                                        <span
                                          key={barIndex}
                                          className={`w-1 rounded-full transition-all ${
                                            playingAudioId === message.id
                                              ? "chat-voice-wave"
                                              : ""
                                          } ${
                                            isFilled
                                              ? isMine
                                                ? "bg-white"
                                                : "bg-white"
                                              : isMine
                                                ? "bg-white/35"
                                                : "bg-white/25"
                                          }`}
                                          style={{
                                            height,
                                            width,
                                            animationDelay: `${barIndex * 0.035}s`,
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                  <div
                                    className={`mt-0 flex items-center justify-between text-[10px] font-semibold ${
                                      isMine
                                        ? "text-white/68"
                                        : "text-white/45"
                                    }`}
                                  >
                                    <span>
                                      {formatAudioTime(
                                        (audioProgress[message.id] || 0) *
                                          (audioDurations[message.id] || 0)
                                      )}{" "}
                                      / {formatAudioTime(audioDurations[message.id] || 0)}
                                    </span>
                                  </div>
                                </div>

                                <audio
                                  ref={(node) => {
                                    audioRefs.current[message.id] = node;
                                  }}
                                  src={voiceAttachment.url}
                                  preload="none"
                                  onLoadedMetadata={(event) => {
                                    const duration = event.currentTarget.duration;
                                    setAudioDurations((current) => ({
                                      ...current,
                                      [message.id]: Number.isFinite(duration)
                                        ? duration
                                        : 0,
                                    }));
                                  }}
                                  onTimeUpdate={(event) => {
                                    const audio = event.currentTarget;
                                    setAudioProgress((current) => ({
                                      ...current,
                                      [message.id]:
                                        audio.duration > 0
                                          ? audio.currentTime / audio.duration
                                          : 0,
                                    }));
                                  }}
                                  onEnded={() => {
                                    setPlayingAudioId(null);
                                    setAudioProgress((current) => ({
                                      ...current,
                                      [message.id]: 0,
                                    }));
                                  }}
                                  className="hidden"
                                />
                              </div>
                            )}
                            {message.body && !isVoiceMessage && !isStickerMessage && !isBigEmojiMessage && (
                              <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-5">
                                {message.body}
                                <span className="inline-block w-2" />
                                {metaNode}
                              </p>
                            )}
                            {linkUrl && !isVoiceMessage && !isStickerMessage && !isBigEmojiMessage && (
                              <LinkPreviewCard url={linkUrl} isMine={isMine} />
                            )}
                          </>
                        )}
                        {isVoiceMessage && (
                          <div className="-mt-0.5 flex justify-end">{metaNode}</div>
                        )}
                        {Object.keys(groupedReactions).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(groupedReactions).map(([emoji, userIds]) => {
                              const isMyReaction = (message.reactions || []).some(
                                (reaction) =>
                                  reaction.user_id === currentUserId && reaction.emoji === emoji
                              );
                              const singleUser = userIds.length === 1 ? getChatUserMeta(userIds[0]) : null;
                              return (
                              <button key={emoji} data-anime-burst={emoji} onClick={() => toggleReaction(message, emoji)} className={`chat-reaction-pill inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black shadow-inner ${isMyReaction ? "bg-sky-100 text-sky-700 ring-2 ring-white/70 dark:bg-sky-500/30 dark:text-white" : "bg-white/72 text-sky-700 dark:bg-black/25 dark:text-white"}`}>
                                <span>{emoji}</span>
                                {userIds.length > 1 ? (
                                  <span className="text-[11px]">{userIds.length}</span>
                                ) : singleUser?.avatar ? (
                                  <Image src={singleUser.avatar} alt={singleUser.name} width={18} height={18} sizes="18px" className="h-[18px] w-[18px] rounded-full object-cover ring-1 ring-white/80" />
                                ) : (
                                  <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white/70 text-[9px] text-[#0284c7] ring-1 ring-white/80 dark:bg-black/30 dark:text-white">{singleUser?.initial || "?"}</span>
                                )}
                              </button>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={() => setMenuMessageId(message.id)}
                          className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-xs font-black text-sky-600 shadow-lg group-hover:block dark:bg-black/70 dark:text-white ${isMine ? "-left-9" : "-right-9"}`}
                        >
                          <MoreHorizontal aria-hidden="true" size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-28 right-5 z-20 grid h-11 w-11 place-items-center rounded-full bg-white/88 text-xl font-black text-sky-600 shadow-xl backdrop-blur transition hover:-translate-y-0.5 dark:bg-black/70 dark:text-white"
          >
            <ArrowDown aria-hidden="true" size={20} />
          </button>
        )}

        <form onSubmit={sendMessage} className="fixed inset-x-0 bottom-0 z-40 shrink-0 border-t border-white/50 bg-white/86 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-2xl dark:border-white/10 dark:bg-black/72 md:relative md:inset-auto md:bottom-auto md:z-20 md:bg-white/72 md:p-4 md:pb-4 md:dark:bg-black/35">
          {(replyMessage || editingMessage) && (
            <div className="chat-reply-preview mb-3 flex items-center justify-between gap-3 rounded-2xl bg-sky-100/80 px-4 py-3 text-sm font-black text-sky-700 shadow-inner dark:bg-white/10 dark:text-sky-100">
              <div className="min-w-0">
                <p>{editingMessage ? "Редактирование" : "Ответ"}</p>
                <p className="truncate opacity-70">
                  {(editingMessage || replyMessage)?.body ||
                    (editingMessage || replyMessage)?.attachment_name ||
                    "Вложение"}
                </p>
              </div>
              <button type="button" onClick={() => { setReplyToId(null); setEditingId(null); setDraft(""); }} className="grid h-8 w-8 place-items-center rounded-full" aria-label="Закрыть ответ">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
          )}
          {!partnerId && (
            <div className="mb-3 rounded-2xl bg-sky-100/85 px-4 py-3 text-sm font-black text-sky-800 shadow-inner dark:bg-sky-500/15 dark:text-sky-100">
              У пары пока нет второго участника. Партнёр увидит сообщения после присоединения.
            </div>
          )}
          {pendingAttachments.length > 0 && (
            <div className="chat-reply-preview mb-3 flex gap-2 overflow-x-auto rounded-2xl bg-white/58 p-2 shadow-inner dark:bg-white/10">
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative w-28 shrink-0 overflow-hidden rounded-xl bg-white/75 shadow dark:bg-black/25"
                >
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(attachment.id)}
                    className="absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-sm font-black text-white"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                  {attachment.previewUrl ? (
                    attachment.type === "video" ? (
                      <video
                        src={attachment.previewUrl}
                        preload="metadata"
                        playsInline
                        className="h-20 w-full object-cover"
                        muted
                      />
                    ) : (
                      <div
                        className="h-20 w-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${attachment.previewUrl}")` }}
                        aria-label={attachment.file.name}
                      />
                    )
                  ) : (
                    <div className="grid h-20 place-items-center bg-sky-100 text-xs font-black text-[#0284c7] dark:bg-white/10 dark:text-white">
                      {attachment.type === "audio"
                        ? "VOICE"
                        : getFileIcon(attachment.file.name, attachment.file.type)}
                    </div>
                  )}
                  <div className="p-1.5">
                    <p className="truncate text-[10px] font-black">
                      {attachment.file.name}
                    </p>
                    <p className="text-[10px] font-semibold opacity-55">
                      {formatFileSize(attachment.file.size)}
                    </p>
                    {uploadProgress[attachment.id] > 0 && (
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-sky-100">
                        <div
                          className="h-full rounded-full bg-[#0284c7] transition-all"
                          style={{ width: `${uploadProgress[attachment.id]}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {stickerSuggestions.length > 0 && (
            <div className="chat-reply-preview mb-3 flex items-center gap-2 rounded-2xl border border-sky-100 bg-white/82 p-2 shadow-[0_16px_45px_rgba(2,132,199,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-black/35">
              <span className="px-2 text-xs font-black text-sky-600/70 dark:text-sky-100/60">
                Стикер?
              </span>
              <div className="flex gap-1">
                {stickerSuggestions.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => sendSticker(sticker)}
                    className="chat-sticker-hover h-12 w-12 rounded-xl bg-contain bg-center bg-no-repeat transition hover:bg-sky-50 dark:hover:bg-white/10"
                    style={{ backgroundImage: `url("${sticker.url}")` }}
                    aria-label={sticker.name}
                  />
                ))}
              </div>
            </div>
          )}
          {isRecording && (
            <div className="chat-reply-preview mb-3 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50/90 px-3 py-3 text-sky-700 shadow-[0_16px_45px_rgba(14,165,233,0.16)] dark:border-sky-400/20 dark:bg-sky-500/12 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-3 w-3 shrink-0 place-items-center rounded-full bg-sky-500 ${isRecordingPaused ? "" : "animate-pulse"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-black">
                    {isRecordingPaused ? "Запись на паузе" : "Идёт запись"}
                  </p>
                  <div className="mt-1 flex h-5 items-center gap-[2px]">
                    {Array.from({ length: 24 }).map((_, index) => (
                      <span
                        key={index}
                        className={`w-1 rounded-full bg-sky-500/70 ${isRecordingPaused ? "" : "chat-voice-wave"}`}
                        style={{
                          height: Math.max(5, 9 + Math.sin(index * 0.9) * 7),
                          animationDelay: `${index * 0.04}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-black shadow-inner dark:bg-black/25">
                  {formatAudioTime(recordingSeconds)}
                </span>
                <button type="button" onClick={toggleRecordingPause} className="rounded-full bg-white px-3 py-1.5 text-sm font-black shadow transition hover:-translate-y-0.5 dark:bg-black/25">
                  {isRecordingPaused ? "Продолжить" : "Пауза"}
                </button>
                <button type="button" onClick={cancelRecording} className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-black text-sky-700 shadow transition hover:-translate-y-0.5 dark:bg-black/25 dark:text-sky-100">
                  Отмена
                </button>
                <button type="button" onClick={stopRecording} className="rounded-full bg-sky-600 px-3 py-1.5 text-sm font-black text-white shadow transition hover:-translate-y-0.5">
                  Готово
                </button>
              </div>
            </div>
          )}
          {pickerMode && (
            <div
              ref={pickerRef}
              className="chat-picker-in fixed bottom-0 left-0 right-0 z-50 max-h-[76vh] overflow-hidden rounded-t-[1.75rem] border border-white/55 bg-white/96 p-3 text-[#075985] shadow-[0_-20px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#031b2e]/96 dark:text-white md:absolute md:bottom-[5.25rem] md:left-4 md:right-auto md:w-[25rem] md:rounded-[1.75rem]"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex rounded-2xl bg-sky-50 p-1 text-sm font-black shadow-inner dark:bg-white/8">
                <button
                  type="button"
                  onClick={() => setPickerMode("emoji")}
                  className={`relative flex-1 rounded-xl px-3 py-2 transition ${
                    pickerMode === "emoji" ? "bg-white text-[#0284c7] shadow dark:bg-white/12 dark:text-white" : "opacity-60"
                  }`}
                >
                  Emoji
                  {pickerMode === "emoji" && <span className="chat-tab-underline absolute bottom-0 left-8 right-8 h-0.5 rounded-full bg-[#0284c7]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode("stickers")}
                  className={`relative flex-1 rounded-xl px-3 py-2 transition ${
                    pickerMode === "stickers" ? "bg-white text-[#0284c7] shadow dark:bg-white/12 dark:text-white" : "opacity-60"
                  }`}
                >
                  Стикеры
                  {pickerMode === "stickers" && <span className="chat-tab-underline absolute bottom-0 left-8 right-8 h-0.5 rounded-full bg-[#0284c7]" />}
                </button>
              </div>

              {pickerMode === "emoji" ? (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  tone="sky"
                  multiple={!reactionTargetId}
                  autoFocus
                />
              ) : (
                <div>
                  <input
                    value={stickerSearch}
                    onChange={(event) => setStickerSearch(event.target.value)}
                    placeholder="Поиск стикеров"
                    className="mb-3 h-11 w-full rounded-2xl border border-sky-100 bg-white/85 px-4 text-sm font-bold outline-none shadow-inner transition focus:border-[#0ea5e9] focus:shadow-[0_0_0_4px_rgba(14,165,233,0.12)] dark:border-white/10 dark:bg-white/8"
                  />
                  <div className="max-h-[42vh] overflow-y-auto pr-1 md:max-h-72">
                    {visibleStickers.length === 0 ? (
                      <div className="grid h-36 place-items-center rounded-2xl bg-sky-50 text-sm font-black opacity-70 dark:bg-white/8">
                        {stickerSearch ? "Нет результатов" : "Стикеров пока нет"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {visibleStickers.map((sticker) => sticker && (
                          <div key={sticker.id} className="group relative">
                            <button
                              type="button"
                              onClick={() => sendSticker(sticker)}
                              className="chat-sticker-hover chat-sticker-send h-20 w-full rounded-2xl bg-contain bg-center bg-no-repeat transition hover:bg-sky-50 dark:hover:bg-white/8"
                              style={{ backgroundImage: `url("${sticker.url}")` }}
                              aria-label={sticker.name}
                            />
                            <button
                              type="button"
                              onClick={() => toggleFavoriteSticker(sticker.id)}
                              className={`absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-xs opacity-0 shadow transition group-hover:opacity-100 ${
                                favoriteStickerIds.includes(sticker.id)
                                  ? "bg-[#0284c7] text-white"
                                  : "bg-white/90 text-[#0284c7] dark:bg-black/70 dark:text-white"
                              }`}
                              aria-label="Избранное"
                            >
                              <Star aria-hidden="true" size={14} fill={favoriteStickerIds.includes(sticker.id) ? "currentColor" : "none"} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setStickerPreview({ id: sticker.id, url: sticker.url, type: "sticker", name: sticker.name, size: 0, mime_type: "image/webp" })}
                              className="absolute bottom-1 left-1 hidden rounded-full bg-black/45 px-2 py-1 text-[10px] font-black text-white opacity-0 shadow transition group-hover:opacity-100 md:block"
                              aria-label="Предпросмотр"
                            >
                              <Maximize2 aria-hidden="true" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1 overflow-x-auto rounded-2xl bg-sky-50 p-1 dark:bg-white/8">
                    <button type="button" onClick={() => setActiveStickerPack("recent")} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${activeStickerPack === "recent" ? "bg-white text-[#0284c7] shadow dark:bg-white/12 dark:text-white" : "opacity-60"}`} title="Недавние" aria-label="Недавние стикеры"><Clock3 aria-hidden="true" size={18} /></button>
                    <button type="button" onClick={() => setActiveStickerPack("favorites")} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${activeStickerPack === "favorites" ? "bg-white text-[#0284c7] shadow dark:bg-white/12 dark:text-white" : "opacity-60"}`} title="Избранные" aria-label="Избранные стикеры"><Star aria-hidden="true" size={18} /></button>
                    {stickerPacks.map((pack) => (
                      <button key={pack.id} type="button" onClick={() => setActiveStickerPack(pack.id)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg transition ${activeStickerPack === pack.id ? "bg-white text-[#0284c7] shadow dark:bg-white/12 dark:text-white" : "opacity-60"}`} title={pack.name}>
                        {pack.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="chat-composer-row flex min-w-0 items-end gap-1.5 md:gap-2">
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addPendingFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                addPendingFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.m4a,.mp3,.ogg,.wav,.webm"
              multiple
              className="hidden"
              onChange={(event) => {
                addPendingFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setReactionTargetId(null);
                setPickerMode((current) => (current === "emoji" ? null : "emoji"));
              }}
              className={`chat-quick-emoji order-1 grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] text-lg shadow-inner transition hover:-translate-y-0.5 md:h-12 md:w-12 md:rounded-[1rem] md:text-xl ${
                pickerMode === "emoji" ? "bg-[#0284c7] text-white" : "bg-white/85 dark:bg-white/10"
              }`}
              aria-label="Emoji"
            >
              <Smile aria-hidden="true" size={20} />
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setReactionTargetId(null);
                setPickerMode((current) => (current === "stickers" ? null : "stickers"));
              }}
              className={`chat-quick-stickers order-2 grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] text-lg shadow-inner transition hover:-translate-y-0.5 md:h-12 md:w-12 md:rounded-[1rem] md:text-xl ${
                pickerMode === "stickers" ? "bg-[#0284c7] text-white" : "bg-white/85 dark:bg-white/10"
              }`}
              aria-label="Стикеры"
            >
              <Sticker aria-hidden="true" size={20} />
            </button>
            <div className="relative order-4">
              <button type="button" onClick={() => setIsAttachMenuOpen((current) => !current)} className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] bg-white/85 text-lg shadow-inner transition hover:-translate-y-0.5 dark:bg-white/10 md:h-12 md:w-12 md:rounded-[1rem] md:text-xl" aria-label="Прикрепить файл">
              <Paperclip aria-hidden="true" size={20} />
              </button>
              {isAttachMenuOpen && (
                <div className="chat-menu-in absolute bottom-14 left-0 z-30 w-52 overflow-hidden rounded-2xl bg-white/95 p-2 text-[#075985] shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:bg-black/90 dark:text-white">
                  <button type="button" onClick={() => { setReactionTargetId(null); setPickerMode("emoji"); setIsAttachMenuOpen(false); }} className="chat-mobile-attach-option flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                    <Smile aria-hidden="true" size={18} /> Эмодзи
                  </button>
                  <button type="button" onClick={() => { setReactionTargetId(null); setPickerMode("stickers"); setIsAttachMenuOpen(false); }} className="chat-mobile-attach-option flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                    <Sticker aria-hidden="true" size={18} /> Стикеры
                  </button>
                  <button type="button" onClick={() => { mediaInputRef.current?.click(); setIsAttachMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                    <ImageIcon aria-hidden="true" size={18} /> Фото/Видео
                  </button>
                  <button type="button" onClick={() => { fileInputRef.current?.click(); setIsAttachMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                    <FileText aria-hidden="true" size={18} /> Файл
                  </button>
                  <button type="button" onClick={() => { audioInputRef.current?.click(); setIsAttachMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                    <Music2 aria-hidden="true" size={18} /> Аудиофайл
                  </button>
                  <button type="button" onClick={() => { if (isRecording) { stopRecording(); } else { startRecording(); } setIsAttachMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                    <Mic aria-hidden="true" size={18} /> Голосовое
                  </button>
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => {
                handleDraftChange(event.target.value);
                setDraftSelection({
                  start: event.currentTarget.selectionStart,
                  end: event.currentTarget.selectionEnd,
                });
              }}
              onSelect={(event) =>
                setDraftSelection({
                  start: event.currentTarget.selectionStart,
                  end: event.currentTarget.selectionEnd,
                })
              }
              onKeyDown={handleDraftKeyDown}
              placeholder="Напишите сообщение..."
              rows={1}
              maxLength={1000}
              className="chat-composer-input order-3 max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-[1rem] border border-sky-200/70 bg-white/86 px-3 py-2.5 text-sm font-semibold text-[#075985] outline-none shadow-inner transition placeholder:text-sky-400/70 focus:border-[#0ea5e9] focus:shadow-[0_0_0_5px_rgba(14,165,233,0.14)] dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/38 md:max-h-36 md:min-h-12 md:rounded-[1.25rem] md:px-4 md:py-3 md:text-base"
            />
            {draft.trim() || editingId || pendingAttachments.length > 0 ? (
              <button type="submit" disabled={isSending} aria-label="Отправить сообщение" className={`order-5 grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-xl font-black text-white shadow-[0_16px_42px_rgba(2,132,199,0.34)] transition hover:-translate-y-0.5 disabled:opacity-45 md:h-12 md:w-12 md:rounded-[1rem] md:text-2xl ${isSending ? "chat-send-pulse" : ""}`}>
                <Send aria-hidden="true" size={20} />
              </button>
            ) : (
              <button type="button" onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? "Остановить запись" : "Записать голосовое"} className={`order-5 grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] text-lg font-black text-white shadow-[0_16px_42px_rgba(2,132,199,0.28)] transition hover:-translate-y-0.5 md:h-12 md:w-12 md:rounded-[1rem] md:text-xl ${isRecording ? "bg-sky-600 animate-pulse" : "bg-[#0284c7]"}`}>
                {isRecording ? <Square aria-hidden="true" size={18} fill="currentColor" /> : <Mic aria-hidden="true" size={20} />}
              </button>
            )}
          </div>
        </form>

        {menuMessage && (
          <div className="absolute inset-0 z-40 bg-black/12 backdrop-blur-[2px]" onClick={() => setMenuMessageId(null)}>
            <div className="chat-menu-in absolute bottom-24 left-4 right-4 mx-auto max-w-md overflow-hidden rounded-[1.5rem] bg-white/94 p-2 text-[#075985] shadow-[0_24px_80px_rgba(0,0,0,0.22)] dark:bg-black/88 dark:text-white" onClick={(event) => event.stopPropagation()}>
              <div className="grid grid-cols-4 gap-1 border-b border-sky-100 p-2 dark:border-white/10">
                {reactions.map((emoji) => (
                  <button key={emoji} onClick={() => toggleReaction(menuMessage, emoji)} className="rounded-2xl p-2 text-2xl transition hover:bg-sky-50 dark:hover:bg-white/10">
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setReactionTargetId(menuMessage.id);
                    setPickerMode("emoji");
                    setMenuMessageId(null);
                  }}
                  className="rounded-2xl p-2 text-2xl font-black transition hover:bg-sky-50 dark:hover:bg-white/10"
                >
                  +
                </button>
              </div>
              <button onClick={() => startReply(menuMessage)} className="w-full rounded-2xl px-4 py-3 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">Ответить</button>
              {menuMessage.sender_id === currentUserId && !menuMessage.deleted_for_everyone && (
                <button onClick={() => startEdit(menuMessage)} className="w-full rounded-2xl px-4 py-3 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">Редактировать</button>
              )}
              <button onClick={() => updateMessage(menuMessage.id, { pinned_at: menuMessage.pinned_at ? null : new Date().toISOString() }).then(() => setMenuMessageId(null))} className="w-full rounded-2xl px-4 py-3 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">
                {menuMessage.pinned_at ? "Открепить" : "Закрепить"}
              </button>
              <button onClick={() => deleteForMe(menuMessage)} className="w-full rounded-2xl px-4 py-3 text-left font-black hover:bg-sky-50 dark:hover:bg-white/10">Удалить у себя</button>
              {menuMessage.sender_id === currentUserId && (
                <button onClick={() => deleteForEveryone(menuMessage)} className="w-full rounded-2xl px-4 py-3 text-left font-black text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10">Удалить у всех</button>
              )}
            </div>
          </div>
        )}
      </section>

      {isProfilePanelOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/28 backdrop-blur-sm md:grid md:place-items-stretch"
          onClick={() => setIsProfilePanelOpen(false)}
        >
          <aside
            className="chat-profile-panel ml-auto flex h-full w-full flex-col overflow-hidden bg-[#e0f2fe] text-[#075985] shadow-[0_0_80px_rgba(0,0,0,0.22)] dark:bg-[#041725] dark:text-white md:w-[28rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden px-5 pb-6 pt-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(14,165,233,0.36),transparent_35%),linear-gradient(135deg,rgba(2,132,199,0.16),rgba(3,105,161,0.08))]" />
              <div className="relative flex items-center justify-between">
                <button
                  onClick={() => setIsProfilePanelOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/65 text-xl font-black shadow-inner backdrop-blur dark:bg-black/30"
                >
                  <ArrowLeft aria-hidden="true" size={20} />
                </button>
                <button
                  onClick={() => setIsProfilePanelOpen(false)}
                  className="hidden h-10 w-10 place-items-center rounded-full bg-white/65 text-xl font-black shadow-inner backdrop-blur dark:bg-black/30 md:grid"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </div>

              <div className="relative mt-5 flex flex-col items-center text-center">
                <div className="chat-avatar-in relative">
                  <div className="absolute inset-[-18px] rounded-full bg-sky-400/30 blur-2xl" />
                  {partnerProfile.avatar ? (
                    <Image
                      src={partnerProfile.avatar}
                      alt={partnerProfile.name}
                      width={112}
                      height={112}
                      sizes="112px"
                      className="relative h-28 w-28 rounded-full object-cover ring-4 ring-white/70"
                    />
                  ) : (
                    <div className="relative grid h-28 w-28 place-items-center rounded-full bg-white/70 text-5xl font-black shadow-2xl ring-4 ring-white/70 dark:bg-white/10">
                      {getInitial(partnerProfile.name)}
                    </div>
                  )}
                </div>
                <h2 className="mt-4 text-3xl font-black">{partnerProfile.name}</h2>
                <p className="mt-1 text-sm font-black text-sky-600/70 dark:text-sky-100/65">
                  {isPartnerTyping
                    ? "печатает..."
                    : partnerLastSeen
                      ? `был(а) в сети ${formatMessageTime(partnerLastSeen)}`
                      : "личный чат пары"}
                </p>
              </div>
            </div>

            <div className="border-b border-sky-100/80 px-3 dark:border-white/10">
              <div className="flex gap-1 overflow-x-auto">
                {[
                  ["media", "Медиа"],
                  ["files", "Файлы"],
                  ["links", "Ссылки"],
                  ["voices", "Голосовые"],
                  ["gifs", "GIF"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveProfileTab(tab as ProfileTab);
                      setProfileTabLimit(24);
                    }}
                    className={`relative shrink-0 px-3 py-3 text-sm font-black transition ${
                      activeProfileTab === tab
                        ? "text-[#0284c7] dark:text-sky-100"
                        : "opacity-55 hover:opacity-90"
                    }`}
                  >
                    {label}
                    {activeProfileTab === tab && (
                      <span className="chat-tab-underline absolute bottom-0 left-3 right-3 h-1 rounded-full bg-[#0284c7]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeProfileTab === "media" || activeProfileTab === "gifs" ? (
                <div>
                  {(profileItems[activeProfileTab].length === 0) ? (
                    <div className="grid h-64 place-items-center rounded-3xl bg-white/55 text-center font-black shadow-inner dark:bg-white/8">
                      {activeProfileTab === "gifs" ? "GIF пока нет" : "Медиа пока нет"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1">
                      {profileItems[activeProfileTab].slice(0, profileTabLimit).map((item) => {
                        const attachment = item.attachment;
                        if (!attachment) return null;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (attachment.type === "video") {
                                window.open(attachment.url, "_blank", "noreferrer");
                                return;
                              }
                              openProfileMediaViewer(item);
                            }}
                            className="group relative aspect-square overflow-hidden rounded-md bg-white/45 shadow-inner dark:bg-white/8"
                          >
                            {attachment.type === "video" ? (
                              <video src={attachment.url} preload="none" playsInline className="h-full w-full object-cover" muted />
                            ) : (
                              <Image src={attachment.url} alt={attachment.name} width={180} height={180} sizes="25vw" className="h-full w-full object-cover transition group-hover:scale-105" />
                            )}
                            {attachment.type === "video" && (
                              <span className="absolute inset-0 grid place-items-center bg-black/20 text-white"><Play aria-hidden="true" size={24} fill="currentColor" /></span>
                            )}
                            <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/18" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {activeProfileTab === "files" && (
                <div className="space-y-2">
                  {profileItems.files.length === 0 ? (
                    <div className="grid h-64 place-items-center rounded-3xl bg-white/55 text-center font-black shadow-inner dark:bg-white/8">Файлов пока нет</div>
                  ) : profileItems.files.slice(0, profileTabLimit).map((item) => {
                    const attachment = item.attachment;
                    if (!attachment) return null;
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/65 p-3 shadow-inner dark:bg-white/8">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#0284c7] text-[10px] font-black text-white">{getFileIcon(attachment.name, attachment.mime_type)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black">{attachment.name}</p>
                          <p className="text-xs font-semibold opacity-55">{formatFileSize(attachment.size)} · {formatDay(item.createdAt)}</p>
                        </div>
                        <a href={attachment.url} target="_blank" rel="noreferrer" aria-label="Открыть файл" className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#0284c7] shadow dark:bg-black/30"><ExternalLink aria-hidden="true" size={16} /></a>
                        <button onClick={() => scrollToMessage(item.messageId)} aria-label="Перейти к сообщению" className="grid h-9 w-9 place-items-center rounded-full bg-sky-100 text-[#0284c7] shadow-inner dark:bg-white/10 dark:text-white"><ArrowDown aria-hidden="true" size={16} /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeProfileTab === "links" && (
                <div className="space-y-3">
                  {profileItems.links.length === 0 ? (
                    <div className="grid h-64 place-items-center rounded-3xl bg-white/55 text-center font-black shadow-inner dark:bg-white/8">Ссылок пока нет</div>
                  ) : profileItems.links.slice(0, profileTabLimit).map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/65 p-3 shadow-inner dark:bg-white/8">
                      {item.url && <LinkPreviewCard url={item.url} isMine={false} />}
                      <div className="mt-2 flex items-center justify-between text-xs font-black opacity-60">
                        <span>{formatDay(item.createdAt)}</span>
                        <button onClick={() => scrollToMessage(item.messageId)} className="rounded-full bg-sky-100 px-3 py-1.5 text-[#0284c7] dark:bg-white/10 dark:text-white">Перейти к сообщению</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeProfileTab === "voices" && (
                <div className="space-y-2">
                  {profileItems.voices.length === 0 ? (
                    <div className="grid h-64 place-items-center rounded-3xl bg-white/55 text-center font-black shadow-inner dark:bg-white/8">Голосовых пока нет</div>
                  ) : profileItems.voices.slice(0, profileTabLimit).map((item) => {
                    const attachment = item.attachment;
                    if (!attachment) return null;
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/65 p-3 shadow-inner dark:bg-white/8">
                        <button onClick={() => toggleAudio(item.id)} aria-label={playingAudioId === item.id ? "Пауза" : "Воспроизвести"} className="grid h-11 w-11 place-items-center rounded-full bg-[#0284c7] text-white shadow">{playingAudioId === item.id ? <Pause aria-hidden="true" size={17} fill="currentColor" /> : <Play aria-hidden="true" size={17} fill="currentColor" />}</button>
                        <div className="min-w-0 flex-1">
                          <div className="flex h-7 items-center gap-[2px]">
                            {Array.from({ length: 32 }).map((_, index) => (
                              <span key={index} className="w-1 rounded-full bg-[#0284c7]/55" style={{ height: Math.max(5, 10 + Math.sin(index * 0.8) * 8) }} />
                            ))}
                          </div>
                          <p className="text-xs font-semibold opacity-55">{formatDay(item.createdAt)}</p>
                        </div>
                        <audio ref={(node) => { audioRefs.current[item.id] = node; }} src={attachment.url} preload="none" className="hidden" onEnded={() => setPlayingAudioId(null)} />
                        <button onClick={() => scrollToMessage(item.messageId)} aria-label="Перейти к сообщению" className="grid h-9 w-9 place-items-center rounded-full bg-sky-100 text-[#0284c7] shadow-inner dark:bg-white/10 dark:text-white"><ArrowDown aria-hidden="true" size={16} /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              {profileItems[activeProfileTab].length > profileTabLimit && (
                <button
                  onClick={() => setProfileTabLimit((current) => current + 24)}
                  className="mt-4 w-full rounded-2xl bg-[#0284c7] px-4 py-3 font-black text-white shadow-lg"
                >
                  Показать ещё
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {viewerMessage?.attachment_url && (
        <div className="chat-viewer-in fixed inset-0 z-[70] grid place-items-center bg-black/88 p-4" onClick={() => setViewerMessage(null)}>
          <button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white" aria-label="Закрыть просмотр"><X aria-hidden="true" size={22} /></button>
          {profileMediaItems.length > 1 && profileMediaItems.some((item) => item.attachment?.url === viewerMessage.attachment_url) && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextViewerMedia(-1);
                }}
                className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/14 text-3xl font-black text-white backdrop-blur transition hover:bg-white/24"
              >
                <ChevronLeft aria-hidden="true" size={28} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextViewerMedia(1);
                }}
                className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/14 text-3xl font-black text-white backdrop-blur transition hover:bg-white/24"
              >
                <ChevronRight aria-hidden="true" size={28} />
              </button>
            </>
          )}
          {viewerMessage.attachment_type === "image" && (
            <Image src={viewerMessage.attachment_url} alt={viewerMessage.attachment_name || "Фото"} width={1400} height={1000} sizes="100vw" className="max-h-[86vh] w-auto rounded-3xl object-contain shadow-2xl" />
          )}
        </div>
      )}
      {stickerPreview && (
        <div className="chat-viewer-in fixed inset-0 z-[70] grid place-items-center bg-black/88 p-4" onClick={() => setStickerPreview(null)}>
          <button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/12 text-white" aria-label="Закрыть просмотр"><X aria-hidden="true" size={22} /></button>
          <div
            className="h-[min(70vw,26rem)] w-[min(70vw,26rem)] bg-contain bg-center bg-no-repeat drop-shadow-[0_28px_80px_rgba(255,255,255,0.18)]"
            style={{ backgroundImage: `url("${stickerPreview.url}")` }}
            aria-label={stickerPreview.name}
          />
        </div>
      )}
    </main>
  );
}
