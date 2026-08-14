"use client";

import * as React from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function IconBtn({
  children, onClick, label, active,
}: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors",
        active
          ? "border-brand/50 bg-brand/15 text-brand"
          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}

/** Sesli mesaj altyapısı — MediaRecorder ile kayıt, webm olarak yüklenir. */
export function VoiceButton({
  onRecorded, onError,
}: { onRecorded: (f: File) => void; onError: (m: string) => void }) {
  const [recording, setRecording] = React.useState(false);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<BlobPart[]>([]);

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return onError("Bu cihazda ses kaydı desteklenmiyor.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size > 0) onRecorded(new File([blob], `ses-${Date.now()}.webm`, { type: "audio/webm" }));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      onError("Mikrofon izni verilmedi.");
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  return (
    <button
      onClick={recording ? stop : start}
      aria-label={recording ? "Kaydı bitir" : "Sesli mesaj"}
      title={recording ? "Kaydı bitir" : "Sesli mesaj"}
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors",
        recording
          ? "border-coral/50 bg-coral/15 text-coral"
          : "border-white/10 bg-ink-soft/60 text-fg-muted hover:text-fg"
      )}
    >
      {recording ? <Square size={14} /> : <Mic size={16} />}
      {recording && <span className="absolute inset-0 animate-ping rounded-xl bg-coral/20" />}
    </button>
  );
}
