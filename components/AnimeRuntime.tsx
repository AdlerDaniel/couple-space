"use client";

import { useEffect } from "react";

type AnimeModule = typeof import("animejs");

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function shouldSkipEnhancedMotion() {
  const navigatorWithHints = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };

  return (
    reducedMotion() ||
    window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ||
    navigatorWithHints.connection?.saveData === true ||
    (navigatorWithHints.deviceMemory !== undefined && navigatorWithHints.deviceMemory <= 4) ||
    navigator.hardwareConcurrency <= 4
  );
}

function createBurst(
  x: number,
  y: number,
  glyph: string,
  { animate, stagger }: Pick<AnimeModule, "animate" | "stagger">,
) {
  const layer = document.createElement("div");
  layer.className = "anime-burst-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const particles = Array.from({ length: 9 }, (_, index) => {
    const particle = document.createElement("span");
    particle.className = "anime-burst-particle";
    particle.textContent = index % 3 === 0 ? glyph : "*";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    layer.appendChild(particle);
    return particle;
  });

  animate(particles, {
    opacity: [0, 1, 0],
    scale: [0.45, 1, 0.35],
    translateX: (_target: unknown, index: number) => Math.cos((Math.PI * 2 * index) / particles.length) * (34 + index * 4),
    translateY: (_target: unknown, index: number) => Math.sin((Math.PI * 2 * index) / particles.length) * (34 + index * 4),
    rotate: (_target: unknown, index: number) => index * 38,
    duration: 760,
    ease: "out(3)",
    delay: stagger(18),
    onComplete: () => layer.remove(),
  });
}

function initDraggableCard(card: HTMLElement, animate: AnimeModule["animate"]) {
  if (card.dataset.animeDragReady === "true") return;
  card.dataset.animeDragReady = "true";
  card.classList.add("anime-draggable-card");

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;

  card.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("a,button,input,select,textarea")) return;
    isDragging = true;
    startX = event.clientX - currentX;
    startY = event.clientY - currentY;
    card.setPointerCapture(event.pointerId);
    card.classList.add("anime-dragging");
  });

  card.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    currentX = event.clientX - startX;
    currentY = event.clientY - startY;
    const rotate = Math.max(-7, Math.min(7, currentX / 18));
    card.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(${rotate}deg)`;
  });

  function endDrag(event: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    if (card.hasPointerCapture(event.pointerId)) {
      card.releasePointerCapture(event.pointerId);
    }
    card.classList.remove("anime-dragging");
    currentX = 0;
    currentY = 0;
    animate(card, {
      translateX: 0,
      translateY: 0,
      rotate: 0,
      duration: 520,
      ease: "out(4)",
      onComplete: () => {
        card.style.transform = "";
      },
    });
  }

  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);
}

function scheduleIdle(callback: () => void) {
  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const id = idleWindow.requestIdleCallback(callback, { timeout: 1400 });
    return () => idleWindow.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 900);
  return () => window.clearTimeout(id);
}

export default function AnimeRuntime() {
  useEffect(() => {
    if (shouldSkipEnhancedMotion()) return undefined;

    let disposed = false;
    let animePromise: Promise<AnimeModule> | null = null;
    const loadAnime = () => {
      animePromise ||= import("animejs");
      return animePromise;
    };

    const cancelIdle = scheduleIdle(async () => {
      const { animate } = await loadAnime();
      if (disposed) return;
      document
        .querySelectorAll<HTMLElement>("[data-anime-draggable]")
        .forEach((card) => initDraggableCard(card, animate));
    });

    const handleClick = async (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-anime-press], [data-anime-burst], .ui-button, .ui-button-secondary, .chat-reaction-pill",
      );
      if (!target) return;

      const anime = await loadAnime();
      if (disposed || !target.isConnected) return;

      anime.animate(target, {
        scale: [1, 0.97, 1],
        duration: 180,
        ease: "out(3)",
      });

      if (target.matches("[data-anime-burst], .chat-reaction-pill")) {
        const glyph = target.dataset.animeBurst || target.textContent?.trim().slice(0, 4) || "*";
        createBurst(event.clientX, event.clientY, glyph, anime);
      }
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      disposed = true;
      cancelIdle();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
