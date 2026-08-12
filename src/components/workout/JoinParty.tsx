"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Loader2, ArrowRight } from "lucide-react";
import { joinLiveSession } from "@/lib/social/actions";
import { useRouter } from "next/navigation";

// ============================================================================
// Antrenman sonu — arkadaşların hâlâ çalışıyorsa partilerine katıl.
//
// NEDEN "BAŞLAT" DEĞİL "KATIL": Antrenmanı BİTİRMİŞ birine yeni parti
// açtırmak anlamsız — parti birlikte çalışmak için. Bitirdiğinde işe yarayan
// şey, hâlâ çalışan arkadaşlarına katılmak. Parti BAŞLATMA seçeneği antrenman
// öncesi özet ekranında, yani gerçekten işe yaradığı yerde.
//
// Açık parti yoksa bu kart HİÇ görünmez; boş bir "parti yok" kutusu
// göstermek ekranı kirletirdi.
// ============================================================================

export function JoinParty({
  sessionId,
  title,
  hostName,
  participants,
  alreadyIn,
}: {
  sessionId: string;
  title: string;
  hostName: string;
  participants: number;
  alreadyIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [hata, setHata] = React.useState<string | null>(null);

  async function katil() {
    setBusy(true);
    setHata(null);
    const res = await joinLiveSession(sessionId);
    setBusy(false);
    if (res.ok) router.push("/feed");
    else setHata(res.error ?? "Katılınamadı.");
  }

  return (
    <div className="card space-y-2.5 border-brand/30 bg-brand/5">
      <div className="flex items-center gap-2">
        <Users size={16} className="shrink-0 text-brand" />
        <h3 className="text-sm font-semibold">Arkadaşların şu an çalışıyor</h3>
      </div>
      <p className="text-xs text-fg-muted">
        <strong className="text-fg">{title}</strong> · {hostName} başlattı ·{" "}
        {participants} kişi katıldı
      </p>
      {hata && <p className="text-xs text-coral">{hata}</p>}
      {alreadyIn ? (
        <Link href="/feed" className="btn-ghost w-full">
          Partiye git <ArrowRight size={15} />
        </Link>
      ) : (
        <button onClick={katil} disabled={busy} className="btn-primary w-full disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />} Partiye katıl
        </button>
      )}
    </div>
  );
}
