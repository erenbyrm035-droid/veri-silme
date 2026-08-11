"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RefreshCw, Trophy, Zap, Award, Flame, type LucideIcon } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/features/admin/components/ui/dialog";
import { upsertGamRow, deleteGamRow, resyncAllPlayers } from "./actions";
import type { GamAdminData } from "./queries";

type FieldType = "text" | "number" | "checkbox" | "select" | "textarea" | "json";
interface Field { key: string; label: string; type: FieldType; options?: { value: string; label: string }[]; full?: boolean; }
interface Entity {
  table: string; title: string; addable: boolean; idKey: string;
  fields: Field[];
  columns: { key: string; label: string }[];
}

const TIER_OPTS = ["bronze", "silver", "gold", "platinum", "diamond", "legend"].map((v) => ({ value: v, label: v }));
const COOLDOWN_OPTS = [{ value: "none", label: "Yok" }, { value: "daily", label: "Günlük" }, { value: "once", label: "Bir kez" }];
const METRIC_OPTS = ["workouts_count", "total_volume", "exercises_count", "posture_count", "ai_count", "pr_count", "water_days", "protein_days", "streak_days", "active_days"].map((v) => ({ value: v, label: v }));
const CH_METRIC_OPTS = ["workouts", "water_ml", "steps", "protein_g", "mobility"].map((v) => ({ value: v, label: v }));
const REWARD_TYPE_OPTS = ["premium_days", "profile_frame", "theme", "ai_avatar", "badge", "exercise_pack", "program", "diet_pack"].map((v) => ({ value: v, label: v }));
const PERIOD_OPTS = ["weekly", "monthly", "yearly", "all_time"].map((v) => ({ value: v, label: v }));
const SCOPE_OPTS = ["global", "country", "city", "gym", "team", "friends"].map((v) => ({ value: v, label: v }));

