"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Crown, Sparkles, Minus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURE_LABELS, FEATURE_DETAIL, FREE_LIMITS, planById,
  type PlanId, type FeatureKey,
} from "@/lib/premium/plans";
import { startCheckout, cancelPremium } from "@/lib/billing/actions";
import { isPlayBillingAvailable, buyWithPlay } from "@/lib/billing/play-client";

/**
 * Özellik listesi `plans.ts`'ten TÜRETİLİR.
 * Elle yazıldığında listede olmayan özellikler satılabiliyordu — nitekim
 * `pdf_export`, `custom_theme` ve `custom_avatar` uygulamada karşılığı olmadığı
 * hâlde aylarca duyuruldu. Artık tek kaynak plan tanımı.
 */
const PREMIUM_FEATURES = planById("premium_yearly").features;

type Billing = "monthly" | "yearly";

/** Ücretsiz planda gerçekten neyin sınırlı olduğu — şeffaf karşılaştırma. */
const FREE_VALUE: Partial<Record<FeatureKey, string>> = {
  ai_unlimited: `Günde ${FREE_LIMITS.aiPerDay} mesaj`,
  unlimited_programs: `${FREE_LIMITS.maxPrograms} program`,
  unlimited_diets: `${FREE_LIMITS.maxDiets} plan · ${FREE_LIMITS.dietMaxSpan} gün`,
};

