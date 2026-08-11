// ============================================================================
// Sesli koç — sağlayıcı soyutlaması.
//
// İKİ SAĞLAYICI:
//   1. Web Speech API  — tarayıcıya gömülü, ücretsiz, çevrimdışı çalışır,
//                        Türkçe sesi işletim sisteminden gelir. VARSAYILAN.
//   2. ElevenLabs      — doğal ses, Premium'a özel, `/api/voice/tts` üzerinden.
//                        Yeni npm bağımlılığı YOK; `fetch` ile çağrılır.
//
// Neden soyutlama: WorkoutSession ve RestTimer "konuş" der, hangi motorun
// çalıştığını bilmez. Sağlayıcı env/abonelik durumuna göre seçilir, biri
// çalışmazsa diğerine düşülür.
//
// Client-only — `window.speechSynthesis` kullanır.
// ============================================================================

export type VoiceProviderId = "web-speech" | "elevenlabs" | "off";

export interface SpeakOptions {
  /** Aynı anda konuşan varsa onu kes (sayaç bitişi gibi kritik anonslar için). */
  interrupt?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface VoiceProvider {
  id: VoiceProviderId;
  available(): boolean;
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  stop(): void;
}

// ---------------------------------------------------------------------------
// 1) Web Speech API
// ---------------------------------------------------------------------------

/**
 * Türkçe sesi seçer.
 *
 * Not: `getVoices()` ilk çağrıda Chrome'da BOŞ döner — ses listesi asenkron
 * yüklenir. Bu yüzden `voiceschanged` olayına da bağlanılır ve seçim
 * tembel (lazy) yapılır.
 */
let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceListenerBound = false;

function pickTurkishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    if (!voiceListenerBound) {
      voiceListenerBound = true;
      window.speechSynthesis.addEventListener("voiceschanged", () => { cachedVoice = null; }, { once: true });
    }
    return null;
  }

  cachedVoice =
    voices.find((v) => v.lang === "tr-TR") ??
    voices.find((v) => v.lang?.toLowerCase().startsWith("tr")) ??
    null;
  return cachedVoice;
}

const webSpeech: VoiceProvider = {
  id: "web-speech",
  available() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },
  speak(text, opts) {
    return new Promise((resolve) => {
      if (!this.available() || !text.trim()) return resolve();
      try {
        if (opts?.interrupt) window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickTurkishVoice();
        if (v) u.voice = v;
        u.lang = "tr-TR";
        u.rate = opts?.rate ?? 1.05;
        u.pitch = opts?.pitch ?? 1;
        u.volume = opts?.volume ?? 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  },
  stop() {
    try { window.speechSynthesis.cancel(); } catch { /* yoksay */ }
  },
};

// ---------------------------------------------------------------------------
// 2) ElevenLabs (Premium)
// ---------------------------------------------------------------------------
let currentAudio: HTMLAudioElement | null = null;

const elevenLabs: VoiceProvider = {
  id: "elevenlabs",
  available() {
    return typeof window !== "undefined" && typeof Audio !== "undefined";
  },
  async speak(text, opts) {
    if (!text.trim()) return;
    try {
      if (opts?.interrupt) this.stop();
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      // Kota dolduysa / anahtar yoksa sessizce Web Speech'e düş.
      if (!res.ok) return webSpeech.speak(text, opts);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = opts?.volume ?? 1;
      currentAudio = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } catch {
      // Ağ hatası → sessiz düşüş
      await webSpeech.speak(text, opts);
    }
  },
  stop() {
    try {
      currentAudio?.pause();
      currentAudio = null;
    } catch { /* yoksay */ }
    webSpeech.stop();
  },
};

const off: VoiceProvider = {
  id: "off",
  available: () => true,
  speak: async () => {},
  stop: () => {},
};

const PROVIDERS: Record<VoiceProviderId, VoiceProvider> = {
  "web-speech": webSpeech,
  elevenlabs: elevenLabs,
  off,
};

export function getVoiceProvider(id: VoiceProviderId): VoiceProvider {
  const p = PROVIDERS[id] ?? webSpeech;
  return p.available() ? p : webSpeech.available() ? webSpeech : off;
}

// ---------------------------------------------------------------------------
// Anons metinleri — tek yerde, tutarlı dil
// ---------------------------------------------------------------------------
export const VOICE_LINES = {
  restStart: (sec: number) => `${sec} saniye dinlen.`,
  restHalf: (sec: number) => `${sec} saniye kaldı.`,
  restThree: "Üç, iki, bir.",
  restDone: "Dinlenme bitti. Hazırsan devam.",
  setLogged: (n: number, name: string) => `${n}. set kaydedildi. ${name}.`,
  prHit: (name: string) => `Yeni rekor! ${name}. Harikasın.`,
  workoutDone: (minutes: number) =>
    `Antrenman tamamlandı. ${minutes} dakika çalıştın. Tebrikler.`,
} as const;

/**
 * Ekranı uyanık tutar (antrenman sırasında telefon kilitlenmesin).
 * Wake Lock desteklenmiyorsa sessizce hiçbir şey yapmaz.
 */
export async function acquireWakeLock(): Promise<{ release: () => void }> {
  const noop = { release: () => {} };
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return noop;
    const sentinel = await nav.wakeLock.request("screen");
    return { release: () => { void sentinel.release().catch(() => {}); } };
  } catch {
    return noop;
  }
}
