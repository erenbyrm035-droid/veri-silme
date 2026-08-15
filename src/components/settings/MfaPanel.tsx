"use client";

import * as React from "react";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import {
  mfaDurumu,
  mfaKayitBaslat,
  mfaDogrula,
  mfaKapat,
  type KayitBilgisi,
} from "@/lib/auth/mfa-actions";

// ============================================================================
// İki adımlı doğrulama paneli (Ayarlar → Güvenlik).
//
// Üç durum: kapalı → kayıt (QR + kod) → açık.
//
// KURTARMA KODU UYARISI GÖRÜNÜR OLMALI. Supabase TOTP'de kurtarma kodu
// üretmiyor; telefonunu kaybeden kullanıcı hesabına giremez. Bunu küçük
// puntoyla geçiştirmek, kullanıcıyı kilitlenmeye hazırlıksız yakalar —
// uyarı, açma düğmesinin yanında ve okunur boyutta.
// ============================================================================

export function MfaPanel() {
  const [yukleniyor, setYukleniyor] = React.useState(true);
  const [etkin, setEtkin] = React.useState(false);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [kayit, setKayit] = React.useState<KayitBilgisi | null>(null);
  const [kod, setKod] = React.useState("");
  const [hata, setHata] = React.useState<string | null>(null);
  const [bilgi, setBilgi] = React.useState<string | null>(null);
  const [mesgul, setMesgul] = React.useState(false);
  const [kopyalandi, setKopyalandi] = React.useState(false);

  const durumYukle = React.useCallback(async () => {
    const r = await mfaDurumu();
    if (r.ok && r.data) {
      setEtkin(r.data.etkin);
      setFactorId(r.data.factorId);
    }
    setYukleniyor(false);
  }, []);

  React.useEffect(() => { void durumYukle(); }, [durumYukle]);

  async function baslat() {
    setHata(null); setBilgi(null); setMesgul(true);
    const r = await mfaKayitBaslat();
    setMesgul(false);
    if (!r.ok || !r.data) { setHata(r.error ?? "Başlatılamadı."); return; }
    setKayit(r.data);
  }

  async function dogrula() {
    if (!kayit) return;
    setHata(null); setMesgul(true);
    const r = await mfaDogrula(kayit.factorId, kod);
    setMesgul(false);
    if (!r.ok) { setHata(r.error ?? "Doğrulanamadı."); return; }
    setKayit(null); setKod("");
    setBilgi("İki adımlı doğrulama açıldı.");
    await durumYukle();
  }

  async function kapat() {
    if (!factorId) return;
    setHata(null); setMesgul(true);
    const r = await mfaKapat(factorId);
    setMesgul(false);
    if (!r.ok) { setHata(r.error ?? "Kapatılamadı."); return; }
    setBilgi("İki adımlı doğrulama kapatıldı.");
    await durumYukle();
  }

  if (yukleniyor) {
    return <div className="h-9 w-24 animate-pulse rounded-lg bg-ink-soft" />;
  }

  // --- Kayıt akışı ---------------------------------------------------------
  if (kayit) {
    return (
      <div className="w-full space-y-3">
        <p className="text-sm text-fg-muted">
          Kimlik doğrulayıcı uygulamanla (Google Authenticator, 1Password, Authy…)
          bu kodu tara, sonra uygulamadaki 6 haneli kodu gir.
        </p>

        {/* Supabase QR'ı data-URI olarak veriyor; harici istek yok. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={kayit.qr}
          alt="İki adımlı doğrulama QR kodu"
          className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
        />

        <div className="rounded-xl border border-ink-border bg-ink-soft p-3">
          <p className="text-xs text-fg-muted">QR taranamıyorsa bu anahtarı elle gir:</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs font-semibold">{kayit.gizliAnahtar}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(kayit.gizliAnahtar);
                setKopyalandi(true);
                setTimeout(() => setKopyalandi(false), 1500);
              }}
              aria-label="Anahtarı kopyala"
              className="shrink-0 rounded-lg border border-ink-border p-1.5 text-fg-muted hover:text-fg"
            >
              {kopyalandi ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="mfa-kod" className="label">6 haneli kod</label>
          <input
            id="mfa-kod"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="input mt-1.5 text-center text-lg tracking-[0.4em]"
          />
        </div>

        {hata && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{hata}</p>}

        <div className="flex gap-2">
          <button onClick={() => { setKayit(null); setKod(""); setHata(null); }} className="btn-ghost flex-1">
            Vazgeç
          </button>
          <button onClick={dogrula} disabled={mesgul || kod.length !== 6} className="btn-primary flex-1">
            {mesgul ? "Doğrulanıyor..." : "Doğrula ve aç"}
          </button>
        </div>
      </div>
    );
  }

  // --- Açık / kapalı -------------------------------------------------------
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${etkin ? "text-emerald-400" : "text-fg-muted"}`}>
          {etkin ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
          {etkin ? "Açık" : "Kapalı"}
        </span>
        <button
          onClick={etkin ? kapat : baslat}
          disabled={mesgul}
          className={etkin ? "btn-ghost px-4 py-2 text-sm" : "btn-primary px-4 py-2 text-sm"}
        >
          {mesgul ? "..." : etkin ? "Kapat" : "Aç"}
        </button>
      </div>

      {!etkin && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300/90">
          <strong>Önce şunu bil:</strong> kurtarma kodu verilmiyor. Telefonunu
          kaybedersen ya da doğrulayıcı uygulamayı silersen hesabına giremezsin;
          kurtarma için destekle iletişime geçmen gerekir. Doğrulayıcı
          uygulamanın yedeği olduğundan emin ol.
        </p>
      )}

      {hata && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{hata}</p>}
      {bilgi && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{bilgi}</p>}
    </div>
  );
}
