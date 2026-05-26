"use client";

import { animate, stagger } from "animejs";
import { useEffect } from "react";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stopAnimation(animation: unknown) {
  const controls = animation as { pause?: () => void; revert?: () => void; cancel?: () => void };
  controls.pause?.();
  controls.revert?.();
  controls.cancel?.();
}

function createBurst(x: number, y: number, glyph: string) {
  const layer = document.createElement("div");
  layer.className = "anime-burst-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const particles = Array.from({ length: 9 }, (_, index) => {
    const particle = document.createElement("span");
    particle.className = "anime-burst-particle";
    particle.textContent = index % 3 === 0 ? glyph : "✦";
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

function initDraggableCard(card: HTMLElement) {
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
    card.releasePointerCapture(event.pointerId);
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

export default function AnimeRuntime() {
  useEffect(() => {
    if (reducedMotion()) return undefined;

    const runningAnimations = new Set<unknown>();
    const animatedElements = new WeakSet<Element>();
    const animatedHeatCells = new WeakSet<Element>();
    let scanTimer: number | null = null;
    let lastPath = window.location.pathname + window.location.search;

    function reveal(elements: Element[]) {
      const targets = elements.filter((element) => !animatedElements.has(element)).slice(0, 80);
      if (!targets.length) return;

      targets.forEach((element) => animatedElements.add(element));
      const animation = animate(targets, {
        opacity: [0, 1],
        translateY: [14, 0],
        scale: [0.985, 1],
        duration: 620,
        ease: "out(3)",
        delay: stagger(26),
        onComplete: () => runningAnimations.delete(animation),
      });
      runningAnimations.add(animation);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        reveal(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target));
        entries.forEach((entry) => {
          if (entry.isIntersecting) observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    function scan() {
      const revealTargets = Array.from(
        document.querySelectorAll(
          ".ui-card, .ui-card-compact, .ui-action-card, [data-anime-reveal]",
        ),
      );
      revealTargets.forEach((element) => observer.observe(element));

      document.querySelectorAll<HTMLElement>("[data-anime-draggable]").forEach(initDraggableCard);

      const heatCells = Array.from(document.querySelectorAll(".anime-heat-cell")).filter(
        (element) => !animatedHeatCells.has(element),
      );
      if (heatCells.length) {
        heatCells.forEach((element) => animatedHeatCells.add(element));
        animate(heatCells, {
          opacity: [0, 1],
          scale: [0.35, 1],
          duration: 360,
          ease: "out(3)",
          delay: stagger(4, { grid: [53, 7], from: "center" }),
        });
      }
    }

    function scheduleScan() {
      if (scanTimer) window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(scan, 80);
    }

    function animateRouteChange() {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath === lastPath) return;
      lastPath = currentPath;

      const main = document.querySelector("main");
      if (!main) return;
      main.classList.remove("app-route-transition");
      window.requestAnimationFrame(() => {
        main.classList.add("app-route-transition");
        window.setTimeout(() => main.classList.remove("app-route-transition"), 520);
      });
    }

    scan();
    const mutationObserver = new MutationObserver(scheduleScan);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", animateRouteChange);
    const routeTimer = window.setInterval(animateRouteChange, 180);

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-anime-press], [data-anime-burst], .ui-button, .ui-button-secondary, .chat-reaction-pill",
      );
      if (!target) return;

      animate(target, {
        scale: [1, 0.96, 1],
        duration: 260,
        ease: "out(3)",
      });

      if (target.matches("[data-anime-burst], .chat-reaction-pill")) {
        const glyph =
          target.dataset.animeBurst ||
          target.textContent?.trim().slice(0, 4) ||
          "✦";
        createBurst(event.clientX, event.clientY, glyph);
      }
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", animateRouteChange);
      window.clearInterval(routeTimer);
      mutationObserver.disconnect();
      observer.disconnect();
      if (scanTimer) window.clearTimeout(scanTimer);
      runningAnimations.forEach(stopAnimation);
    };
  }, []);

  return null;
}
