"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

const peakCache = new Map<string, Promise<number[]>>();
const PEAK_COUNT = 56;

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function decodeAudioPeaks(src: string) {
  const cached = peakCache.get(src);
  if (cached) return cached;

  const request = (async () => {
    const response = await fetch(src);
    if (!response.ok) throw new Error("Audio unavailable");
    const bytes = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    try {
      const buffer = await context.decodeAudioData(bytes.slice(0));
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
      const blockSize = Math.max(1, Math.floor(buffer.length / PEAK_COUNT));
      const raw = Array.from({ length: PEAK_COUNT }, (_, peakIndex) => {
        const start = peakIndex * blockSize;
        const end = Math.min(buffer.length, start + blockSize);
        let sum = 0;
        let samples = 0;
        for (let offset = start; offset < end; offset += Math.max(1, Math.floor(blockSize / 180))) {
          let mixed = 0;
          for (const channel of channels) mixed += Math.abs(channel[offset] || 0);
          sum += mixed / channels.length;
          samples += 1;
        }
        return samples ? sum / samples : 0;
      });
      const max = Math.max(...raw, 0.01);
      return raw.map((value) => Math.max(0.12, Math.min(1, Math.sqrt(value / max))));
    } finally {
      void context.close();
    }
  })();

  peakCache.set(src, request);
  request.catch(() => peakCache.delete(src));
  return request;
}

export default function AccentAudioPlayer({
  src,
  accent = "#2563eb",
  label = "Голосовое сообщение",
  className = "",
}: {
  src: string;
  accent?: string;
  label?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const syncTime = () => setCurrentTime(audio.currentTime || 0);
    const stop = () => setIsPlaying(false);
    const start = () => setIsPlaying(true);

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("ended", stop);
    audio.addEventListener("pause", stop);
    audio.addEventListener("play", start);
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("ended", stop);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("play", start);
    };
  }, [src]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const load = () => {
      void decodeAudioPeaks(src)
        .then((values) => { if (!cancelled) setPeaks(values); })
        .catch(() => {
          if (!cancelled) setPeaks(Array.from({ length: PEAK_COUNT }, (_, index) => 0.28 + ((index * 13) % 28) / 100));
        });
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      load();
    }, { rootMargin: "240px" });
    observer.observe(root);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const style = {
    "--audio-accent": accent,
    "--audio-progress": `${progress}%`,
  } as CSSProperties;

  return (
    <div ref={rootRef} className={`accent-audio-player ${className}`} style={style}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button type="button" onClick={togglePlayback} className="accent-audio-play" aria-label={isPlaying ? `Приостановить: ${label}` : `Воспроизвести: ${label}`}>
        {isPlaying ? <Pause aria-hidden="true" fill="currentColor" /> : <Play aria-hidden="true" fill="currentColor" />}
      </button>
      <div className="accent-audio-content">
        <div className="accent-audio-wave" aria-hidden="true">
          {(peaks.length ? peaks : Array.from({ length: PEAK_COUNT }, () => 0.22)).map((peak, index) => (
            <span key={index} className={(index / PEAK_COUNT) * 100 <= progress ? "is-played" : ""} style={{ height: `${Math.round(20 + peak * 80)}%` }} />
          ))}
        </div>
        <input type="range" min="0" max={duration || 0} step="0.05" value={Math.min(currentTime, duration || 0)} onChange={(event) => {
          const audio = audioRef.current;
          if (!audio) return;
          const nextTime = Number(event.target.value);
          audio.currentTime = nextTime;
          setCurrentTime(nextTime);
        }} className="accent-audio-seek" aria-label={`Позиция: ${label}`} />
        <div className="accent-audio-time">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{duration > 0 ? formatAudioTime(duration) : "–:––"}</span>
        </div>
      </div>
    </div>
  );
}
