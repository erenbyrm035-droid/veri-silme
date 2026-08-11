"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  who: "bot" | "user";
  text: string;
}

const RULES: { k: string[]; r: string }[] = [
  {
    k: ["yapamad", "motivasyon", "yorgun", "üşen", "usen", "canım istemi", "canim istemi"],
    r: "Olur böyle günler, kendini suçlama. 🙌 Bugün için 2 seçenek:\n\n• 10-15 dk hafif tempolu yürüyüş + 5 dk esneme — kan akışını açar, yarına hazır olursun.\n• Ya da tam dinlen; kaslar dinlenirken gelişir. Sadece su ve proteini ihmal etme.\n\nYarın için kısa bir plan çıkarmamı ister misin?",
  },
  {
    k: ["kas", "protein", "ne yemeli", "büyü", "buyu", "bulk"],
    r: "Kas için iki anahtar var: yeterli protein + hafif kalori fazlası. 💪\n\n• Günde kilo başına ~1.8-2 g protein hedefle (75 kg → ~150 g).\n• Tabağına şunları kat: ızgara tavuk, yumurta, kırmızı et, yoğurt, süzme peynir.\n• Antrenman sonrası protein + karbonhidrat (tavuk + pilav) toparlanmayı hızlandırır.\n\nGünlük kalori hedefini birlikte hesaplayalım mı?",
  },
  {
    k: ["program", "değiştir", "degistir", "yeni plan", "sıkıldım", "sikildim"],
    r: "Tabii ki, program esnektir. 🔄 Birkaç soru:\n\n• Haftada kaç gün ayırabiliyorsun?\n• Ev mi, salon mu?\n• Şu an en çok neyi geliştirmek istiyorsun?\n\nBunlara göre split'ini (itiş/çekiş/bacak) yeniden düzenleyip zorluğu ayarlayabilirim.",
  },
  {
    k: ["kilo ver", "yağ", "yag", "zayıfla", "zayifla", "incel"],
    r: "Kilo vermenin temeli sürdürülebilir bir kalori açığı. 🔥\n\n• Günlük ~300-500 kcal açık ideal — çok agresif olma, kas kaybedersin.\n• Proteini yüksek tut, lif için sebze ekle.\n• Haftada 2-4 antrenman + günlük 7-8 bin adım harika bir kombinasyon.\n\nBoy-kilonu yazarsan sana uygun kalori hedefini söyleyeyim.",
  },
  {
    k: ["su", "sıvı", "sivi"],
    r: "Su, çoğu insanın atladığı en kolay kazanç. 💧 Genel hedef günde ~2.5 L; antrenman günlerinde biraz daha. Yanına bir şişe al, saat başı birkaç yudum — akşama kadar hedefi rahat tutturursun.",
  },
  {
    k: ["merhaba", "selam", "naber", "hey"],
    r: "Selam! 👋 Hazırsan başlayalım. Hedefini söyle — kilo vermek, kas kazanmak ya da formda kalmak — sana göre yönlendireyim.",
  },
];

const FALLBACK =
  "Güzel soru! 🤔 Bu bir demo koç — birkaç konuda yanıt veriyor: dinlenme günü, kas kazanımı, program değişikliği, kilo verme ve su. Kayıt olduğunda gerçek Viva koçu senin profilini ve geçmiş antrenmanlarını görüp her soruna özel cevap verir.";

const SUGGESTIONS = [
  "Bugün spor yapamadım, ne yapmalıyım?",
  "Kas kazanmak için ne yemeliyim?",
  "Programımı değiştirebilir miyiz?",
  "Kilo vermek istiyorum",
];

function reply(text: string): string {
  const t = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.k.some((kw) => t.includes(kw))) return rule.r;
  }
  return FALLBACK;
}

export function DemoCoach() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      who: "bot",
      text:
        "Selam! Ben Viva, senin AI fitness koçun. 💪 Hedefin ne — kilo vermek mi, kas kazanmak mı? Aşağıdaki sorulardan birini de seçebilirsin.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function send(text: string) {
    if (typing || !text.trim()) return;
    setMessages((m) => [...m, { who: "user", text }]);
    setInput("");
    setTyping(true);
    const delay = 550 + Math.min(text.length, 60) * 12;
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { who: "bot", text: reply(text) }]);
    }, delay);
  }

  return (
    <div className="flex max-h-[560px] min-h-[460px] flex-col overflow-hidden rounded-3xl border border-ink-border bg-ink-card shadow-2xl">
      {/* Başlık */}
      <div className="flex items-center gap-3 border-b border-ink-border px-5 py-3.5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-coral text-lg">
          🏋️
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Viva Koç</p>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> çevrimiçi · demo
          </p>
        </div>
      </div>

      {/* Mesajlar */}
      <div ref={bodyRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              m.who === "user"
                ? "self-end rounded-br-sm bg-brand font-medium text-black"
                : "self-start rounded-bl-sm bg-ink-soft text-fg"
            )}
          >
            {m.text}
          </div>
        ))}
        {typing && (
          <div className="flex gap-1.5 self-start rounded-2xl rounded-bl-sm bg-ink-soft px-4 py-3.5">
            <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
          </div>
        )}
      </div>

      {/* Öneri çipleri */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-ink-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:border-brand hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Girdi */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-ink-border p-3.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Koçuna bir şey sor..."
          className="flex-1 rounded-xl border border-ink-border bg-ink-soft px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand/60"
          aria-label="Mesaj"
        />
        <button
          type="submit"
          className="grid w-11 place-items-center rounded-xl bg-brand text-black transition-transform hover:scale-105"
          aria-label="Gönder"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg/40"
      style={{ animationDelay: delay }}
    />
  );
}
