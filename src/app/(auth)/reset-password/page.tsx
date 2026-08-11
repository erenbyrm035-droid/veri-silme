"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="card flex items-center justify-center gap-2 py-10 text-sm text-fg-muted">
          <Loader2 size={18} className="animate-spin" /> Yükleniyor...
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Kurtarma bağlantısını oturuma çevir — birden çok teslim biçimini destekle.
  useEffect(() => {
    const supabase = createClient();
    async function init() {
      // 0) Bağlantı süresi dolmuş/geçersiz olarak geldiyse.
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (params.get("error") || /error=/.test(hash)) { setInvalid(true); return; }

      // 1) Zaten oturum varsa (hash token'ı client otomatik işledi ya da
      //    /auth/confirm cookie oturumu kurdu).
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setReady(true); return; }

      // 2) token_hash akışı (PKCE'siz — her tarayıcıda çalışır).
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ type: type as "recovery", token_hash: tokenHash });
        if (error) { setInvalid(true); return; }
        setReady(true);
        return;
      }

      // 3) code akışı (PKCE — aynı tarayıcıda çalışır).
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setInvalid(true); return; }
        setReady(true);
        return;
      }

      setInvalid(true);
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  if (invalid) {
    return (
      <div className="card text-center">
        <h1 className="text-xl font-bold">Bağlantı geçersiz</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeniden
          talep et.
        </p>
        <a href="/forgot-password" className="btn-primary mt-6 w-full">
          Yeni bağlantı iste
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand">
          <CheckCircle2 size={26} />
        </span>
        <h1 className="mt-4 text-xl font-bold">Şifren güncellendi 🎉</h1>
        <p className="mt-2 text-sm text-fg-muted">Panele yönlendiriliyorsun...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="card flex items-center justify-center gap-2 py-10 text-sm text-fg-muted">
        <Loader2 size={18} className="animate-spin" /> Bağlantı doğrulanıyor...
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-2xl font-bold">Yeni şifre belirle</h1>
      <p className="mt-1 text-sm text-fg-muted">Hesabın için güçlü bir şifre seç.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label">Yeni şifre</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="En az 6 karakter"
          />
        </div>
        <div>
          <label className="label">Yeni şifre (tekrar)</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
        </button>
      </form>
    </div>
  );
}
