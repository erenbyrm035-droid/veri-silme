"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * Bu kas grubuna öncelik veren 8 haftalık AI program üretir.
 * Mevcut /api/ai/generate-program uç noktasını kullanır.
 */
export function MuscleProgramButton({ muscleGroup }: { muscleGroup: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: [muscleGroup] }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error);
      router.push(`/programs/${data.id}`);
      router.refresh();
    } catch {
      setError("Program oluşturulamadı, tekrar dene.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Program oluşturuluyor...
          </>
        ) : (
          <>
            <Sparkles size={18} /> Bu kasa özel 8 haftalık program üret
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
    </div>
  );
}
