"use client";

import * as React from "react";
import { getVoiceProvider, acquireWakeLock, type VoiceProviderId } from "./provider";

const STORAGE_KEY = "viva:voice";

interface Stored {
  enabled: boolean;
  provider: VoiceProviderId;
}

function read(): Stored {
  if (typeof window === "undefined") return { enabled: false, provider: "web-speech" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, provider: "web-speech" };
    const p = JSON.parse(raw) as Partial<Stored>;
    return {
      enabled: !!p.enabled,
      provider: (p.provider as VoiceProviderId) ?? "web-speech",
    };
  } catch {
    return { enabled: false, provider: "web-speech" };
  }
}

/**
 * Sesli koç kancası.
 *
 * Tercih localStorage'da tutulur — sunucuya yazmıyoruz çünkü bu cihaza özgü bir
 * ayar (kulaklıkla çalışan telefon vs. sessiz masaüstü).
 *
 * VARSAYILAN KAPALI. Sesin kullanıcı jesti olmadan başlaması hem tarayıcı
 * politikalarına takılır hem de spor salonunda istenmeyen bir sürpriz olur.
 */
export function useVoiceCoach(opts?: { premium?: boolean }) {
  const [state, setState] = React.useState<Stored>({ enabled: false, provider: "web-speech" });
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setState(read());
    setReady(true);
  }, []);

  const persist = React.useCallback((next: Stored) => {
    setState(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* yoksay */ }
  }, []);

  // Premium değilse ElevenLabs seçilemez; sunucu da reddederdi.
  const effectiveProvider: VoiceProviderId =
    state.provider === "elevenlabs" && !opts?.premium ? "web-speech" : state.provider;

  const speak = React.useCallback(
    (text: string, o?: { interrupt?: boolean }) => {
      if (!state.enabled || !text) return;
      void getVoiceProvider(effectiveProvider).speak(text, o);
    },
    [state.enabled, effectiveProvider]
  );

  const stop = React.useCallback(() => {
    getVoiceProvider(effectiveProvider).stop();
  }, [effectiveProvider]);

  const toggle = React.useCallback(() => {
    const next = { ...state, enabled: !state.enabled };
    persist(next);
    // Açılışta kısa bir onay — hem kullanıcı jesti olarak ses iznini alır
    // hem de sesin gerçekten çıktığını doğrular.
    if (next.enabled) {
      void getVoiceProvider(effectiveProvider).speak("Sesli koç açık.", { interrupt: true });
    } else {
      getVoiceProvider(effectiveProvider).stop();
    }
  }, [state, persist, effectiveProvider]);

  const setProvider = React.useCallback(
    (p: VoiceProviderId) => persist({ ...state, provider: p }),
    [state, persist]
  );

  // Sayfa kapanırken konuşmayı kes — arka planda devam etmesin.
  React.useEffect(() => () => { getVoiceProvider(effectiveProvider).stop(); }, [effectiveProvider]);

  return {
    ready,
    enabled: state.enabled,
    provider: effectiveProvider,
    speak,
    stop,
    toggle,
    setProvider,
  };
}

/**
 * Antrenman süresince ekranı uyanık tutar.
 * `active` false olduğunda veya bileşen kalktığında kilit bırakılır.
 */
export function useWakeLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    let released = false;
    let handle: { release: () => void } | null = null;

    void acquireWakeLock().then((h) => {
      if (released) h.release();
      else handle = h;
    });

    // Sekme arka plana alınıp geri gelince kilit düşer; yeniden alınır.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) {
        void acquireWakeLock().then((h) => { handle?.release(); handle = h; });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      handle?.release();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);
}
