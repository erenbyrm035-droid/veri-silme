"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD_LABEL } from "@/lib/gamification/constants";
import { loadLeaderboard, saveLeaderboardRegion } from "@/lib/gamification/actions";
import type { LeaderboardPeriod, LeaderboardScope, LeaderboardRow } from "@/lib/database.types";
import type { LeaderboardResult } from "@/lib/gamification/queries";
import { SmartImage } from "@/components/ui/SmartImage";

const SCOPES: { id: LeaderboardScope; label: string; icon: string }[] = [
  { id: "global", label: "Global", icon: "🌍" },
  { id: "country", label: "Ülke", icon: "🇹🇷" },
  { id: "city", label: "Şehir", icon: "📍" },
];
const PERIODS: LeaderboardPeriod[] = ["weekly", "monthly", "yearly", "all_time"];
const PAGE = 25;

function PremiumSegmented<T extends string>({
  value, onChange, options, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
  size?: "sm" | "md";
}) {
  const id = React.useId();
  return (
    <div
      role="tablist"
      className="inline-flex w-full items-center gap-1 rounded-xl border border-ink-border bg-ink-soft/60 p-1 backdrop-blur sm:w-auto"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-lg font-semibold transition-colors duration-200 sm:flex-none",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-[13px]",
              active ? "text-black" : "text-fg-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-brand shadow-[0_2px_10px_-2px_rgb(var(--brand)/0.55)]"
              />
            )}
            <span className="relative z-10">
              {o.icon && <span className="mr-1">{o.icon}</span>}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LeaderboardTab({ initial }: { initial: LeaderboardResult }) {
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("weekly");
  const [scope, setScope] = React.useState<LeaderboardScope>("global");
  const [data, setData] = React.useState<LeaderboardResult>(initial);
  const [shown, setShown] = React.useState(PAGE);
  const [pending, start] = React.useTransition();

  const refresh = React.useCallback((p: LeaderboardPeriod, s: LeaderboardScope) => {
    setPeriod(p); setScope(s); setShown(PAGE);
    start(async () => setData(await loadLeaderboard(p, s, null, { limit: 200 })));
  }, []);

  const periodOpts = React.useMemo(
    () => PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] })),
    []
  );
  const scopeOpts = React.useMemo(
    () => SCOPES.map((s) => ({ value: s.id, label: s.label, icon: s.icon })),
    []
  );

  const visible = React.useMemo(() => data.rows.slice(0, shown), [data.rows, shown]);
  const podium = React.useMemo(() => visible.filter((r) => r.rank <= 3), [visible]);
  const rest = React.useMemo(() => visible.filter((r) => r.rank > 3), [visible]);
  const meOutside = data.me && !visible.some((r) => r.user_id === data.me!.user_id);

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <PremiumSegmented value={period} onChange={(v) => refresh(v, scope)} options={periodOpts} />
        <PremiumSegmented value={scope} onChange={(v) => refresh(period, v)} options={scopeOpts} size="sm" />
      </div>

      {/* Bölge etiketi + yarışmacı sayısı */}
      {data.total > 0 && (
        <p className="px-0.5 text-xs text-fg-muted">
          {scope === "global" ? "Dünya geneli" : data.scopeValue}
          {" · "}
          {data.total.toLocaleString("tr-TR")} sporcu
        </p>
      )}

      <div className={cn("space-y-4 transition-opacity duration-200", pending && "opacity-40")}>
        {data.needsProfile ? (
          <RegionPrompt scope={scope} onSaved={() => refresh(period, scope)} />
        ) : data.rows.length === 0 ? (
          <div className="rounded-2xl border border-ink-border bg-ink-card p-8 text-center">
            <Trophy size={26} className="mx-auto mb-2 text-fg-muted/60" />
            <p className="text-sm font-semibold">Bu kategoride henüz sıralama yok</p>
            <p className="mt-1 text-xs text-fg-muted">
              Antrenman yap, su ve beslenmeni kaydet — XP kazanınca burada görüneceksin.
            </p>
          </div>
        ) : (
          <>
            {podium.length > 0 && <Podium rows={podium} meId={data.me?.user_id} />}
            {rest.length > 0 && (
              <div className="space-y-1.5">
                {rest.map((r) => (
                  <LeaderRow key={r.user_id} row={r} highlight={data.me?.user_id === r.user_id} />
                ))}
              </div>
            )}

            {shown < data.rows.length && (
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="w-full rounded-xl border border-ink-border bg-ink-soft py-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
              >
                Daha fazla göster ({data.rows.length - shown})
              </button>
            )}

            {meOutside && data.me && (
              <div className="space-y-1.5 border-t border-ink-border pt-3">
                <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Senin sıran</p>
                <LeaderRow row={data.me} highlight />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Ülke/şehir bilgisi yoksa kullanıcıdan ister. */
function RegionPrompt({ scope, onSaved }: { scope: LeaderboardScope; onSaved: () => void }) {
  const isCountry = scope === "country";
  const [value, setValue] = React.useState(isCountry ? "Türkiye" : "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    const v = value.trim();
    if (!v) return;
    setSaving(true); setErr(null);
    const res = isCountry
      ? await saveLeaderboardRegion(v, undefined)
      : await saveLeaderboardRegion(undefined, v);
    setSaving(false);
    if (res.ok) onSaved();
    else setErr(res.error ?? "Kaydedilemedi.");
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 text-center">
      <span className="mb-2 block text-3xl">{isCountry ? "🇹🇷" : "📍"}</span>
      <p className="text-sm font-bold">{isCountry ? "Ülkeni seç" : "Şehrini gir"}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
        {isCountry
          ? "Ülke sıralamasında yer alabilmen için ülke bilgin gerekiyor."
          : "Şehir sıralamasında yer alabilmen için şehir bilgin gerekiyor."}
      </p>
      <div className="mx-auto mt-4 flex max-w-xs gap-2">
        {isCountry ? (
          <select value={value} onChange={(e) => setValue(e.target.value)} className="input flex-1">
            {["Türkiye", "Almanya", "Hollanda", "Avusturya", "Fransa", "İngiltere", "ABD", "Azerbaycan", "KKTC", "Diğer"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="İstanbul"
            className="input flex-1"
            autoFocus
          />
        )}
        <button onClick={save} disabled={saving || !value.trim()} className="btn-primary shrink-0">
          {saving ? "…" : "Kaydet"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-coral">{err}</p>}
    </div>
  );
}

const PODIUM_STYLE: Record<number, { ring: string; bg: string; text: string; medal: string; glow: string }> = {
  1: { ring: "ring-[#FFD34D]", bg: "from-[#FFD34D]/20 to-transparent", text: "text-[#FFD34D]", medal: "🥇", glow: "shadow-[0_0_28px_-8px_#FFD34D]" },
  2: { ring: "ring-[#C9D2DC]", bg: "from-[#C9D2DC]/18 to-transparent", text: "text-[#C9D2DC]", medal: "🥈", glow: "shadow-[0_0_24px_-10px_#C9D2DC]" },
  3: { ring: "ring-[#E0955C]", bg: "from-[#E0955C]/18 to-transparent", text: "text-[#E0955C]", medal: "🥉", glow: "shadow-[0_0_24px_-10px_#E0955C]" },
};

/** İlk 3 için altın/gümüş/bronz kürsü. */
function Podium({ rows, meId }: { rows: LeaderboardRow[]; meId?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((r) => {
        const s = PODIUM_STYLE[r.rank];
        const mine = r.user_id === meId;
        return (
          <motion.div
            key={r.user_id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-2xl border border-ink-border bg-gradient-to-br p-3.5 sm:flex-col sm:text-center",
              s.bg, mine && "border-brand"
            )}
          >
            <span className="absolute right-2.5 top-2 text-lg sm:left-2.5 sm:right-auto">{s.medal}</span>
            <Avatar row={r} className={cn("h-12 w-12 ring-2", s.ring, s.glow)} />
            <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
              <p className="truncate text-sm font-bold">
                {r.full_name ?? "Anonim"}{mine && " (Sen)"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted sm:justify-center">
                <span>Sv {r.level}</span>
                {r.streak > 0 && <span className="text-amber-400">🔥{r.streak}</span>}
                <Delta value={r.delta} />
              </p>
              <p className={cn("mt-1 text-base font-black tabular-nums", s.text)}>
                {r.score.toLocaleString("tr-TR")}
                <span className="ml-1 text-[10px] font-bold opacity-70">XP</span>
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Avatar({ row, className }: { row: LeaderboardRow; className?: string }) {
  if (row.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <SmartImage src={row.avatar_url} alt={row.full_name ?? "Sporcu"} width={40} height={40} className={cn("shrink-0 rounded-full border border-ink-border object-cover", className)} />;
  }
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-ink-soft text-sm font-bold text-fg-muted", className)}>
      {(row.full_name ?? "V").charAt(0).toUpperCase()}
    </span>
  );
}

/** Sıra değişimi göstergesi (önceki döneme göre). */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] font-semibold text-brand">YENİ</span>;
  if (value === 0) return <span className="text-[10px] text-fg-muted/70">—</span>;
  const up = value > 0;
  return (
    <span className={cn("text-[10px] font-bold", up ? "text-emerald-400" : "text-coral")}>
      {up ? "↑" : "↓"}{Math.abs(value)}
    </span>
  );
}

const LeaderRow = React.memo(function LeaderRow({ row, highlight }: { row: LeaderboardRow; highlight?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
        highlight ? "border-brand bg-brand/10" : "border-ink-border bg-ink-card hover:border-ink-border/80 hover:bg-ink-soft/40"
      )}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-fg-muted">{row.rank}</span>
      <Avatar row={row} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {row.full_name ?? "Anonim"}{highlight && " (Sen)"}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span>Seviye {row.level}</span>
          {row.streak > 0 && <span className="text-amber-400">🔥 {row.streak}</span>}
          {row.city && <span className="truncate">· {row.city}</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-bold tabular-nums text-brand">{row.score.toLocaleString("tr-TR")}</span>
        <Delta value={row.delta} />
      </div>
    </motion.div>
  );
});

// --- Challenges --------------------------------------------------------------
