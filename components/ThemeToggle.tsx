"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    queueMicrotask(() => setIsDark(savedTheme === "dark"));
  }, []);

  function toggleTheme() {
    const newTheme = !isDark;

    setIsDark(newTheme);

    if (newTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="fixed right-4 top-4 z-50 rounded-full bg-rose-500 px-4 py-2 text-white shadow-lg"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
