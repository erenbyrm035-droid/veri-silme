"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Animation } from "@/lib/database.types";

// Three.js/R3F yalnızca istemcide yüklenir (SSR kapalı) — diğer sayfalar hafif kalır.
const AnimationPlayer = dynamic(() => import("./AnimationPlayer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-ink-border bg-ink-soft text-fg-muted sm:h-80">
      <Loader2 size={22} className="animate-spin" />
    </div>
  ),
});

/** Egzersiz detayında 3D animasyon oynatıcısını (lazy) gömer. */
export function AnimationPlayerLoader(props: {
  animation: Animation | null;
  animationKey: string;
  exerciseName: string;
}) {
  return <AnimationPlayer {...props} />;
}
