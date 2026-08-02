"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

    return () => {
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("ended", stop);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("play", start);
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
    <div className={`accent-audio-player ${className}`} style={style}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlayback}
        className="accent-audio-play"
        aria-label={isPlaying ? `Приостановить: ${label}` : `Воспроизвести: ${label}`}
      >
        {isPlaying ? <Pause aria-hidden="true" fill="currentColor" /> : <Play aria-hidden="true" fill="currentColor" />}
      </button>
      <div className="accent-audio-content">
        <div className="accent-audio-wave" aria-hidden="true">
          {Array.from({ length: 34 }, (_, index) => (
            <span key={index} style={{ height: `${28 + ((index * 17) % 66)}%` }} />
          ))}
        </div>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const audio = audioRef.current;
            if (!audio) return;
            const nextTime = Number(event.target.value);
            audio.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
          className="accent-audio-seek"
          aria-label={`Позиция: ${label}`}
        />
        <div className="accent-audio-time">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{duration > 0 ? formatAudioTime(duration) : "–:––"}</span>
        </div>
      </div>
    </div>
  );
}
