"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Copy, Check, Link2, QrCode, KeyRound, Loader2, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segments } from "./shared";
import { qrMatrix, qrSvgPath } from "@/lib/qr";
import { createInviteLink } from "@/lib/teams/actions";

type Mode = "link" | "qr" | "code";

export function InviteModal({
  teamId, slug, code, onClose,
}: { teamId: string; slug: string; code: string; onClose: () => void }) {
  const [mode, setMode] = React.useState<Mode>("link");
  const [token, setToken] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = token ? `${origin}/teams/katil/${token}` : `${origin}/teams/${slug}`;

  async function makeLink() {
    setBusy(true); setErr(null);
    const res = await createInviteLink(teamId, { days: 7 });
    setBusy(false);
    if (!res.ok || !res.data) return setErr(res.error ?? "Davet oluşturulamadı.");
    setToken(res.data.token);
  }

  async function share() {
    const text = `Viva'da takımıma katıl! Kod: ${code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Viva takım daveti", text, url: link }); return; } catch { /* iptal */ }
    }
    await copyText(`${text}\n${link}`);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold">Takıma Davet Et</p>
          <button onClick={onClose} aria-label="Kapat" className="rounded-lg p-1 text-fg-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>

        <Segments
          value={mode}
          onChange={setMode}
          size="sm"
          className="w-full"
          options={[
            { value: "link", label: "Link", icon: <Link2 size={13} /> },
            { value: "qr", label: "QR", icon: <QrCode size={13} /> },
            { value: "code", label: "Kod", icon: <KeyRound size={13} /> },
          ]}
        />

        <div className="mt-4">
          {mode === "link" && (
            <div className="space-y-3">
              <CopyField value={link} />
              <p className="text-[11px] text-fg-muted">
                {token
                  ? "Bu tek kullanımlık davet linki 7 gün geçerli."
                  : "Takım sayfasının linki. Onay gerektirmeyen tek tıkla katılım için özel davet linki oluştur."}
              </p>
              {!token && (
                <button onClick={makeLink} disabled={busy} className="btn-primary w-full">
                  {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Özel Davet Linki Oluştur (7 gün)"}
                </button>
              )}
              {err && <p className="text-xs text-coral">{err}</p>}
            </div>
          )}

          {mode === "qr" && (
            <div className="space-y-3 text-center">
              <QrView value={link} />
              <p className="text-[11px] text-fg-muted">Kamerayla okut, doğrudan takım sayfasına gitsin.</p>
            </div>
          )}

          {mode === "code" && (
            <div className="space-y-3 text-center">
              <div className="rounded-2xl border border-brand/30 bg-brand/8 py-5">
                <p className="text-3xl font-black tracking-[0.35em] text-brand">{code}</p>
              </div>
              <CopyField value={code} />
              <p className="text-[11px] text-fg-muted">
                Arkadaşın Takımlar sayfasında “Kodla Katıl” diyerek bu kodu girsin.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={share}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-soft py-2.5 text-sm font-semibold hover:border-brand/40"
        >
          <Share2 size={16} /> Paylaş
        </button>
      </motion.div>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [done, setDone] = React.useState(false);

  async function copy() {
    const ok = await copyText(value);
    if (!ok) return;
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-soft/60 px-3 py-2 text-xs outline-none"
      />
      <button
        onClick={copy}
        aria-label="Kopyala"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
          done ? "bg-brand text-black" : "border border-white/10 bg-ink-soft text-fg-muted hover:text-fg"
        )}
      >
        {done ? <Check size={16} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

function QrView({ value }: { value: string }) {
  const matrix = React.useMemo(() => {
    try { return qrMatrix(value); } catch { return null; }
  }, [value]);

  if (!matrix) {
    return <p className="py-8 text-xs text-fg-muted">QR oluşturulamadı.</p>;
  }

  const size = matrix.length;
  const quiet = 2;
  const total = size + quiet * 2;

  return (
    <div className="mx-auto w-fit rounded-2xl bg-white p-3">
      <svg
        viewBox={`0 0 ${total} ${total}`}
        width={200}
        height={200}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Takım davet QR kodu"
      >
        <rect width={total} height={total} fill="#fff" />
        <g transform={`translate(${quiet} ${quiet})`}>
          <path d={qrSvgPath(matrix)} fill="#000" />
        </g>
      </svg>
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* aşağıdaki yedeğe düş */ }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}
