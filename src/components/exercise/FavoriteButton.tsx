"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Egzersizi favorilere ekle/çıkar. İyimser güncelleme.
 * `variant="icon"` küçük yürek; `variant="button"` etiketli buton.
 */
export function FavoriteButton({
  exerciseId,
  userId,
  initial,
  variant = "icon",
}: {
  exerciseId: string;
  userId: string;
  initial: boolean;
  variant?: "icon" | "button";
}) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !fav;
    setFav(next);
    const supabase = createClient();
    if (next) {
      await supabase.from("favorites").insert({ user_id: userId, exercise_id: exerciseId });
    } else {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("exercise_id", exerciseId);
    }
    setBusy(false);
  }

  if (variant === "button") {
    return (
      <button
        onClick={toggle}
        disabled={busy}
        className={cn(
          "btn-ghost w-full",
          fav && "border-coral/50 text-coral"
        )}
      >
        <Heart size={18} className={cn(fav && "fill-coral")} />
        {fav ? "Favorilerde" : "Favorilere Ekle"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={fav ? "Favorilerden çıkar" : "Favorilere ekle"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl border transition-colors",
        fav
          ? "border-coral/50 text-coral"
          : "border-ink-border text-fg-muted hover:text-fg"
      )}
    >
      <Heart size={17} className={cn(fav && "fill-coral")} />
    </button>
  );
}
