"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocialAuth } from "@/components/auth/SocialAuth";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // E-posta doğrulaması kapalıysa oturum hemen açılır.
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo(
        "Kaydın oluşturuldu! E-postana gönderilen doğrulama bağlantısına tıkla, sonra giriş yap."
      );
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1 className="text-2xl font-bold">Hesap oluştur</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Ücretsiz başla, hedeflerine bugün adım at.
      </p>

      <div className="mt-6">
        <SocialAuth />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Ad Soyad</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input"
            placeholder="Adın Soyadın"
          />
        </div>
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
          <label className="label">Şifre</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="En az 6 karakter"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
            {info}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Oluşturuluyor..." : "Kayıt Ol"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Zaten hesabın var mı?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Giriş yap
        </Link>
      </p>
    </div>
  );
}
