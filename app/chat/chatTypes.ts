export type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

export type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

export type ChatReaction = {
  emoji: string;
  user_id: string;
};

export type ChatAttachment = {
  id: string;
  url: string;
  type: "image" | "video" | "audio" | "file" | "sticker";
  name: string;
  size: number;
  mime_type: string;
};

export type PendingAttachment = {
  id: string;
  file: File;
  type: ChatAttachment["type"];
  previewUrl: string | null;
};

export type LinkPreviewData = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  domain: string;
};

export type ProfileTab = "media" | "files" | "links" | "voices" | "gifs";

export type ProfileAttachmentItem = {
  id: string;
  messageId: string;
  createdAt: string;
  attachment?: ChatAttachment;
  url?: string;
  body?: string | null;
};

export type StickerPack = {
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

export type ChatMessage = {
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
