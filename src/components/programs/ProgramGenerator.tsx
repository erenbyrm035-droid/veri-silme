"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Sparkles, Brain, Loader2, TrendingDown, ArrowRight } from "lucide-react";

interface Lagging {
  muscle: string;
  reason: string;
}

/**
 * AI kas analizi → 8 haftalık program üretim akışı.
 * 1) Antrenman geçmişini analiz et (geride kalan kaslar).
 * 2) Bulguya göre 8 haftalık program üret ve kaydet.
 */
export function ProgramGenerator() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "analyzing" | "analyzed" | "generating">("idle");
  const [lagging, setLagging] = useState<Lagging[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setStep("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze-muscles", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLagging(data.lagging ?? []);
      setSummary(data.summary ?? "");
      setStep("analyzed");
    } catch {
      setError("Analiz yapılamadı. Lütfen tekrar dene.");
      setStep("idle");
    }
  }

  async function generate() {
    setStep("generating");
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: lagging.map((l) => l.muscle) }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error || "Program oluşturulamadı. Lütfen tekrar dene.");
      router.push(`/programs/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Program oluşturulamadı. Lütfen tekrar dene.");
      setStep("analyzed");
    }
  }

  return (
    <Card className="space-y-4 border-brand/30 bg-gradient-to-br from-brand/10 to-transparent">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand">
          <Sparkles size={20} />
        </span>
        <div>
          <h2 className="font-semibold">AI Kas Analizi & Program</h2>
          <p className="text-sm text-fg-muted">
            Antrenmanlarını analiz edip sana özel 8 haftalık plan üretir.
          </p>
        </div>
      </div>

      {step === "idle" && (
        <button onClick={analyze} className="btn-primary w-full">
          <Brain size={18} /> Kaslarımı Analiz Et
        </button>
      )}

      {step === "analyzing" && (
        <button disabled className="btn-primary w-full">
          <Loader2 size={18} className="animate-spin" /> Analiz ediliyor...
        </button>
      )}

      {(step === "analyzed" || step === "generating") && (
        <div className="space-y-3">
          {summary && <p className="text-sm text-fg-muted">{summary}</p>}
          <div className="space-y-2">
            {lagging.map((l) => (
              <div
                key={l.muscle}
                className="flex items-start gap-3 rounded-xl bg-ink-soft px-3 py-2.5"
              >
                <TrendingDown size={16} className="mt-0.5 text-coral" />
                <div>
                  <p className="text-sm font-medium">{l.muscle}</p>
                  <p className="text-xs text-fg-muted">{l.reason}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={step === "generating"}
            className="btn-primary w-full"
          >
            {step === "generating" ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Program oluşturuluyor...
              </>
            ) : (
              <>
                8 Haftalık Program Oluştur <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-coral">{error}</p>
          {error.includes("Premium") && (
            <a href="/premium" className="btn-primary w-full">
              <Sparkles size={16} /> Premium'a Yükselt
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
