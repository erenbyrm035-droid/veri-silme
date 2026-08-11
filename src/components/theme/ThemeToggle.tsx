"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const KEY = "viva-theme";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* yok say */
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
      title="Tema değiştir"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl border border-ink-border text-fg-muted transition-colors hover:border-brand/50 hover:text-fg",
        className
      )}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

/**
 * Hidrasyondan önce çalışıp temayı uygulayan script (FOUC engelleme).
 * Root layout'ın <body> başına konur.
 */
export function ThemeInitScript() {
  const code = `(function(){try{var t=localStorage.getItem('${KEY}');if(!t){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
