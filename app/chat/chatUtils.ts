import { fluentEmojiUrl } from "@/components/FluentEmoji";
import { toBrowserSupabaseUrl } from "@/lib/supabaseUrls";
import type { ChatAttachment, ChatMessage, StickerPack } from "./chatTypes";

export const chatSelect =
  "id, couple_id, sender_id, body, created_at, edited_at, read_at, reply_to_id, reactions, attachment_url, attachment_type, attachment_name, attachments, pinned_at, deleted_for, deleted_for_everyone";
export const draftStoragePrefix = "couple-space:chat-draft:";
export const recentStickerStorageKey = "couple-space:chat-recent-stickers";
export const favoriteStickerStorageKey = "couple-space:chat-favorite-stickers";
export const externalChatDraftKey = "couple-space:chat-draft";
export const CHAT_PAGE_SIZE = 80;
export const maxMediaSize = 25 * 1024 * 1024;
export const maxFileSize = 50 * 1024 * 1024;

export const stickerPacks: StickerPack[] = [
  {
    id: "love",
    name: "Love",
    icon: "💘",
    stickers: [
      { id: "love-1", name: "Влюбленность", emoji: "🥰", url: fluentEmojiUrl("🥰") },
      { id: "love-2", name: "Сердца в глазах", emoji: "😍", url: fluentEmojiUrl("😍") },
      { id: "love-3", name: "Поцелуй", emoji: "😘", url: fluentEmojiUrl("😘") },
      { id: "love-4", name: "Сердце", emoji: "💖", url: fluentEmojiUrl("💖") },
      { id: "love-5", name: "Письмо", emoji: "💌", url: fluentEmojiUrl("💌") },
      { id: "love-6", name: "Два сердца", emoji: "💕", url: fluentEmojiUrl("💕") },
    ],
  },
  {
    id: "mood",
    name: "Mood",
    icon: "🥳",
    stickers: [
      { id: "mood-1", name: "Смех", emoji: "😂", url: fluentEmojiUrl("😂") },
      { id: "mood-2", name: "Вечеринка", emoji: "🥳", url: fluentEmojiUrl("🥳") },
      { id: "mood-3", name: "Круто", emoji: "😎", url: fluentEmojiUrl("😎") },
      { id: "mood-4", name: "Ого", emoji: "😮", url: fluentEmojiUrl("😮") },
      { id: "mood-5", name: "Сон", emoji: "😴", url: fluentEmojiUrl("😴") },
      { id: "mood-6", name: "Плач", emoji: "😭", url: fluentEmojiUrl("😭") },
    ],
  },
  {
    id: "cute",
    name: "Cute",
    icon: "🧸",
    stickers: [
      { id: "cute-1", name: "Просьба", emoji: "🥺", url: fluentEmojiUrl("🥺") },
      { id: "cute-2", name: "Обнимашки", emoji: "🤗", url: fluentEmojiUrl("🤗") },
      { id: "cute-3", name: "Кот", emoji: "🐱", url: fluentEmojiUrl("🐱") },
      { id: "cute-4", name: "Пёс", emoji: "🐶", url: fluentEmojiUrl("🐶") },
      { id: "cute-5", name: "Единорог", emoji: "🦄", url: fluentEmojiUrl("🦄") },
      { id: "cute-6", name: "Подарок", emoji: "🎁", url: fluentEmojiUrl("🎁") },
    ],
  },
];

export const allStickers = stickerPacks.flatMap((pack) =>
  pack.stickers.map((sticker) => ({ ...sticker, packId: pack.id }))
);

export function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}

export function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
}

export function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "♡";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getFileIcon(fileName: string, mimeType?: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (mimeType?.includes("pdf") || extension === "pdf") return "PDF";
  if (["doc", "docx"].includes(extension || "")) return "DOC";
  if (["zip", "rar", "7z"].includes(extension || "")) return "ZIP";
  if (["xls", "xlsx", "csv"].includes(extension || "")) return "XLS";
  if (["ppt", "pptx"].includes(extension || "")) return "PPT";
  return "FILE";
}

export function extractFirstUrl(text: string) {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] || null;
}

export function getMessageAttachments(message: ChatMessage): ChatAttachment[] {
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

export function isGifAttachment(attachment: ChatAttachment) {
  return (
    attachment.type === "image" &&
    (attachment.mime_type.toLowerCase().includes("gif") ||
      attachment.name.toLowerCase().endsWith(".gif"))
  );
}

export function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function readStoredStringList(key: string) {
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

export function isSingleEmojiText(text?: string | null) {
  const value = text?.trim();
  if (!value) return false;
  return /^\p{Extended_Pictographic}\uFE0F?$/u.test(value);
}

export function isMessageVisible(message: ChatMessage, currentUserId: string | null) {
  if (!currentUserId || message.deleted_for_everyone) return false;
  return !(message.deleted_for || []).includes(currentUserId);
}

export function formatPartnerLastSeen(value?: string | null) {
  if (!value) return "время посещения неизвестно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "время посещения неизвестно";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = formatMessageTime(value);
  if (date.toDateString() === today.toDateString()) return `был(а) в ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `был(а) вчера в ${time}`;
  const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
  return `был(а) ${day} в ${time}`;
}
