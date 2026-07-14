"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

function isVisibleColor(value: string) {
  return value !== "transparent" && value !== "rgba(0, 0, 0, 0)";
}

export default function PageBackgroundSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const container = document.querySelector<HTMLElement>(".app-desktop-content");
    if (!container) return;
    const contentContainer = container;

    const previousBackground = document.body.style.backgroundColor;
    let frameId: number | null = null;

    function syncBackground() {
      const main = contentContainer.querySelector<HTMLElement>(":scope > main");
      if (!main) return;

      const backgroundColor = getComputedStyle(main).backgroundColor;
      if (isVisibleColor(backgroundColor)) {
        document.body.style.backgroundColor = backgroundColor;
      }
    }

    function scheduleBackgroundSync() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        syncBackground();
      });
    }

    scheduleBackgroundSync();

    const observer = new MutationObserver(scheduleBackgroundSync);
    observer.observe(contentContainer, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true,
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    contentContainer.addEventListener("transitionend", scheduleBackgroundSync, true);

    return () => {
      observer.disconnect();
      contentContainer.removeEventListener("transitionend", scheduleBackgroundSync, true);
      if (frameId !== null) cancelAnimationFrame(frameId);
      document.body.style.backgroundColor = previousBackground;
    };
  }, [pathname]);

  return null;
}
