"use client";

import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Yazı tipi ölçeği — erişilebilirlik ayarı.
//
// NASIL ÇALIŞIR: kök `<html>` üzerindeki `font-size` değiştiriliyor. Tailwind
// tüm boyutları `rem` cinsinden ürettiği için tek bir kök değer bütün arayüzü
// orantılı büyütüyor; her bileşene ayrı ayrı dokunmaya gerek yok.
//
// NEDEN localStorage, veritabanı DEĞİL: tema tercihi de tam olarak böyle
// çalışıyor (`ThemeToggle`). `user_settings` tablosunda böyle bir kolon yok ve
// yalnızca bunun için migration eklemek, tercihin cihaz bazlı olması gerektiği
// gerçeğiyle de çelişirdi — kullanıcı telefonunda büyük, masaüstünde normal
// yazı isteyebilir. Cihazlar arası eşitleme istenirse `user_settings`'e kolon
// eklenmeli; o ayrı bir iş.
//
// `-webkit-text-size-adjust: 100%` globals.css'te zaten var; bu ayar onunla
// çakışmıyor çünkü tarayıcının otomatik ölçeklemesini değil, kök boyutu
// değiştiriyoruz.
// ============================================================================

export const FONT_SCALE_KEY = "viva-font-scale";

export type FontScale = "kucuk" | "normal" | "buyuk" | "cok-buyuk";

export const FONT_SCALES: { id: FontScale; label: string; ornek: string }[] = [
  { id: "kucuk", label: "Küçük", ornek: "A" },
  { id: "normal", label: "Normal", ornek: "A" },
  { id: "buyuk", label: "Büyük", ornek: "A" },
  { id: "cok-buyuk", label: "Çok büyük", ornek: "A" },
];

function apply(scale: FontScale) {
  const root = document.documentElement;
  // "normal" varsayılan: öznitelik hiç konmaz, CSS'te de kural yok.
  if (scale === "normal") root.removeAttribute("data-font-scale");
  else root.setAttribute("data-font-scale", scale);
  try {
    localStorage.setItem(FONT_SCALE_KEY, scale);
  } catch {
    /* yok say */
  }
}

export function FontScaleControl({ className }: { className?: string }) {
  const [scale, setScale] = useState<FontScale>("normal");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-font-scale") as FontScale) || "normal";
    setScale(current);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Yazı tipi boyutu"
      className={cn("flex items-center gap-1", className)}
    >
      {FONT_SCALES.map((s, i) => (
        <button
          key={s.id}
          role="radio"
          aria-checked={scale === s.id}
          aria-label={s.label}
          title={s.label}
          onClick={() => {
            setScale(s.id);
            apply(s.id);
          }}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl border transition-colors",
            scale === s.id
              ? "border-brand bg-brand/10 text-fg"
              : "border-ink-border text-fg-muted hover:border-brand/50 hover:text-fg"
          )}
        >
          {/* Düğmelerin kendi boyutu sabit; harf büyüklüğü seçeneği temsil eder. */}
          <span style={{ fontSize: `${11 + i * 2}px`, lineHeight: 1 }}>{s.ornek}</span>
        </button>
      ))}
    </div>
  );
}

/** Ayar satırında başlığın yanında gösterilecek simge. */
export const FontScaleIcon = Type;

/**
 * Hidrasyondan ÖNCE çalışıp ölçeği uygular — `ThemeInitScript` ile aynı
 * mantık. Olmazsa sayfa önce normal boyutta çizilir, sonra zıplar.
 */
export function FontScaleInitScript() {
  const code = `(function(){try{var s=localStorage.getItem('${FONT_SCALE_KEY}');if(s&&s!=='normal'){document.documentElement.setAttribute('data-font-scale',s);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
