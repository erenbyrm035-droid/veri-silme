"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Gift, Check, X, Package, Truck, Clock, Coins, Plus, Pencil,
  Eye, EyeOff, Loader2, TrendingUp, Users, Award,
} from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Badge } from "@/features/admin/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { createReward, updateReward, toggleReward, decideClaim } from "./actions";
import type { AdminClaimRow, RewardsAdminData } from "./queries";
import type { RewardCatalogItem } from "@/lib/database.types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor", approved: "Onaylandı", rejected: "Reddedildi",
  delivered: "Teslim edildi", cancelled: "İptal", shipped: "Kargoda",
  active: "Aktif", consumed: "Kullanıldı",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "secondary"> = {
  pending: "warning", approved: "success", delivered: "success", active: "success",
  rejected: "danger", cancelled: "danger", shipped: "secondary", consumed: "secondary",
};

/** Talep sekmelerinin hangi durumları kapsadığı. */
const TAB_STATUSES: Record<string, string[]> = {
  pending: ["pending"],
  approved: ["approved"],
  shipped: ["shipped"],
  delivered: ["delivered", "active", "consumed"],
  rejected: ["rejected", "cancelled"],
};

export function RewardsAdmin({ data }: { data: RewardsAdminData }) {
  const [editing, setEditing] = React.useState<RewardCatalogItem | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="space-y-6">
      <StatsRow data={data} />

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">
            Talepler
            {data.stats.pending_claims > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-500">
                {data.stats.pending_claims}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog">Katalog ({data.rewards.length})</TabsTrigger>
          <TabsTrigger value="insights">İstatistik</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-4">
          <ClaimsPanel claims={data.claims} />
        </TabsContent>

        <TabsContent value="catalog" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Yeni Ödül
            </Button>
          </div>
          {creating && <RewardForm onDone={() => setCreating(false)} />}
          {editing && <RewardForm reward={editing} onDone={() => setEditing(null)} />}
          <CatalogList rewards={data.rewards} onEdit={setEditing} />
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <InsightsPanel data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsRow({ data }: { data: RewardsAdminData }) {
  const items = [
    { label: "Toplam Ödül", value: data.stats.total_rewards, icon: <Gift className="h-4 w-4" /> },
    { label: "Aktif Ödül", value: data.stats.active_rewards, icon: <Eye className="h-4 w-4" /> },
    { label: "Toplam Talep", value: data.stats.total_claims, icon: <Package className="h-4 w-4" /> },
    { label: "Bekleyen", value: data.stats.pending_claims, icon: <Clock className="h-4 w-4" /> },
    { label: "Teslim", value: data.stats.delivered_claims, icon: <Check className="h-4 w-4" /> },
    { label: "Harcanan Coin", value: data.stats.spent_coins, icon: <Coins className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((i) => (
        <Card key={i.label} className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{i.icon}{i.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{i.value.toLocaleString("tr-TR")}</p>
        </Card>
      ))}
    </div>
  );
}

const CLAIM_TABS: [string, string][] = [
  ["pending", "Bekleyen"], ["approved", "Onaylanan"], ["shipped", "Kargoda"],
  ["delivered", "Teslim"], ["rejected", "Reddedilen"],
];

function ClaimsPanel({ claims }: { claims: AdminClaimRow[] }) {
  // Tabs bileşeni durumu kendi içinde tuttuğu için her sekmenin içeriği
  // TabsContent ile ayrı verilir; dışarıdan state yönetmeye gerek yok.
  return (
    <Tabs defaultValue="pending">
      <TabsList>
        {CLAIM_TABS.map(([k, label]) => {
          const n = claims.filter((c) => TAB_STATUSES[k]?.includes(c.status)).length;
          return (
            <TabsTrigger key={k} value={k}>
              {label} {n > 0 && <span className="ml-1 text-xs opacity-70">({n})</span>}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {CLAIM_TABS.map(([k]) => {
        const filtered = claims.filter((c) => TAB_STATUSES[k]?.includes(c.status));
        return (
          <TabsContent key={k} value={k} className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Bu durumda talep yok"
                description="Kullanıcılar ödül talep ettiğinde burada listelenecek."
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((c) => <ClaimRow key={c.id} claim={c} />)}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function ClaimRow({ claim }: { claim: AdminClaimRow }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [showNote, setShowNote] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function decide(status: "approved" | "rejected" | "delivered" | "shipped") {
    setBusy(status); setErr(null);
    const res = await decideClaim({ claimId: claim.id, status, note: note.trim() || undefined });
    setBusy(null);
    if (!res.ok) return setErr(res.error ?? "İşlem yapılamadı.");
    setShowNote(false); setNote("");
    router.refresh();
  }

  const isPending = claim.status === "pending";
  const isApproved = claim.status === "approved";
  const isPhysical = claim.fulfillment_type === "physical";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-lg">
          {claim.reward_icon ?? "🎁"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{claim.reward_name}</p>
          <p className="text-sm text-muted-foreground">
            {claim.user_name} ·{" "}
            {new Date(claim.claimed_at).toLocaleDateString("tr-TR", {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            {claim.spent_coins > 0 && ` · ${claim.spent_coins} coin`}
          </p>
          {claim.coupon_issued && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">Kupon: {claim.coupon_issued}</p>
          )}
          {claim.admin_note && (
            <p className="mt-1 text-xs text-muted-foreground">Not: {claim.admin_note}</p>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[claim.status] ?? "secondary"}>
          {STATUS_LABEL[claim.status] ?? claim.status}
        </Badge>
      </div>

      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

      {(isPending || isApproved) && (
        <>
          {showNote && (
            <Textarea
              className="mt-3"
              rows={2}
              placeholder="Kullanıcıya iletilecek not (isteğe bağlı)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {isPending && (
              <Button size="sm" onClick={() => decide("approved")} disabled={!!busy}>
                {busy === "approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Onayla
              </Button>
            )}
            {isApproved && isPhysical && (
              <Button size="sm" variant="secondary" onClick={() => decide("shipped")} disabled={!!busy}>
                {busy === "shipped" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="mr-1 h-4 w-4" />}
                Kargoya Verildi
              </Button>
            )}
            {(isApproved || isPending) && (
              <Button size="sm" variant="secondary" onClick={() => decide("delivered")} disabled={!!busy}>
                {busy === "delivered" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="mr-1 h-4 w-4" />}
                Teslim Edildi
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => decide("rejected")} disabled={!!busy}>
              {busy === "rejected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />}
              Reddet
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNote((v) => !v)}>
              {showNote ? "Notu gizle" : "Not ekle"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Reddedilen taleplerde harcanan coin otomatik iade edilir, stok geri verilir.
          </p>
        </>
      )}
    </Card>
  );
}

function CatalogList({
  rewards, onEdit,
}: { rewards: RewardCatalogItem[]; onEdit: (r: RewardCatalogItem) => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(r: RewardCatalogItem) {
    setBusy(r.id);
    await toggleReward(r.id, !r.enabled);
    setBusy(null);
    router.refresh();
  }

  if (rewards.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title="Katalog boş"
        description="İlk ödülü ekleyerek başla."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rewards.map((r) => (
        <Card key={r.id} className="flex items-start gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xl">
            {r.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image_url} alt="" className="h-full w-full object-cover" />
            ) : (r.icon ?? "🎁")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold">{r.name}</p>
              {r.featured && <Badge variant="warning">Öne çıkan</Badge>}
              {!r.enabled && <Badge variant="secondary">Pasif</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">{r.key} · {r.fulfillment_type}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {r.cost_coins > 0 && <span>{r.cost_coins} coin</span>}
              {r.req_level > 0 && <span>· Sv {r.req_level}+</span>}
              {r.req_xp > 0 && <span>· {r.req_xp.toLocaleString("tr-TR")} XP</span>}
              {r.stock !== null && <span>· {r.stock} adet</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(r)} aria-label="Düzenle">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm" variant="ghost" onClick={() => toggle(r)} disabled={busy === r.id}
              aria-label={r.enabled ? "Yayından kaldır" : "Yayınla"}
            >
              {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" />
                : r.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RewardForm({ reward, onDone }: { reward?: RewardCatalogItem; onDone: () => void }) {
  const router = useRouter();
  const isEdit = !!reward;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [f, setF] = React.useState({
    key: reward?.key ?? "",
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    long_description: reward?.long_description ?? "",
    type: reward?.type ?? "badge",
    fulfillment_type: reward?.fulfillment_type ?? "digital",
    category: reward?.category ?? "",
    icon: reward?.icon ?? "",
    image_url: reward?.image_url ?? "",
    cost_coins: String(reward?.cost_coins ?? 0),
    req_xp: String(reward?.req_xp ?? 0),
    req_level: String(reward?.req_level ?? 0),
    req_team_level: String(reward?.req_team_level ?? 0),
    stock: reward?.stock === null || reward?.stock === undefined ? "" : String(reward.stock),
    expires_at: reward?.expires_at ? reward.expires_at.slice(0, 10) : "",
    terms: reward?.terms ?? "",
    coupon_code: reward?.coupon_code ?? "",
    external_url: reward?.external_url ?? "",
    sponsor_name: reward?.sponsor_name ?? "",
    sponsor_logo_url: reward?.sponsor_logo_url ?? "",
    value: reward?.value ? JSON.stringify(reward.value) : "",
    enabled: reward?.enabled ?? true,
    featured: reward?.featured ?? false,
    sort_order: String(reward?.sort_order ?? 0),
  });

  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setBusy(true); setErr(null);
    // Form alanları string tutulur; zod şeması `z.coerce` ile sayıya çevirir.
    const payload = { ...f } as unknown as Parameters<typeof createReward>[0];
    const res = isEdit ? await updateReward(reward!.id, payload) : await createReward(payload);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Kaydedilemedi.");
    onDone();
    router.refresh();
  }

  return (
    <Card className="space-y-4 p-5">
      <p className="font-semibold">{isEdit ? "Ödülü Düzenle" : "Yeni Ödül"}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Anahtar (benzersiz)">
          <Input value={f.key} onChange={(e) => set("key", e.target.value)} placeholder="viva-tshirt" disabled={isEdit} />
        </Field>
        <Field label="Başlık">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Viva Tişört" />
        </Field>
      </div>

      <Field label="Kısa açıklama">
        <Input value={f.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field label="Detaylı açıklama">
        <Textarea rows={3} value={f.long_description} onChange={(e) => set("long_description", e.target.value)} />
      </Field>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Ödül türü">
          <Select value={f.type} onChange={(v) => set("type", v)} options={[
            ["badge", "Özel Rozet"], ["premium_days", "Premium Üyelik"], ["theme", "Özel Tema"],
            ["profile_frame", "Profil Çerçevesi"], ["ai_avatar", "AI Avatar"],
            ["exercise_pack", "Egzersiz Paketi"], ["program", "Program"], ["diet_pack", "Diyet Paketi"],
          ]} />
        </Field>
        <Field label="Teslim şekli">
          <Select value={f.fulfillment_type} onChange={(v) => set("fulfillment_type", v)} options={[
            ["digital", "Dijital (anında)"], ["coupon", "Kupon kodu"], ["physical", "Fiziksel ürün"],
          ]} />
        </Field>
        <Field label="Kategori">
          <Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Giyim" />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="İkon (emoji)">
          <Input value={f.icon} onChange={(e) => set("icon", e.target.value)} placeholder="👕" />
        </Field>
        <Field label="Görsel URL">
          <Input value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Sıra">
          <Input type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
        </Field>
      </div>

      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Koşullar</p>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Coin bedeli">
          <Input type="number" value={f.cost_coins} onChange={(e) => set("cost_coins", e.target.value)} />
        </Field>
        <Field label="Gerekli XP">
          <Input type="number" value={f.req_xp} onChange={(e) => set("req_xp", e.target.value)} />
        </Field>
        <Field label="Gerekli seviye">
          <Input type="number" value={f.req_level} onChange={(e) => set("req_level", e.target.value)} />
        </Field>
        <Field label="Takım seviyesi">
          <Input type="number" value={f.req_team_level} onChange={(e) => set("req_team_level", e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Coin harcanır; XP / seviye / takım seviyesi yalnızca eşiktir, düşülmez.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Stok (boş = sınırsız)">
          <Input type="number" value={f.stock} onChange={(e) => set("stock", e.target.value)} />
        </Field>
        <Field label="Son kullanma">
          <Input type="date" value={f.expires_at} onChange={(e) => set("expires_at", e.target.value)} />
        </Field>
        <Field label="Kupon kodu">
          <Input value={f.coupon_code} onChange={(e) => set("coupon_code", e.target.value)} placeholder="VIVA20" />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Sponsor firma">
          <Input value={f.sponsor_name} onChange={(e) => set("sponsor_name", e.target.value)} />
        </Field>
        <Field label="Dış bağlantı">
          <Input value={f.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" />
        </Field>
      </div>

      <Field label="Kullanım koşulları">
        <Textarea rows={2} value={f.terms} onChange={(e) => set("terms", e.target.value)} />
      </Field>
      <Field label='Ödül yapılandırması (JSON — ör. {"days": 30})'>
        <Input value={f.value} onChange={(e) => set("value", e.target.value)} placeholder='{"days": 30}' />
      </Field>

      <div className="flex flex-wrap gap-4">
        <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Aktif" />
        <Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Öne çıkar" />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy || !f.key.trim() || !f.name.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Güncelle" : "Oluştur"}
        </Button>
        <Button variant="ghost" onClick={onDone}>Vazgeç</Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function InsightsPanel({ data }: { data: RewardsAdminData }) {
  const max = Math.max(1, ...data.daily.map((d) => d.claims));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <TrendingUp className="h-4 w-4" /> Son 14 gün · talep
        </p>
        <div className="flex h-32 items-end gap-1">
          {data.daily.map((d) => (
            <div key={d.d} className="flex flex-1 flex-col items-center gap-1" title={`${d.d}: ${d.claims}`}>
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${(d.claims / max) * 100}%`, minHeight: d.claims > 0 ? 4 : 1 }}
              />
              <span className="text-[9px] text-muted-foreground">{d.d.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <Award className="h-4 w-4" /> En popüler ödüller
        </p>
        {data.topRewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz talep yok.</p>
        ) : (
          <ul className="space-y-2">
            {data.topRewards.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="font-semibold tabular-nums">{r.claims}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" /> En çok talep eden kullanıcılar
        </p>
        {data.topUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz talep yok.</p>
        ) : (
          <ul className="space-y-2">
            {data.topUsers.map((u, i) => (
              <li key={u.name} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="text-xs text-muted-foreground">{u.coins} coin</span>
                <span className="font-semibold tabular-nums">{u.claims}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <Coins className="h-4 w-4" /> Ekonomi
        </p>
        <dl className="space-y-2 text-sm">
          <Row k="Toplam harcanan coin" v={data.stats.spent_coins.toLocaleString("tr-TR")} />
          <Row k="Teslim edilen" v={String(data.stats.delivered_claims)} />
          <Row k="Bekleyen" v={String(data.stats.pending_claims)} />
          <Row k="Reddedilen" v={String(data.stats.rejected_claims)} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-semibold tabular-nums">{v}</dd>
    </div>
  );
}
