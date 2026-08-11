"use client";

import { useState } from "react";
import { ChefHat, Loader2, Send } from "lucide-react";

const EXAMPLES = [
  "Evimde tavuk, pirinç ve yoğurt var.",
  "Bugün 40 gram protein almam gerekiyor.",
  "Düşük kalorili bir akşam yemeği öner.",
];

/** Akıllı tarif asistanı: malzeme veya makro hedefine göre öneri. */
export function RecipeAssistant() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(text?: string) {
    const q = (text ?? prompt).trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });
      const json = await res.json();
      setResult(json.recipe ?? "Öneri alınamadı.");
    } catch {
      setResult("Bir hata oluştu, tekrar dene.");
    }
    setLoading(false);
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ChefHat size={18} className="text-brand" /> Akıllı Tarif
        </h2>
        <p className="mt-0.5 text-sm text-fg-muted">
          Elindeki malzemeleri veya makro hedefini yaz, sana uygun öneri gelsin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setPrompt(ex);
              void ask(ex);
            }}
            className="rounded-full border border-ink-border bg-ink-soft px-3 py-1.5 text-xs text-fg-muted hover:border-brand/40"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Örn. Elimde yumurta ve yulaf var, kahvaltı öner."
          className="input flex-1 resize-none"
        />
        <button
          onClick={() => ask()}
          disabled={loading || !prompt.trim()}
          className="btn-primary shrink-0 self-stretch px-4 disabled:opacity-50"
          aria-label="Gönder"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm leading-relaxed">
          {result}
        </div>
      )}
    </div>
  );
}