export function PremiumClient({
  currentPlan, isPremium, premiumUntil,
}: { currentPlan: PlanId; isPremium: boolean; premiumUntil: string | null }) {
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = React.useState<PlanId | null>(null);
  const [canceling, setCanceling] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [billing, setBilling] = React.useState<Billing>("yearly");

  const monthly = planById("premium_monthly");
  const yearly = planById("premium_yearly");
  const lifetime = planById("lifetime");
  const active = billing === "yearly" ? yearly : monthly;

  // Yıllıkta aylık eşdeğer fiyat + tasarruf oranı — "2 ay bedava" iddiasını
  // rakamla gösteriyoruz, sadece pazarlama cümlesi olarak bırakmıyoruz.
  const yearlyPerMonth = Math.round((yearly.priceTry ?? 0) / 12);
  const savingPct = monthly.priceTry
    ? Math.round((1 - (yearly.priceTry ?? 0) / (monthly.priceTry * 12)) * 100)
    : 0;

  async function doCancel() {
    setCanceling(true); setMsg(null);
    const res = await cancelPremium();
    setCanceling(false); setConfirmCancel(false);
    if (res.ok) { setMsg("Premium üyeliğin iptal edildi."); setTimeout(() => window.location.reload(), 800); }
    else setMsg(res.error ?? "İptal edilemedi.");
  }

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("success")) setMsg("🎉 Ödeme alındı! Premium üyeliğin aktif.");
    else if (q.get("canceled")) {
      const reason = q.get("reason");
      setMsg("Ödeme tamamlanmadı. İstediğin zaman tekrar deneyebilirsin." + (reason ? ` (${decodeURIComponent(reason)})` : ""));
    }
  }, []);

  async function upgrade(plan: PlanId) {
    setMsg(null); setPendingPlan(plan);
    try {
      // Play Store uygulaması (TWA) içindeysek → Google Play Billing.
      // Başarısız olursa (web/izin yok) sessizce iyzico'ya düşeriz.
      const sku = planById(plan).playSku;
      if (isPlayBillingAvailable() && sku) {
        const res = await buyWithPlay(sku).catch(() => ({ ok: false as const }));
        if (res.ok) { window.location.href = "/premium?success=1"; return; }
      }
      const res = await startCheckout(plan);
      if (res.ok && res.url) { window.location.href = res.url; return; }
      setMsg(res.error ?? "Ödeme başlatılamadı. Lütfen tekrar deneyin.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ödeme başlatılamadı. Lütfen tekrar deneyin.");
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Başlık */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">
          <Crown size={13} /> Premium
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Potansiyelini aç</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          Sınırsız AI koç ve diyetisyen, kamerayla form analizi, sesli koç ve
          postür analizi.
        </p>

        {isPremium && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-emerald-400">
              Şu an Premium üyesin
              {premiumUntil ? ` · ${new Date(premiumUntil).toLocaleDateString("tr-TR")} tarihine kadar` : ""}.
            </p>
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className="text-xs text-fg-muted underline underline-offset-2 hover:text-coral"
              >
                Üyeliği iptal et
              </button>
            ) : (
              <div className="mx-auto flex max-w-xs flex-col items-center gap-2 rounded-xl border border-coral/30 bg-coral/5 p-3">
                <p className="text-xs text-fg-muted">Premium iptal edilsin mi? Erişimin hemen sona erer.</p>
                <div className="flex gap-2">
                  <button onClick={doCancel} disabled={canceling}
                    className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                    {canceling ? "İptal ediliyor…" : "Evet, iptal et"}
                  </button>
                  <button onClick={() => setConfirmCancel(false)} disabled={canceling}
                    className="rounded-lg bg-ink-soft px-3 py-1.5 text-xs font-semibold text-fg">
                    Vazgeç
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {msg && (
        <p className="mx-auto max-w-md rounded-xl bg-ink-soft px-4 py-3 text-center text-sm text-fg-muted">
          {msg}
        </p>
      )}

      {/* Aylık ↔ Yıllık */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-ink-border bg-ink-soft p-1">
          {(["monthly", "yearly"] as Billing[]).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              aria-pressed={billing === b}
              className={cn(
                "relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                billing === b ? "text-black" : "text-fg-muted hover:text-fg"
              )}
            >
              {billing === b && (
                <motion.span
                  layoutId="billing-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-brand"
                />
              )}
              <span className="relative z-10">
                {b === "monthly" ? "Aylık" : "Yıllık"}
                {b === "yearly" && savingPct > 0 && (
                  <span className={cn("ml-1.5 text-[10px] font-black", billing === b ? "text-black/70" : "text-brand")}>
                    %{savingPct} indirim
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Seçili plan kartı */}
      <AnimatePresence mode="wait">
        <motion.div
          key={billing}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="relative overflow-hidden rounded-2xl border border-brand bg-brand/5 p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{active.name}</h2>
              <p className="text-sm text-fg-muted">{active.tagline}</p>
            </div>
            {active.id === currentPlan && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                Mevcut planın
              </span>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tight">{active.priceLabel}</span>
            <span className="text-sm text-fg-muted">{active.period}</span>
          </div>
          {billing === "yearly" && (
            <p className="mt-1 text-xs text-fg-muted">
              Aylık karşılığı <span className="font-bold text-fg">₺{yearlyPerMonth}</span> —
              aylık plana göre yılda ₺{((monthly.priceTry ?? 0) * 12 - (yearly.priceTry ?? 0)).toLocaleString("tr-TR")} tasarruf.
            </p>
          )}

          {active.id !== currentPlan && (
            <button
              onClick={() => upgrade(active.id)}
              disabled={pendingPlan !== null}
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-60"
            >
              {pendingPlan === active.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {pendingPlan === active.id ? "Yönlendiriliyor…" : "Premium'a Geç"}
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Karşılaştırma tablosu */}
      <div className="overflow-hidden rounded-2xl border border-ink-border bg-ink-card">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-ink-border px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
          <span>Özellik</span>
          <span className="w-16 text-center">Free</span>
          <span className="w-16 text-center text-brand">Premium</span>
        </div>
        {PREMIUM_FEATURES.map((f) => (
          <div key={f} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-ink-border/60 px-4 py-3 last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{FEATURE_LABELS[f]}</p>
              <p className="text-[11px] leading-snug text-fg-muted">{FEATURE_DETAIL[f]}</p>
            </div>
            <span className="w-16 text-center text-[11px] font-semibold text-fg-muted">
              {FREE_VALUE[f] ?? <Minus size={14} className="mx-auto text-fg-muted/50" />}
            </span>
            <span className="w-16 text-center">
              <Check size={16} className="mx-auto text-brand" />
            </span>
          </div>
        ))}
      </div>

      {/* Lifetime */}
      {lifetime.id !== currentPlan && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#FFD34D]/30 bg-[#FFD34D]/5 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFD34D]/15 text-[#FFD34D]">
            <Crown size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{lifetime.name} · {lifetime.priceLabel}</p>
            <p className="text-[11px] text-fg-muted">{lifetime.tagline}</p>
          </div>
          <button
            onClick={() => upgrade("lifetime")}
            disabled={pendingPlan !== null}
            className="shrink-0 rounded-xl border border-[#FFD34D]/40 bg-[#FFD34D]/10 px-3.5 py-2 text-xs font-bold text-[#FFD34D] disabled:opacity-60"
          >
            {pendingPlan === "lifetime" ? "Yönlendiriliyor…" : "Satın al"}
          </button>
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-fg-muted">
        Ödemeler güvenli sağlayıcı üzerinden işlenir. İstediğin zaman iptal edebilirsin.
        Satın alarak <a href="/mesafeli-satis" className="text-brand underline">Mesafeli Satış Sözleşmesi</a>,{" "}
        <a href="/iptal-iade" className="text-brand underline">İptal &amp; İade Politikası</a> ve{" "}
        <a href="/terms" className="text-brand underline">Kullanım Şartları</a>&apos;nı kabul etmiş olursun.
        Tüm fiyatlara KDV dahildir.
      </p>
    </div>
  );
}

