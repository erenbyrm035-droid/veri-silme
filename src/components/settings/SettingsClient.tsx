"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, Palette, Globe, Ruler, Bell, Shield, Download, Trash2, Crown, FileText, LogOut, Check, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FontScaleControl, FontScaleIcon } from "@/components/theme/FontScale";
import { saveUserSettings, exportMyData, deleteMyAccount } from "@/lib/settings/actions";
import { PUSH_CATEGORY_LABELS, type PushCategory } from "@/lib/push/categories";
import type { UserSettings } from "@/lib/database.types";
import { useModal, modalProps } from "@/lib/a11y/use-modal";
import { MfaPanel } from "./MfaPanel";

const NOTIF_CATS = Object.keys(PUSH_CATEGORY_LABELS) as PushCategory[];

function Row({ icon: Icon, title, desc, children }: { icon: LucideIcon; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-border/60 py-3.5 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-soft text-fg-muted"><Icon size={17} /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {desc && <p className="truncate text-xs text-fg-muted">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-brand" : "bg-ink-soft ring-1 ring-inset ring-ink-border"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-card p-4">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsClient({ email, settings, isPremium }: { email: string; settings: UserSettings; isPremium: boolean }) {
  const router = useRouter();
  const [units, setUnits] = React.useState(settings.units);
  const [locale, setLocale] = React.useState(settings.locale);
  const [notif, setNotif] = React.useState<Record<string, boolean>>(settings.notif_prefs ?? {});
  const [privacy, setPrivacy] = React.useState<Record<string, boolean>>(settings.privacy ?? {});
  const [saved, setSaved] = React.useState(false);
  const [, start] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Hesap silme onayı klavyeyle kapanamıyordu — Esc yok, arka plana da
  // klavyeyle tıklanamaz. Kullanıcı pencerede kilitli kalıyordu.
  const silmeRef = useModal<HTMLDivElement>(confirmDelete, () => setConfirmDelete(false));
  const [deleteText, setDeleteText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function persist(patch: Parameters<typeof saveUserSettings>[0]) {
    start(async () => {
      const res = await saveUserSettings(patch);
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
    });
  }

  function toggleNotif(cat: string, v: boolean) { const next = { ...notif, [cat]: v }; setNotif(next); persist({ notif_prefs: next }); }
  function togglePrivacy(key: string, v: boolean) { const next = { ...privacy, [key]: v }; setPrivacy(next); persist({ privacy: next }); }

  async function onExport() {
    setBusy(true);
    const res = await exportMyData();
    setBusy(false);
    if (res.ok && res.data) {
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `viva-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    }
  }

  async function onDelete() {
    setBusy(true);
    const res = await deleteMyAccount();
    setBusy(false);
    if (res.ok) router.push("/login");
    else alert(res.error ?? "Hesap silinemedi.");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
          <p className="mt-1 text-sm text-fg-muted">{email}</p>
        </div>
        {saved && <span className="text-xs font-medium text-emerald-400">Kaydedildi ✓</span>}
      </div>

      <Section title="Hesap">
        <Row icon={User} title="Profil" desc="Ad, hedef ve fiziksel bilgiler">
          <Link href="/onboarding" className="text-sm font-semibold text-brand">Düzenle</Link>
        </Row>
        <Row icon={Crown} title="Premium" desc={isPremium ? "Aktif üyelik" : "Planları görüntüle"}>
          <Link href="/premium" className="text-sm font-semibold text-brand">{isPremium ? "Yönet" : "Yükselt"}</Link>
        </Row>
      </Section>

      <Section title="Güvenlik">
        {/* İki adımlı doğrulama kendi durumunu yönetiyor; Row'un dar sağ
            sütununa sığmıyor (QR + kod girişi). Tam genişlik veriliyor. */}
        <div className="px-4 py-3.5">
          <p className="text-sm font-semibold">İki adımlı doğrulama</p>
          <p className="mb-3 text-xs text-fg-muted">
            Şifrenin yanında doğrulayıcı uygulamadan 6 haneli kod
          </p>
          <MfaPanel />
        </div>
      </Section>

      <Section title="Görünüm & Bölge">
        <Row icon={Palette} title="Tema" desc="Açık / koyu / sistem"><ThemeToggle /></Row>
        <Row icon={FontScaleIcon} title="Yazı boyutu" desc="Arayüzün tamamını büyütür">
          <FontScaleControl />
        </Row>
        <Row icon={Globe} title="Dil">
          <select value={locale} onChange={(e) => { const v = e.target.value as "tr" | "en"; setLocale(v); persist({ locale: v }); }}
            className="rounded-lg border border-ink-border bg-ink-soft px-2.5 py-1.5 text-sm outline-none">
            <option value="tr">Türkçe</option><option value="en">English</option>
          </select>
        </Row>
        <Row icon={Ruler} title="Birimler">
          <select value={units} onChange={(e) => { const v = e.target.value as "metric" | "imperial"; setUnits(v); persist({ units: v }); }}
            className="rounded-lg border border-ink-border bg-ink-soft px-2.5 py-1.5 text-sm outline-none">
            <option value="metric">Metrik (kg, cm)</option><option value="imperial">Imperial (lb, in)</option>
          </select>
        </Row>
      </Section>

      <Section title="Bildirimler">
        {NOTIF_CATS.map((c) => (
          <Row key={c} icon={Bell} title={PUSH_CATEGORY_LABELS[c]}>
            <Toggle label={PUSH_CATEGORY_LABELS[c]} checked={notif[c] !== false} onChange={(v) => toggleNotif(c, v)} />
          </Row>
        ))}
      </Section>

      <Section title="Gizlilik">
        <Row icon={Shield} title="Profilim herkese açık" desc="Diğer kullanıcılar profilini görebilir">
          <Toggle label="Profilim herkese açık" checked={privacy.profile_public === true} onChange={(v) => togglePrivacy("profile_public", v)} />
        </Row>
        <Row icon={Shield} title="Liderlik tablosunda görün" desc="Sıralamalarda adın gösterilsin">
          <Toggle label="Liderlik tablosunda görün" checked={privacy.leaderboard_visible !== false} onChange={(v) => togglePrivacy("leaderboard_visible", v)} />
        </Row>
      </Section>

      <Section title="Verilerim (KVKK / GDPR)">
        <Row icon={Download} title="Verilerimi İndir" desc="Tüm verini JSON olarak indir">
          <button onClick={onExport} disabled={busy} className="rounded-lg bg-ink-soft px-3 py-1.5 text-sm font-semibold text-fg disabled:opacity-50">İndir</button>
        </Row>
        <Row icon={Trash2} title="Hesabımı Sil" desc="Hesabın ve tüm verilerin kalıcı silinir">
          <button onClick={() => setConfirmDelete(true)} className="rounded-lg bg-coral/15 px-3 py-1.5 text-sm font-semibold text-coral">Sil</button>
        </Row>
      </Section>

      <Section title="Yasal & Destek">
        {[["/privacy", "Gizlilik Politikası"], ["/terms", "Kullanım Şartları"], ["/support", "Destek"], ["/contact", "İletişim"], ["/about", "Sürüm & Hakkında"]].map(([href, label]) => (
          <Row key={href} icon={FileText} title={label}>
            <Link href={href} className="text-sm font-semibold text-brand">Aç</Link>
          </Row>
        ))}
      </Section>

      <form action="/auth/signout" method="post">
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-border bg-ink-card py-3 text-sm font-semibold text-fg-muted hover:text-fg">
          <LogOut size={16} /> Çıkış Yap
        </button>
      </form>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-ink-border bg-ink-card p-6" onClick={(e) => e.stopPropagation()}
            ref={silmeRef} {...modalProps("hesap-sil-baslik")}>
            <h3 id="hesap-sil-baslik" className="text-lg font-bold text-coral">Hesabını sil</h3>
            <p className="mt-2 text-sm text-fg-muted">
              Bu işlem <strong>geri alınamaz</strong>. Tüm antrenman, beslenme, XP ve profil verin kalıcı olarak silinir.
              Onaylamak için <strong>SİL</strong> yaz.
            </p>
            <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="SİL"
              className="mt-3 w-full rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-coral" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="rounded-xl bg-ink-soft px-4 py-2 text-sm font-semibold">Vazgeç</button>
              <button onClick={onDelete} disabled={deleteText !== "SİL" || busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                <Check size={14} /> Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
