import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Couple Space",
    short_name: "Couple Space",
    description:
      "Личное пространство для пары: вопросы дня, воспоминания, викторины, чат и совместные события.",
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f8f4",
    theme_color: "#4c9b56",
    categories: ["lifestyle", "social"],
    icons: [
      {
        src: "/icons/couple-space-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/couple-space-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/couple-space-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
