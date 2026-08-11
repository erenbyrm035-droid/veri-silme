"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MailWarning, RefreshCw, LogOut } from "lucide-react";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function resend() {
    if (!email) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="card text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral/15 text-coral">
        <MailWarning size={26} />
      </span>
      <h1 className="mt-4 text-xl font-bold">E-postanı doğrula</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Panele erişmek için{" "}
        {email && <span className="font-medium text-fg">{email}</span>} adresine
        gönderdiğimiz doğrulama bağlantısına tıkla.
      </p>

      {sent && (
        <p className="mt-4 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          Doğrulama e-postası tekrar gönderildi.
        </p>
      )}

      <button onClick={resend} disabled={loading} className="btn-primary mt-6 w-full">
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        {loading ? "Gönderiliyor..." : "Tekrar Gönder"}
      </button>

      <form action="/auth/signout" method="post" className="mt-3">
        <button type="submit" className="btn-ghost w-full">
          <LogOut size={16} /> Çıkış yap
        </button>
      </form>
    </div>
  );
}
