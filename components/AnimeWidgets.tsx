"use client";

import { animate, createTimeline, stagger } from "animejs";
import { useEffect, useMemo, useRef, useState } from "react";

type CountUpProps = {
  value: number | string | null | undefined;
  className?: string;
};

function canAnimateNumber(value: CountUpProps["value"]): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({ value, className }: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(() => (canAnimateNumber(value) ? value : 0));
  const previousValueRef = useRef(canAnimateNumber(value) ? value : 0);

  useEffect(() => {
    if (!canAnimateNumber(value) || isReducedMotion()) return undefined;

    const counter = { value: previousValueRef.current };
    const animation = animate(counter, {
      value,
      duration: 900,
      ease: "out(3)",
      onUpdate: () => setDisplayValue(Math.round(counter.value)),
    });
    previousValueRef.current = value;

    return () => {
      const controls = animation as { pause?: () => void; revert?: () => void };
      controls.pause?.();
      controls.revert?.();
    };
  }, [value]);

  return <span className={className}>{canAnimateNumber(value) ? displayValue : value ?? 0}</span>;
}

type AnimatedTextProps = {
  text: string;
  className?: string;
};

export function AnimatedText({ text, className }: AnimatedTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const words = useMemo(() => text.split(" "), [text]);

  useEffect(() => {
    if (!ref.current || isReducedMotion()) return undefined;
    const targets = Array.from(ref.current.querySelectorAll("[data-anime-word]"));
    const animation = animate(targets, {
      opacity: [0, 1],
      translateY: [12, 0],
      rotateX: [-18, 0],
      duration: 520,
      ease: "out(3)",
      delay: stagger(42),
    });

    return () => {
      const controls = animation as { pause?: () => void; revert?: () => void };
      controls.pause?.();
      controls.revert?.();
    };
  }, [text]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} data-anime-word className="anime-word">
          {word}
          {index < words.length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </span>
  );
}

type RelationshipJourneyProps = {
  daysTogether: number;
  activity: number;
  className?: string;
};

export function RelationshipJourney({ daysTogether, activity, className }: RelationshipJourneyProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const dotRef = useRef<SVGCircleElement | null>(null);
  const progress = Math.max(0.12, Math.min(1, (daysTogether + activity) / 365));

  useEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot || isReducedMotion()) return undefined;

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    const marker = { value: 0 };
    const timeline = createTimeline({
      defaults: { ease: "out(3)" },
    });

    timeline
      .add(path, {
        strokeDashoffset: [length, length * (1 - progress)],
        duration: 1100,
      })
      .add(
        marker,
        {
          value: progress,
          duration: 1100,
          onUpdate: () => {
            const point = path.getPointAtLength(length * marker.value);
            dot.setAttribute("cx", String(point.x));
            dot.setAttribute("cy", String(point.y));
          },
        },
        0,
      );

    return () => {
      const controls = timeline as { pause?: () => void; revert?: () => void };
      controls.pause?.();
      controls.revert?.();
    };
  }, [progress]);

  return (
    <div className={className}>
      <svg viewBox="0 0 520 150" role="img" aria-label="Путь пары" className="anime-journey-svg">
        <path
          d="M18 118 C 82 28, 160 28, 222 92 S 338 150, 405 75 S 478 15, 502 48"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          ref={pathRef}
          d="M18 118 C 82 28, 160 28, 222 92 S 338 150, 405 75 S 478 15, 502 48"
          fill="none"
          stroke="url(#journeyGradient)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle ref={dotRef} cx="18" cy="118" r="13" fill="#fff" stroke="#fb7185" strokeWidth="6" />
        <defs>
          <linearGradient id="journeyGradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="52%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-wide opacity-70">
        <span>Начало</span>
        <span>{daysTogether || 0} дней</span>
        <span>{activity || 0} действий</span>
      </div>
    </div>
  );
}

type PulseBurstProps = {
  trigger: number;
  glyph?: string;
};

export function PulseBurst({ trigger, glyph = "✦" }: PulseBurstProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || trigger === 0 || isReducedMotion()) return undefined;
    const particles = Array.from(ref.current.querySelectorAll("span"));
    const animation = animate(particles, {
      opacity: [0, 1, 0],
      scale: [0.2, 1, 0.25],
      translateX: (_target: unknown, index: number) => Math.cos((Math.PI * 2 * index) / particles.length) * 34,
      translateY: (_target: unknown, index: number) => Math.sin((Math.PI * 2 * index) / particles.length) * 34,
      duration: 680,
      ease: "out(3)",
      delay: stagger(18),
    });

    return () => {
      const controls = animation as { pause?: () => void; revert?: () => void };
      controls.pause?.();
      controls.revert?.();
    };
  }, [glyph, trigger]);

  if (trigger === 0) return null;

  return (
    <div ref={ref} className="pointer-events-none absolute inset-1/2 z-20 h-0 w-0" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} className="anime-inline-particle">
          {index % 2 === 0 ? glyph : "✦"}
        </span>
      ))}
    </div>
  );
}