const ENTITIES: Record<string, Entity> = {
  xp_rules: {
    table: "xp_rules", title: "XP Kuralları", addable: true, idKey: "event_key",
    fields: [
      { key: "event_key", label: "Olay Anahtarı", type: "text" }, { key: "label", label: "Etiket", type: "text" },
      { key: "xp", label: "XP", type: "number" }, { key: "category", label: "Kategori", type: "text" },
      { key: "cooldown", label: "Bekleme", type: "select", options: COOLDOWN_OPTS }, { key: "sort_order", label: "Sıra", type: "number" },
      { key: "enabled", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "label", label: "Etiket" }, { key: "event_key", label: "Anahtar" }, { key: "xp", label: "XP" }, { key: "cooldown", label: "Bekleme" }],
  },
  levels: {
    table: "levels", title: "Seviyeler", addable: true, idKey: "level",
    fields: [
      { key: "level", label: "Seviye", type: "number" }, { key: "title", label: "Başlık", type: "text" },
      { key: "min_xp", label: "Min XP", type: "number" }, { key: "color", label: "Renk (#hex)", type: "text" },
      { key: "icon", label: "İkon", type: "text" }, { key: "sort_order", label: "Sıra", type: "number" },
    ],
    columns: [{ key: "level", label: "Seviye" }, { key: "title", label: "Başlık" }, { key: "min_xp", label: "Min XP" }],
  },
  badges: {
    table: "badges", title: "Rozetler", addable: true, idKey: "id",
    fields: [
      { key: "key", label: "Anahtar", type: "text" }, { key: "name", label: "Ad", type: "text" },
      { key: "tier", label: "Kademe", type: "select", options: TIER_OPTS }, { key: "description", label: "Açıklama", type: "textarea", full: true },
      { key: "icon", label: "İkon", type: "text" }, { key: "color", label: "Renk", type: "text" },
      { key: "sort_order", label: "Sıra", type: "number" }, { key: "enabled", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Ad" }, { key: "tier", label: "Kademe" }, { key: "key", label: "Anahtar" }],
  },
  achievements: {
    table: "achievements", title: "Başarımlar", addable: true, idKey: "id",
    fields: [
      { key: "key", label: "Anahtar", type: "text" }, { key: "name", label: "Ad", type: "text" },
      { key: "description", label: "Açıklama", type: "textarea", full: true }, { key: "category", label: "Kategori", type: "text" },
      { key: "metric", label: "Metrik", type: "select", options: METRIC_OPTS }, { key: "target", label: "Hedef", type: "number" },
      { key: "xp_reward", label: "XP Ödülü", type: "number" }, { key: "icon", label: "İkon", type: "text" },
      { key: "sort_order", label: "Sıra", type: "number" }, { key: "enabled", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Ad" }, { key: "metric", label: "Metrik" }, { key: "target", label: "Hedef" }, { key: "xp_reward", label: "XP" }],
  },
  weekly_challenges: {
    table: "weekly_challenges", title: "Haftalık Görevler", addable: true, idKey: "id",
    fields: [
      { key: "week_start", label: "Hafta Başı (YYYY-MM-DD)", type: "text" }, { key: "key", label: "Anahtar", type: "text" },
      { key: "title", label: "Başlık", type: "text" }, { key: "description", label: "Açıklama", type: "textarea", full: true },
      { key: "metric", label: "Metrik", type: "select", options: CH_METRIC_OPTS }, { key: "target", label: "Hedef", type: "number" },
      { key: "xp_reward", label: "XP Ödülü", type: "number" }, { key: "icon", label: "İkon", type: "text" },
      { key: "active", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "title", label: "Başlık" }, { key: "metric", label: "Metrik" }, { key: "target", label: "Hedef" }, { key: "week_start", label: "Hafta" }],
  },
  seasons: {
    table: "seasons", title: "Sezonlar", addable: true, idKey: "id",
    fields: [
      { key: "number", label: "No", type: "number" }, { key: "name", label: "Ad", type: "text" },
      { key: "theme", label: "Tema", type: "text" }, { key: "starts_on", label: "Başlangıç (YYYY-MM-DD)", type: "text" },
      { key: "ends_on", label: "Bitiş (YYYY-MM-DD)", type: "text" }, { key: "active", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "number", label: "No" }, { key: "name", label: "Ad" }, { key: "starts_on", label: "Başlangıç" }, { key: "ends_on", label: "Bitiş" }],
  },
  season_tracks: {
    table: "season_tracks", title: "Battle Pass", addable: true, idKey: "id",
    fields: [
      { key: "season_id", label: "Sezon ID", type: "text" },
      { key: "tier", label: "Kademe", type: "number" },
      { key: "req_xp", label: "Gereken Sezon XP", type: "number" },
      { key: "free_reward", label: 'Ücretsiz ödül (JSON) — {"type":"coins","value":50,"label":"50 coin"}', type: "json", full: true },
      { key: "premium_reward", label: 'Premium ödül (JSON) — boş {} bırakılabilir', type: "json", full: true },
    ],
    columns: [{ key: "tier", label: "Kademe" }, { key: "req_xp", label: "Gereken XP" }, { key: "season_id", label: "Sezon" }],
  },
  reward_catalog: {
    table: "reward_catalog", title: "Ödüller", addable: true, idKey: "id",
    fields: [
      { key: "key", label: "Anahtar", type: "text" }, { key: "name", label: "Ad", type: "text" },
      { key: "description", label: "Açıklama", type: "textarea", full: true }, { key: "type", label: "Tür", type: "select", options: REWARD_TYPE_OPTS },
      { key: "value", label: "Değer (JSON)", type: "json", full: true }, { key: "cost_coins", label: "Coin", type: "number" },
      { key: "icon", label: "İkon", type: "text" }, { key: "sort_order", label: "Sıra", type: "number" }, { key: "enabled", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Ad" }, { key: "type", label: "Tür" }, { key: "cost_coins", label: "Coin" }],
  },
  leaderboards: {
    table: "leaderboards", title: "Liderlik", addable: true, idKey: "id",
    fields: [
      { key: "key", label: "Anahtar", type: "text" }, { key: "name", label: "Ad", type: "text" },
      { key: "period", label: "Dönem", type: "select", options: PERIOD_OPTS }, { key: "scope", label: "Kapsam", type: "select", options: SCOPE_OPTS },
      { key: "metric", label: "Metrik", type: "text" }, { key: "sort_order", label: "Sıra", type: "number" }, { key: "enabled", label: "Aktif", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "Ad" }, { key: "period", label: "Dönem" }, { key: "scope", label: "Kapsam" }],
  },
  teams: {
    table: "teams", title: "Takımlar", addable: false, idKey: "id",
    fields: [
      { key: "name", label: "Ad", type: "text" }, { key: "description", label: "Açıklama", type: "textarea", full: true },
      { key: "badge", label: "Rozet", type: "text" }, { key: "color", label: "Renk", type: "text" }, { key: "points", label: "Puan", type: "number" },
    ],
    columns: [{ key: "name", label: "Ad" }, { key: "points", label: "Puan" }, { key: "member_count", label: "Üye" }],
  },
};

const TAB_ORDER = ["xp_rules", "levels", "badges", "achievements", "weekly_challenges", "seasons", "season_tracks", "reward_catalog", "leaderboards", "teams"];

export function GamificationAdmin({ data }: { data: GamAdminData }) {
  const router = useRouter();
  const [resyncing, setResyncing] = React.useState(false);
  const [resyncMsg, setResyncMsg] = React.useState<string | null>(null);

  const rowsByTable: Record<string, Record<string, unknown>[]> = {
    xp_rules: data.xpRules, levels: data.levels, badges: data.badges, achievements: data.achievements,
    weekly_challenges: data.challenges, seasons: data.seasons, season_tracks: data.seasonTracks, reward_catalog: data.rewards,
    leaderboards: data.leaderboards, teams: data.teams,
  } as unknown as Record<string, Record<string, unknown>[]>;

  async function onResync() {
    setResyncing(true); setResyncMsg(null);
    const res = await resyncAllPlayers();
    setResyncing(false);
    setResyncMsg(res.ok ? `${res.data?.count ?? 0} oyuncu yeniden hesaplandı.` : res.error ?? "Hata");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gamification</h1>
          <p className="mt-1 text-sm text-fg-muted">XP, seviye, rozet, başarım, görev, sezon, ödül ve takım yönetimi.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onResync} disabled={resyncing}>
          <RefreshCw size={15} className={resyncing ? "animate-spin" : ""} /> Tüm Oyuncuları Yeniden Hesapla
        </Button>
      </div>
      {resyncMsg && <p className="text-sm text-brand">{resyncMsg}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox icon={Trophy} label="Oyuncu" value={data.stats.players} />
        <StatBox icon={Zap} label="Toplam XP" value={data.stats.totalXp.toLocaleString("tr-TR")} />
        <StatBox icon={Award} label="Kazanılan Rozet" value={data.stats.badgesEarned} />
        <StatBox icon={Flame} label="Aktif Seri" value={data.stats.activeStreaks} />
      </div>

      <Tabs defaultValue="xp_rules">
        <TabsList>
          {TAB_ORDER.map((t) => <TabsTrigger key={t} value={t}>{ENTITIES[t].title}</TabsTrigger>)}
        </TabsList>
        {TAB_ORDER.map((t) => (
          <TabsContent key={t} value={t}>
            <EntityTable entity={ENTITIES[t]} rows={rowsByTable[t]} badges={data.badges} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <Icon size={17} className="text-brand" />
      <span className="text-xl font-bold tracking-tight">{value}</span>
      <span className="text-xs text-fg-muted">{label}</span>
    </Card>
  );
}

function EntityTable({ entity, rows, badges }: { entity: Entity; rows: Record<string, unknown>[]; badges: GamAdminData["badges"] }) {
  const [editing, setEditing] = React.useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = React.useState(false);

  function openNew() { setEditing({}); setOpen(true); }
  function openEdit(r: Record<string, unknown>) { setEditing(r); setOpen(true); }

  return (
    <div className="space-y-3">
      {entity.addable && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openNew}><Plus size={15} /> Yeni Ekle</Button>
        </div>
      )}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
                {entity.columns.map((c) => <th key={c.key} className="px-4 py-2.5 font-medium">{c.label}</th>)}
                <th className="px-4 py-2.5 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={entity.columns.length + 1} className="px-4 py-8 text-center text-fg-muted">Kayıt yok.</td></tr>}
              {rows.map((r, i) => (
                <tr key={String(r[entity.idKey] ?? i)} className="border-b border-ink-border/60 last:border-0">
                  {entity.columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5">
                      {c.key === "tier" ? <Badge variant="secondary">{String(r[c.key])}</Badge> : String(r[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-fg-muted hover:bg-fg/5 hover:text-fg"><Pencil size={15} /></button>
                      <DeleteButton table={entity.table} id={r[entity.idKey] as string | number} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <EntityForm entity={entity} row={editing} open={open} onOpenChange={setOpen} badges={badges} />
    </div>
  );
}

function DeleteButton({ table, id }: { table: string; id: string | number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  async function onDelete() {
    if (!confirm("Bu kaydı silmek istediğine emin misin?")) return;
    setPending(true);
    await deleteGamRow(table, id);
    setPending(false);
    router.refresh();
  }
  return (
    <button onClick={onDelete} disabled={pending} className="rounded-lg p-1.5 text-coral hover:bg-coral/10 disabled:opacity-50"><Trash2 size={15} /></button>
  );
}

function EntityForm({ entity, row, open, onOpenChange, badges }: {
  entity: Entity; row: Record<string, unknown> | null; open: boolean; onOpenChange: (v: boolean) => void; badges: GamAdminData["badges"];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const init: Record<string, unknown> = {};
    for (const f of entity.fields) {
      let v = row?.[f.key];
      if (f.type === "json" && v && typeof v === "object") v = JSON.stringify(v);
      init[f.key] = v ?? (f.type === "checkbox" ? true : f.type === "number" ? 0 : "");
    }
    // badge_id başarımlarda opsiyonel
    if (entity.table === "achievements") init.badge_id = row?.badge_id ?? "";
    setValues(init); setError(null);
  }, [open, row, entity]);

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function onSave() {
    setPending(true); setError(null);
    const payload = { ...values };
    if (row?.[entity.idKey] != null) payload[entity.idKey] = row[entity.idKey];
    if (entity.table === "achievements" && !payload.badge_id) delete payload.badge_id;
    const res = await upsertGamRow(entity.table, payload);
    setPending(false);
    if (!res.ok) return setError(res.error ?? "Kaydedilemedi.");
    onOpenChange(false);
    router.refresh();
  }

  const isEdit = row?.[entity.idKey] != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Düzenle" : "Yeni"} · {entity.title}</DialogTitle></DialogHeader>
        {error && <p className="mb-3 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {entity.fields.map((f) => (
            <div key={f.key} className={f.full || f.type === "textarea" || f.type === "json" ? "col-span-2" : ""}>
              <Label>{f.label}</Label>
              {f.type === "checkbox" ? (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} className="h-4 w-4 accent-brand" /> Aktif
                </label>
              ) : f.type === "select" ? (
                <Select value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === "textarea" || f.type === "json" ? (
                <textarea value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} rows={f.type === "json" ? 2 : 3}
                  className="mt-1 w-full rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-brand" />
              ) : (
                <Input type={f.type === "number" ? "number" : "text"} value={String(values[f.key] ?? "")}
                  onChange={(e) => set(f.key, f.type === "number" ? e.target.value : e.target.value)} />
              )}
            </div>
          ))}
          {entity.table === "achievements" && (
            <div className="col-span-2">
              <Label>Rozet</Label>
              <Select value={String(values.badge_id ?? "")} onChange={(e) => set("badge_id", e.target.value)}>
                <option value="">— Rozet yok —</option>
                {badges.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.tier})</option>)}
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button size="sm" onClick={onSave} disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
