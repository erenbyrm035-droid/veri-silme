"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocialAuth } from "@/components/auth/SocialAuth";
import { recordLoginAction } from "@/lib/auth/record-login-action";
import { sendMagicLink } from "@/lib/auth/magic-link-action";
import { mfaGerekliMi, mfaDogrula } from "@/lib/auth/mfa-actions";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Şifresiz giriş: aynı e-posta alanı kullanılır, yalnızca gönderim ve
  // "kutunu kontrol et" durumu ayrı tutulur.
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  // İki adımlı doğrulama: şifre doğruysa oturum aal1'de kalır; kullanıcının
  // doğrulanmış faktörü varsa burada kod istenir.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaKod, setMfaKod] = useState("");

  async function handleMagicLink() {
    setError(null);
    if (!email.trim()) {
      setError("Önce e-posta adresini gir.");
      return;
    }
    setMagicLoading(true);
    const res = await sendMagicLink(email);
    setMagicLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Bağlantı gönderilemedi.");
      return;
    }
    setMagicSent(true);
  }

  // Korumalı bir sayfaya gitmeye çalışan ama kodunu girmemiş kullanıcı
  // middleware tarafından buraya `?mfa=1` ile atılıyor. Şifre formunu değil,
  // doğrudan kod ekranını görmeli — şifresini yeniden girmesi anlamsız.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("mfa")) return;
    void (async () => {
      const aal = await mfaGerekliMi();
      if (aal.ok && aal.data?.gerekli && aal.data.factorId) setMfaFactorId(aal.data.factorId);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // "Beni hatırla" tercihini sakla (oturum güvenli çerezlerde tutulur).
    try {
      localStorage.setItem("viva-remember", remember ? "1" : "0");
    } catch {
      /* yok say */
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-posta veya şifre hatalı. Lütfen tekrar deneyin.");
      setLoading(false);
      return;
    }
    // İkinci adım gerekiyor mu? Gerekiyorsa dashboard'a GİTMEDEN kod istenir.
    const aal = await mfaGerekliMi();
    if (aal.ok && aal.data?.gerekli && aal.data.factorId) {
      setMfaFactorId(aal.data.factorId);
      setLoading(false);
      return;
    }

    // Giriş olayını kaydet (istatistik/aktivite için, akışı bloklamaz).
    void recordLoginAction("password");
    router.push("/dashboard");
    router.refresh();
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setLoading(true);
    const res = await mfaDogrula(mfaFactorId, mfaKod);
    if (!res.ok) {
      setError(res.error ?? "Kod doğrulanamadı.");
      setLoading(false);
      return;
    }
    void recordLoginAction("password+mfa");
    router.push("/dashboard");
    router.refresh();
  }

  // İkinci adım ekranı — şifre formunun yerine geçer.
  if (mfaFactorId) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold">İki adımlı doğrulama</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Doğrulayıcı uygulamandaki 6 haneli kodu gir.
        </p>
        <form onSubmit={handleMfa} className="mt-6 space-y-4">
          <div>
            <label htmlFor="giris-mfa-kod" className="label">Kod</label>
            <input
              id="giris-mfa-kod"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaKod}
              onChange={(ev) => setMfaKod(ev.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="input mt-1.5 text-center text-lg tracking-[0.4em]"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          <button type="submit" disabled={loading || mfaKod.length !== 6} className="btn-primary w-full">
            {loading ? "Doğrulanıyor..." : "Doğrula"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-2xl font-bold">Tekrar hoş geldin 👋</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Hesabına giriş yaparak antrenmanına devam et.
      </p>

      <div className="mt-6">
        <SocialAuth />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">E-posta</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="ornek@email.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label mb-0">Şifre</label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand">
              Şifremi unuttum?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1.5"
            placeholder="••••••••"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[color:rgb(var(--brand))]"
          />
          Beni hatırla
        </label>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </form>

      {/* Şifresiz giriş — şifresini hatırlamayan kullanıcı için sıfırlama
          akışından daha kısa yol. Aynı e-posta alanını kullanır. */}
      <div className="mt-5">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink-border" />
          <span className="text-xs text-fg-muted">veya</span>
          <span className="h-px flex-1 bg-ink-border" />
        </div>

        {magicSent ? (
          <p
            role="status"
            className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400"
          >
            Giriş bağlantısı <strong>{email}</strong> adresine gönderildi.
            Kutunu kontrol et — bağlantı kısa süre geçerli.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={magicLoading}
            className="btn-ghost mt-4 w-full"
          >
            {magicLoading ? "Bağlantı gönderiliyor..." : "Şifresiz giriş bağlantısı gönder"}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Hesabın yok mu?{" "}
        <Link href="/register" className="font-semibold text-brand">
          Kayıt ol
        </Link>
      </p>
    </div>
  );
}
