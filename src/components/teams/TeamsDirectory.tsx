"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, Users, Sparkles, ChevronRight, KeyRound, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Segments, Avatar, compact } from "./shared";
import { createTeam, joinByCode } from "@/lib/teams/actions";
import type { TeamSummary } from "@/lib/teams/types";
import { SmartImage } from "@/components/ui/SmartImage";

type Sort = "total" | "weekly" | "members";

const SORTS: { value: Sort; label: string }[] = [
  { value: "total", label: "Toplam XP" },
  { value: "weekly", label: "Haftalık" },
  { value: "members", label: "Üye" },
];

export function TeamsDirectory({ initial, myTeam }: { initial: TeamSummary[]; myTeam: TeamSummary | null }) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("total");
  const [modal, setModal] = React.useState<null | "create" | "code">(null);

  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? initial.filter((t) => t.name.toLowerCase().includes(needle) || (t.city ?? "").toLowerCase().includes(needle))
      : initial;
    const key: keyof TeamSummary = sort === "total" ? "total_xp" : sort === "weekly" ? "weekly_xp" : "member_count";
    return [...filtered].sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [initial, q, sort]);

  return (
    <div className="space-y-4">
      {/* Kendi takımım */}
      {myTeam && <MyTeamCard team={myTeam} />}

      {/* Aksiyonlar */}
      {!myTeam && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => setModal("create")} className="btn-primary flex items-center justify-center gap-2">
            <Plus size={18} /> Takım Kur
          </button>
          <button
            onClick={() => setModal("code")}
            className="flex items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-soft px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand/40"
          >
            <KeyRound size={17} /> Kodla Katıl
          </button>
        </div>
      )}

      {/* Arama + sıralama */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Takım veya şehir ara…"
            className="input w-full !pl-9"
          />
        </div>
        <Segments value={sort} onChange={setSort} options={SORTS} size="sm" />
      </div>

      {/* Liste */}
      {list.length === 0 ? (
        <Glass className="p-10 text-center">
          <Users size={26} className="mx-auto mb-2 text-fg-muted/60" />
          <p className="text-sm font-semibold">Takım bulunamadı</p>
          <p className="mt-1 text-xs text-fg-muted">İlk takımı sen kurabilirsin.</p>
        </Glass>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {list.map((t, i) => <TeamCard key={t.id} team={t} index={i} />)}
        </div>
      )}

      {modal === "create" && <CreateTeamModal onClose={() => setModal(null)} />}
      {modal === "code" && <JoinCodeModal onClose={() => setModal(null)} />}
    </div>
  );
}

function MyTeamCard({ team }: { team: TeamSummary }) {
  return (
    <Link href={`/teams/${team.slug}`}>
      <Glass className="relative overflow-hidden border-brand/30 p-4 transition-colors hover:border-brand/60">
        {team.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <SmartImage src={team.cover_url} alt="" fill sizes="100vw" className="object-cover opacity-20" />
        )}
        <div className="relative flex items-center gap-3">
          <Avatar src={team.logo_url} name={team.name} size={52} ring="ring-2 ring-brand/50" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Takımın</p>
            <p className="truncate text-lg font-black">{team.name}</p>
            <p className="text-xs text-fg-muted">
              Seviye {team.level} · {team.member_count} üye · {compact(team.total_xp)} XP
            </p>
          </div>
          <ChevronRight size={20} className="shrink-0 text-fg-muted" />
        </div>
      </Glass>
    </Link>
  );
}

function TeamCard({ team, index }: { team: TeamSummary; index: number }) {
  const medal = team.rank === 1 ? "🥇" : team.rank === 2 ? "🥈" : team.rank === 3 ? "🥉" : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link href={`/teams/${team.slug}`}>
        <Glass className="group relative overflow-hidden p-3.5 transition-colors hover:border-brand/40">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar src={team.logo_url} name={team.name} size={46} />
              {medal && <span className="absolute -right-1 -top-1 text-sm">{medal}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-bold">{team.name}</p>
                {team.is_member && <Shield size={13} className="shrink-0 text-brand" />}
              </div>
              <p className="truncate text-[11px] text-fg-muted">
                Sv {team.level} · {team.member_count}/{team.member_limit} üye
                {team.city ? ` · ${team.city}` : ""}
              </p>
              <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                <span className="font-bold text-brand tabular-nums">{compact(team.total_xp)} XP</span>
                {team.weekly_xp > 0 && (
                  <span className="flex items-center gap-1 text-fg-muted tabular-nums">
                    <Sparkles size={11} /> {compact(team.weekly_xp)}
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold text-fg-muted tabular-nums">#{team.rank}</span>
          </div>
        </Glass>
      </Link>
    </motion.div>
  );
}

// --- Modaller ---------------------------------------------------------------
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-ink-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <p className="mb-3 text-lg font-bold">{title}</p>
        {children}
      </motion.div>
    </div>
  );
}

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [city, setCity] = React.useState("");
  const [policy, setPolicy] = React.useState<"open" | "request" | "invite">("open");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await createTeam({ name, description: desc, city, country: "Türkiye", joinPolicy: policy });
    setBusy(false);
    if (res.ok && res.data) router.push(`/teams/${res.data.slug}`);
    else setErr(res.error ?? "Oluşturulamadı.");
  }

  return (
    <Modal title="Takım Kur" onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Takım adı" className="input w-full" autoFocus />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Kısa açıklama (isteğe bağlı)" rows={2} className="input w-full resize-none" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Şehir (isteğe bağlı)" className="input w-full" />
        <div>
          <p className="mb-1.5 text-xs font-semibold text-fg-muted">Katılım</p>
          <Segments
            value={policy}
            onChange={setPolicy}
            size="sm"
            options={[
              { value: "open", label: "Herkese açık" },
              { value: "request", label: "Onaylı" },
              { value: "invite", label: "Davetli" },
            ]}
          />
        </div>
        {err && <p className="text-xs text-coral">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-ink-border bg-ink-soft py-2.5 text-sm font-semibold">Vazgeç</button>
          <button onClick={submit} disabled={busy || name.trim().length < 3} className="btn-primary flex-1">
            {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Kur"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function JoinCodeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await joinByCode(code);
    setBusy(false);
    if (res.ok && res.data) router.push(`/teams/${res.data.slug}`);
    else setErr(res.error ?? "Katılınamadı.");
  }

  return (
    <Modal title="Kodla Katıl" onClose={onClose}>
      <div className="space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="ABC123"
          maxLength={40}
          className={cn("input w-full text-center text-lg font-black tracking-[0.3em]")}
          autoFocus
        />
        <p className="text-center text-[11px] text-fg-muted">Takım kurucusundan aldığın 6 haneli kodu gir.</p>
        {err && <p className="text-center text-xs text-coral">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-ink-border bg-ink-soft py-2.5 text-sm font-semibold">Vazgeç</button>
          <button onClick={submit} disabled={busy || !code.trim()} className="btn-primary flex-1">
            {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Katıl"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
