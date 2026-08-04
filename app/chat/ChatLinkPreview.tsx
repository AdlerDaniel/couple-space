"use client";

import { authorizedFetch } from "@/lib/authorizedFetch";
import { useEffect, useState } from "react";
import type { LinkPreviewData } from "./chatTypes";

export function ChatLinkPreview({ url, isMine }: { url: string; isMine: boolean }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadPreview() {
      setIsLoading(true);
      try {
        const response = await authorizedFetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
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
        if (!ignore) setIsLoading(false);
      }
    }
    void loadPreview();
    return () => {
      ignore = true;
    };
  }, [url]);

  if (isLoading) {
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
        isMine ? "border-white/70 bg-white/14" : "border-sky-400 bg-white/8"
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
        <p className="truncate text-[11px] font-black uppercase opacity-50">{preview.domain}</p>
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
