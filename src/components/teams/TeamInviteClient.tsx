"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { Glass } from "./shared";
import { joinByCode } from "@/lib/teams/actions";

/** Davet linkini tüketip kullanıcıyı takım sayfasına yönlendirir. */
export function TeamInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const res = await joinByCode(token);
      if (res.ok && res.data) router.replace(`/teams/${res.data.slug}`);
      else setError(res.error ?? "Bu davet geçersiz veya süresi dolmuş.");
    })();
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md py-16">
      <Glass className="p-8 text-center">
        {error ? (
          <>
            <AlertCircle size={28} className="mx-auto mb-3 text-coral" />
            <p className="text-base font-bold">Davet kullanılamadı</p>
            <p className="mt-1 text-sm text-fg-muted">{error}</p>
            <Link href="/teams" className="btn-primary mt-4 inline-flex">Takımlara dön</Link>
          </>
        ) : (
          <>
            <Users size={28} className="mx-auto mb-3 text-brand" />
            <p className="text-base font-bold">Takıma katılıyorsun…</p>
            <Loader2 size={20} className="mx-auto mt-3 animate-spin text-fg-muted" />
          </>
        )}
      </Glass>
    </div>
  );
}
