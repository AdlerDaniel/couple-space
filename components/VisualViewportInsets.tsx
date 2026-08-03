"use client";

import { useEffect } from "react";

export default function VisualViewportInsets() {
  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        root.style.setProperty("--keyboard-inset", "0px");
        return;
      }

      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
      root.style.setProperty("--visible-viewport-height", `${Math.round(viewport.height)}px`);
    };

    sync();
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      root.style.removeProperty("--keyboard-inset");
      root.style.removeProperty("--visible-viewport-height");
    };
  }, []);

  return null;
}
