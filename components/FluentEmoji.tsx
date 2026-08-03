"use client";

/* eslint-disable @next/next/no-img-element -- Fluent Emoji uses thousands of small local assets that should not pass through image optimization. */

import emojiRegex from "emoji-regex";
import { type CSSProperties, type ReactNode, useState } from "react";

function emojiAssetName(emoji: string) {
  return Array.from(emoji)
    .map((symbol) => symbol.codePointAt(0)?.toString(16).padStart(4, "0"))
    .filter(Boolean)
    .join("-");
}

export function fluentEmojiUrl(emoji: string) {
  return `/fluent-emoji/3d/${emojiAssetName(emoji)}.webp`;
}

export function FluentEmoji({
  emoji,
  label,
  size = "1em",
  className = "",
  decorative = false,
}: {
  emoji: string;
  label?: string;
  size?: number | string;
  className?: string;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const style = { "--fluent-emoji-size": typeof size === "number" ? `${size}px` : size } as CSSProperties;

  if (failed) {
    return (
      <span className={`fluent-emoji-fallback ${className}`} style={style} aria-hidden={decorative || undefined}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={fluentEmojiUrl(emoji)}
      alt={decorative ? "" : label || emoji}
      title={decorative ? undefined : label}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`fluent-emoji ${className}`}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

export function FluentEmojiText({
  children,
  className = "",
}: {
  children: string | null | undefined;
  className?: string;
}) {
  const value = children || "";
  const matcher = emojiRegex();
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(matcher)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(value.slice(cursor, index));
    nodes.push(<FluentEmoji key={`${index}-${match[0]}`} emoji={match[0]} decorative />);
    cursor = index + match[0].length;
  }

  if (cursor < value.length) nodes.push(value.slice(cursor));

  return <span className={className}>{nodes}</span>;
}
