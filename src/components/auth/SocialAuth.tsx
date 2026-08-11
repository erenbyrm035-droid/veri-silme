"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Provider } from "@supabase/supabase-js";

/**
 * Google / Apple ile giriş.
 * Supabase Dashboard > Authentication > Providers üzerinden ilgili sağlayıcı
 * (client ID/secret) yapılandırılmış olmalıdır. Yapılandırılmamışsa Supabase
 * anlaşılır bir hata döndürür ve kullanıcı bilgilendirilir.
 */
export function SocialAuth() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setError(null);
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    });
    if (error) {
      setError(
        `${provider === "google" ? "Google" : "Apple"} ile giriş şu an kullanılamıyor.`
      );
      setLoading(null);
    }
    // Başarılıysa tarayıcı sağlayıcıya yönlendirilir.
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={loading !== null}
          className="btn-ghost"
        >
          <GoogleIcon />
          {loading === "google" ? "..." : "Google"}
        </button>
        <button
          type="button"
          onClick={() => signIn("apple")}
          disabled={loading !== null}
          className="btn-ghost"
        >
          <AppleIcon />
          {loading === "apple" ? "..." : "Apple"}
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-ink-border" />
        <span className="text-xs text-fg-muted">veya e-posta ile</span>
        <span className="h-px flex-1 bg-ink-border" />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c.02 2.35 2.06 3.13 2.08 3.14-.02.05-.33 1.13-1.09 2.24-.65.96-1.33 1.91-2.4 1.93-1.05.02-1.39-.62-2.59-.62-1.2 0-1.58.6-2.57.64-1.03.04-1.82-1.04-2.48-2-1.35-1.95-2.38-5.5-1-7.9.69-1.19 1.92-1.95 3.25-1.97 1.01-.02 1.97.68 2.59.68.62 0 1.78-.84 3.01-.72.51.02 1.96.21 2.89 1.56-.08.05-1.72 1.01-1.7 3.01M14.4 4.6c.55-.66.92-1.59.82-2.51-.79.03-1.75.53-2.32 1.19-.51.58-.96 1.52-.84 2.42.88.07 1.78-.45 2.34-1.1" />
    </svg>
  );
}
