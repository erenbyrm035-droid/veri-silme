import type { MetadataRoute } from "next";

/** PWA manifest (Next 15 metadata route → /manifest.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Viva AI Coach",
    short_name: "Viva",
    description:
      "Yapay zeka destekli fitness koçun: antrenman, beslenme, egzersiz kütüphanesi, postür analizi ve AI diyetisyen.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    lang: "tr",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Antrenman", url: "/workouts", short_name: "Antrenman" },
      { name: "AI Diyetisyen", url: "/nutrition/coach", short_name: "Diyetisyen" },
      { name: "Egzersizler", url: "/exercises", short_name: "Egzersiz" },
    ],
  };
}
