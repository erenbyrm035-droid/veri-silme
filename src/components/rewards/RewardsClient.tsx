"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins, Gift, Lock, Check, Loader2, X, Copy, Clock, Package, Star,
  Ticket, Crown, Award, Sparkles, ExternalLink, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Segments } from "@/components/teams/shared";
import { claimRewardById } from "@/lib/rewards/actions";
import type { RewardsPage, RewardView } from "@/lib/rewards/queries";
import { SmartImage } from "@/components/ui/SmartImage";

type Tab = "all" | "available" | "history";

const TYPE_ICON: Record<string, React.ReactNode> = {
  premium_days: <Crown size={15} />,
  badge: <Award size={15} />,
  theme: <Sparkles size={15} />,
  profile_frame: <Star size={15} />,
  ai_avatar: <Sparkles size={15} />,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "İnceleniyor", approved: "Onaylandı", rejected: "Reddedildi",
  delivered: "Teslim edildi", cancelled: "İptal edildi", shipped: "Kargoda",
  active: "Sahipsin", consumed: "Kullanıldı",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-[#FFB020]/15 text-[#FFB020]",
  approved: "bg-brand/15 text-brand",
  delivered: "bg-brand/15 text-brand",
  active: "bg-brand/15 text-brand",
  consumed: "bg-white/8 text-fg-muted",
  shipped: "bg-[#8FE3FF]/15 text-[#8FE3FF]",
  rejected: "bg-coral/15 text-coral",
  cancelled: "bg-coral/15 text-coral",
};

export function RewardsClient({ data }: { data: RewardsPage }) {
  const [tab, setTab] = React.useState<Tab>("all");
  const [claimed, setClaimed] = React.useState<{ name: string; coupon: string | null; status: string } | null>(null);

  const available = data.rewards.filter((r) => r.eligible && !r.claimed);

  const list = tab === "available" ? available : data.rewards;

  return (
    <div className="space-y-4">
      {/* Bakiye */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-card/70 p-4 backdrop-blur-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(70% 60% at 10% 0%, rgba(255,211,77,0.12) 0%, transparent 65%)" }}
        />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFD34D]/15 text-[#FFD34D]">
            <Coins size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#FFD34D]">Bakiyen</p>
            <p className="text-2xl font-black tabular-nums leading-none">
              {data.coins.toLocaleString("tr-TR")}
              <span className="ml-1.5 text-sm font-semibold text-fg-muted">coin</span>
            </p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              Seviye {data.level} · {data.totalXp.toLocaleString("tr-TR")} XP
            </p>
          </div>
          {available.length > 0 && (
            <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-bold text-brand">
              {available.length} ödül hazır
            </span>
          )}
        </div>
        <p className="relative mt-2.5 text-[11px] leading-relaxed text-fg-muted">
          Coin; XP, tamamlanan başarım ve haftalık görevlerden kazanılır.
          Her 10 XP = 1 coin, başarım +25, görev +15.
        </p>
      </div>

      <Segments
        value={tab}
        onChange={setTab}
        size="sm"
        className="w-full"
        options={[
          { value: "all" as Tab, label: `Tümü (${data.rewards.length})` },
          { value: "available" as Tab, label: available.length ? `Hazır (${available.length})` : "Hazır" },
          { value: "history" as Tab, label: "Geçmiş", icon: <History size={13} /> },
        ]}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {tab === "history" ? (
            <HistoryList history={data.history} />
          ) : list.length === 0 ? (
            <Empty
              title={tab === "available" ? "Henüz alabileceğin ödül yok" : "Ödül kataloğu boş"}
              desc={
                tab === "available"
                  ? "Antrenman yaptıkça coin biriktir; şartları sağladığın ödüller burada belirir."
                  : "Yöneticiler yakında ödül ekleyecek."
              }
            />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {list.map((r, i) => (
                <RewardCard key={r.id} reward={r} index={i} onClaimed={setClaimed} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {claimed && <SuccessSheet info={claimed} onClose={() => setClaimed(null)} />}
      </AnimatePresence>
    </div>
  );
}

function RewardCard({
  reward, index, onClaimed,
}: {
  reward: RewardView;
  index: number;
  onClaimed: (v: { name: string; coupon: string | null; status: string }) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function claim() {
    setBusy(true); setErr(null);
    const res = await claimRewardById(reward.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Talep alınamadı.");
    onClaimed({ name: reward.name, coupon: res.coupon ?? null, status: res.status ?? "pending" });
    router.refresh();
  }

  const soldOut = reward.stock !== null && reward.stock <= 0;
  const expiresIn = reward.expires_at
    ? Math.ceil((new Date(reward.expires_at).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.2) }}
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-2xl border bg-ink-card/70 backdrop-blur-xl",
          reward.featured ? "border-[#FFD34D]/35" : "border-white/10",
          reward.claimed && "opacity-80"
        )}
      >
        {/* Görsel */}
        <div className="relative h-28 shrink-0 bg-ink-soft/60">
          {reward.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <SmartImage src={reward.image_url} alt={reward.name} fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">{reward.icon ?? "🎁"}</div>
          )}
          {reward.featured && (
            <span className="absolute left-2 top-2 rounded-full bg-[#FFD34D] px-2 py-0.5 text-[10px] font-black text-black">
              ÖNE ÇIKAN
            </span>
          )}
          {reward.sponsor_name && (
            <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
              {reward.sponsor_name}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3.5">
          <div className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 text-brand">{TYPE_ICON[reward.type] ?? <Gift size={15} />}</span>
            <p className="min-w-0 flex-1 font-bold leading-tight">{reward.name}</p>
          </div>
          {reward.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-fg-muted">{reward.description}</p>
          )}

          {/* Meta */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
            {reward.cost_coins > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-[#FFD34D]/12 px-1.5 py-0.5 font-bold text-[#FFD34D]">
                <Coins size={10} /> {reward.cost_coins}
              </span>
            )}
            {reward.req_level > 0 && (
              <span className="rounded-md bg-white/6 px-1.5 py-0.5 font-semibold text-fg-muted">
                Sv {reward.req_level}+
              </span>
            )}
            {reward.stock !== null && (
              <span className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold",
                soldOut ? "bg-coral/12 text-coral" : "bg-white/6 text-fg-muted")}>
                <Package size={10} /> {soldOut ? "Tükendi" : `${reward.stock} adet`}
              </span>
            )}
            {expiresIn !== null && expiresIn > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-white/6 px-1.5 py-0.5 font-semibold text-fg-muted">
                <Clock size={10} /> {expiresIn} gün
              </span>
            )}
          </div>

          {/* Neden alamıyorum */}
          {!reward.eligible && reward.reasons.length > 0 && (
            <ul className="mt-2.5 space-y-0.5">
              {reward.reasons.map((r) => (
                <li key={r} className="flex items-start gap-1 text-[11px] text-coral">
                  <X size={11} className="mt-0.5 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          )}

          {err && <p className="mt-2 text-[11px] text-coral">{err}</p>}

          {/* Aksiyon */}
          <div className="mt-auto pt-3">
            {reward.claimed ? (
              <div className="space-y-1.5">
                <span className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold",
                  STATUS_TONE[reward.claimStatus ?? "pending"] ?? "bg-white/8 text-fg-muted"
                )}>
                  <Check size={13} /> {STATUS_LABEL[reward.claimStatus ?? "pending"] ?? "Talep edildi"}
                </span>
                {reward.couponIssued && <CouponBox code={reward.couponIssued} />}
              </div>
            ) : reward.eligible ? (
              <button onClick={claim} disabled={busy} className="btn-primary w-full !py-2 !text-sm">
                {busy ? <Loader2 size={15} className="mx-auto animate-spin" /> : (
                  <span className="inline-flex items-center gap-1.5"><Gift size={15} /> Ödülü Talep Et</span>
                )}
              </button>
            ) : (
              <span className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-ink-soft/60 px-3 py-2 text-xs font-semibold text-fg-muted">
                <Lock size={13} /> Şartlar sağlanmadı
              </span>
            )}
          </div>

          {reward.external_url && (
            <a
              href={reward.external_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-fg-muted hover:text-fg"
            >
              Detaylar <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CouponBox({ code }: { code: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch { /* pano yoksa sessizce geç */ }
      }}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/8 px-2.5 py-1.5"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-brand">
        <Ticket size={12} /> {code}
      </span>
      {done ? <Check size={13} className="text-brand" /> : <Copy size={12} className="text-fg-muted" />}
    </button>
  );
}

function HistoryList({ history }: { history: RewardsPage["history"] }) {
  if (history.length === 0) {
    return <Empty title="Henüz ödül talebin yok" desc="Talep ettiğin ödüller ve durumları burada listelenir." />;
  }
  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-card/70 p-3 backdrop-blur-xl">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-soft text-lg">
            {h.reward_icon ?? "🎁"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{h.reward_name}</p>
            <p className="text-[11px] text-fg-muted">
              {new Date(h.claimed_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
              {h.spent_coins > 0 && ` · ${h.spent_coins} coin`}
            </p>
            {h.admin_note && <p className="mt-0.5 text-[11px] text-fg-muted/80">{h.admin_note}</p>}
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
            STATUS_TONE[h.status] ?? "bg-white/8 text-fg-muted"
          )}>
            {STATUS_LABEL[h.status] ?? h.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-card/70 p-10 text-center backdrop-blur-xl">
      <motion.span
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ink-soft/70 text-fg-muted"
      >
        <Gift size={24} />
      </motion.span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">{desc}</p>
    </div>
  );
}

function SuccessSheet({
  info, onClose,
}: { info: { name: string; coupon: string | null; status: string }; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-ink-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center sm:rounded-3xl sm:pb-6"
      >
        <motion.span
          initial={{ scale: 0.6 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand text-3xl text-black"
        >
          🎉
        </motion.span>
        <p className="text-lg font-black">Ödül talebin alındı</p>
        <p className="mt-1 text-sm text-fg-muted">{info.name}</p>
        <p className="mt-2 text-xs text-fg-muted">
          {info.status === "delivered"
            ? "Ödülün hesabına tanımlandı."
            : "Talebin incelemeye alındı; onaylandığında bildirim göndereceğiz."}
        </p>
        {info.coupon && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold text-fg-muted">Kupon kodun</p>
            <CouponBox code={info.coupon} />
          </div>
        )}
        <button onClick={onClose} className="btn-primary mt-4 w-full">Tamam</button>
      </motion.div>
    </motion.div>
  );
}
