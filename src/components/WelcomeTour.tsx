"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dumbbell, Salad, MessageSquareHeart, Activity, TrendingUp, Sparkles, ChevronRight, X } from "lucide-react";

const TOUR_VERSION = "v1";

interface Slide {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  desc: string;
  points?: string[];
  badge?: string;
}

function slides(name: string): Slide[] {
  const first = (name || "").trim().split(" ")[0];
  return [
    {
      icon: <Sparkles size={26} />, emoji: "👋",
      title: first ? `Hoş geldin, ${first}!` : "Viva'ya hoş geldin!",
      desc: "Viva; yapay zekâ destekli kişisel fitness ve beslenme koçun. Sana özel antrenman, beslenme ve gelişim takibini tek yerde topluyor. Hadi kısaca gezelim.",
    },
    {
      icon: <MessageSquareHeart size={26} />, emoji: "🤖",
      title: "AI Koç — 7/24 yanında",
      desc: "Antrenman, form, motivasyon ya da aklına takılan her şeyi sor. Koç senin profilini, hedeflerini ve geçmişini bilir; sana özel yanıt verir.",
      points: ["Kişiye özel tavsiye", "Sakatlığa göre alternatif hareket", "Anlık sohbet"],
    },
    {
      icon: <Salad size={26} />, emoji: "🥗",
      title: "AI Diyetisyen — sana özel plan",
      desc: "Gerçek bir diyetisyen gibi önce seninle görüşür, seni tanır; sonra hedefine uygun günlük beslenme planını, alışveriş listesiyle birlikte hazırlar.",
      points: ["Görüşme → analiz → plan", "Her öğünde makro, tarif ve alternatif", "Alışveriş listesi"],
      badge: "YENİ",
    },
    {
      icon: <Dumbbell size={26} />, emoji: "🏋️",
      title: "Antrenman & Programlar",
      desc: "Hedefine göre program oluştur, setlerini kaydet, rekorlarını (PR) takip et. Egzersiz kütüphanesinde her hareketin doğru formunu gör.",
      points: ["Kişisel programlar", "Set & tekrar takibi", "PR rozetleri"],
    },
    {
      icon: <Activity size={26} />, emoji: "🧠",
      title: "Anatomi & Egzersiz Kütüphanesi",
      desc: "İnteraktif kas haritasıyla hangi kası nasıl çalıştıracağını keşfet. Her egzersizin hedef kasları, ipuçları ve sık yapılan hatalar elinin altında.",
      points: ["İnteraktif kas haritası", "Hedef kas gösterimi", "Form ipuçları"],
    },
    {
      icon: <TrendingUp size={26} />, emoji: "📈",
      title: "Gelişimini gör",
      desc: "Kilo, ölçü ve fotoğraflarını kaydet; grafiklerle ilerlemeni izle. Rozetler ve puanlarla motivasyonunu yüksek tut.",
      points: ["Grafiklerle ilerleme", "Fotoğraf karşılaştırma", "Rozet & puan"],
    },
  ];
}

/**
 * Yeni kullanıcıları karşılayan tanıtım turu. İlk girişte bir kez gösterilir
 * (localStorage ile işaretlenir). Framer Motion ile akıcı geçişler.
 */
export function WelcomeTour({ userId, fullName }: { userId: string; fullName: string | null }) {
  const key = `viva_tour_${TOUR_VERSION}_${userId}`;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const items = slides(fullName ?? "");

  useEffect(() => {
    try {
      // ?tour=1 ile her zaman önizlenebilir (test/tanıtım için).
      const forced = new URLSearchParams(window.location.search).get("tour") === "1";
      if (forced || !localStorage.getItem(key)) setOpen(true);
    } catch { /* localStorage yoksa gösterme */ }
  }, [key]);

  const close = useCallback(() => {
    try { localStorage.setItem(key, new Date().toISOString()); } catch { /* yut */ }
    setOpen(false);
  }, [key]);

  const last = i === items.length - 1;
  const next = () => (last ? close() : setI((v) => v + 1));

  if (!open) return null;
  const s = items[i];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog" aria-modal="true" aria-label="Tanıtım turu"
      >
        <motion.div
          className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-ink-border bg-ink-card pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-3xl"
          initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Atla */}
          <button onClick={close} aria-label="Kapat"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-ink-soft/80 text-fg-muted backdrop-blur transition-colors hover:text-fg">
            <X size={17} />
          </button>

          {/* Görsel başlık alanı */}
          <div className="relative flex h-40 shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-brand/25 via-brand/5 to-transparent">
            <AnimatePresence mode="wait">
              <motion.div key={i} className="grid place-items-center"
                initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                <span className="text-6xl">{s.emoji}</span>
              </motion.div>
            </AnimatePresence>
            <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-brand text-black shadow-lg">
              {s.icon}
            </span>
          </div>

          {/* İçerik */}
          <div className="flex-1 overflow-y-auto px-6 pt-5">
            <AnimatePresence mode="wait">
              <motion.div key={i}
                initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold leading-tight">{s.title}</h2>
                  {s.badge && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-black">{s.badge}</span>}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.desc}</p>
                {s.points && (
                  <ul className="mt-3 space-y-1.5">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Alt bar: noktalar + buton */}
          <div className="shrink-0 px-6 pb-5 pt-4">
            <div className="mb-4 flex justify-center gap-1.5">
              {items.map((_, idx) => (
                <button key={idx} onClick={() => setI(idx)} aria-label={`${idx + 1}. adım`}
                  className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-brand" : "w-1.5 bg-ink-border"}`} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              {!last && (
                <button onClick={close} className="text-sm font-medium text-fg-muted hover:text-fg">Atla</button>
              )}
              <button onClick={next} className="btn-primary ml-auto flex items-center gap-1.5">
                {last ? "Başlayalım 🚀" : "Devam"}
                {!last && <ChevronRight size={17} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
