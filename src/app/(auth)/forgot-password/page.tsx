"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });
    setLoading(false);
    if (error) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand">
          <MailCheck size={26} />
        </span>
        <h1 className="mt-4 text-xl font-bold">E-postanı kontrol et</h1>
        <p className="mt-2 text-sm text-fg-muted">
          <span className="font-medium text-fg">{email}</span> adresine şifre
          sıfırlama bağlantısı gönderdik. Bağlantıya tıklayıp yeni şifreni
          belirle.
        </p>
        <Link href="/login" className="btn-ghost mt-6 w-full">
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <Link
        href="/login"
        className="mb-4 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Giriş
      </Link>
      <h1 className="text-2xl font-bold">Şifreni mi unuttun?</h1>
      <p className="mt-1 text-sm text-fg-muted">
        E-posta adresini gir, sana sıfırlama bağlantısı gönderelim.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
        </button>
      </form>
    </div>
  );
}
