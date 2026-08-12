"use client";

import * as React from "react";
import { Share2, Check, Users, UserRound, Globe, Loader2 } from "lucide-react";
import { createFeedPost } from "@/lib/social/actions";
import { cn } from "@/lib/utils";

// ============================================================================
// Antrenman sonu paylaşımı.
//
// OTOMATİK PAYLAŞIM YOK. Kullanıcının antrenman verisi kendi verisidir;
// bitirdiği anda takımına düşmesi mahremiyet ihlali olurdu. Metin hazır
// gelir ama basmadan hiçbir şey paylaşılmaz — ve metni düzenleyebilir.
//
// Mevcut `createFeedPost` yeniden kullanılıyor (rate limit ve doğrulama
// zaten orada).
// ============================================================================

type Visibility = "team" | "friends" | "public";

const SECENEKLER: { key: Visibility; label: string; icon: React.ReactNode }[] = [
  { key: "team", label: "Takımım", icon: <Users size={14} /> },
  { key: "friends", label: "Arkadaşlar", icon: <UserRound size={14} /> },
  { key: "public", label: "Herkese açık", icon: <Globe size={14} /> },
];

export function ShareWorkout({ defaultText }: { defaultText: string }) {
  const [acik, setAcik] = React.useState(false);
  const [text, setText] = React.useState(defaultText);
  const [visibility, setVisibility] = React.useState<Visibility>("friends");
  const [busy, setBusy] = React.useState(false);
  const [paylasildi, setPaylasildi] = React.useState(false);
  const [hata, setHata] = React.useState<string | null>(null);

  async function paylas() {
    setBusy(true);
    setHata(null);
    const res = await createFeedPost({ body: text, visibility });
    setBusy(false);
    if (res.ok) {
      setPaylasildi(true);
      setAcik(false);
    } else {
      setHata(res.error ?? "Paylaşılamadı.");
    }
  }

  if (paylasildi) {
    return (
      <div className="card flex items-center gap-3 border-brand/30 bg-brand/5">
        <Check size={18} className="shrink-0 text-brand" />
        <p className="text-sm font-medium">Antrenmanın paylaşıldı.</p>
      </div>
    );
  }

  if (!acik) {
    return (
      <button onClick={() => setAcik(true)} className="btn-ghost w-full">
        <Share2 size={16} /> Antrenmanı paylaş
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Share2 size={16} className="text-brand" /> Antrenmanı paylaş
      </h3>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={1000}
        className="input resize-none text-sm"
        aria-label="Paylaşım metni"
      />

      <div className="flex flex-wrap gap-1.5">
        {SECENEKLER.map((s) => (
          <button
            key={s.key}
            onClick={() => setVisibility(s.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              visibility === s.key ? "bg-brand text-black" : "bg-ink-soft text-fg-muted hover:text-fg"
            )}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {hata && <p className="text-xs text-coral">{hata}</p>}

      <div className="flex gap-2">
        <button onClick={paylas} disabled={busy || !text.trim()} className="btn-primary flex-1 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} Paylaş
        </button>
        <button onClick={() => setAcik(false)} className="btn-ghost px-4">Vazgeç</button>
      </div>
    </div>
  );
}
