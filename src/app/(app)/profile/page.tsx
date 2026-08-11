import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileCenter } from "@/lib/data/profile-center";
import { SectionCard, Field, ChipList, StatTile } from "@/components/profile/ui";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { formatNumber } from "@/lib/utils";
import {
  GOAL_MULTI_OPTIONS, GENDER_LABELS, ENVIRONMENT_LABELS, EXPERIENCE_LABELS,
  ACTIVITY_LEVEL_LABELS, EQUIPMENT_OPTIONS, INJURY_OPTIONS, ALLERGY_OPTIONS,
  NUTRITION_GOAL_LABELS, SMOKING_OPTIONS,
} from "@/lib/constants";
import {
  User, Target, Dumbbell, Salad, HeartPulse, BarChart3, Trophy, Settings2,
  Pencil, Crown, Flame, Zap, Sparkles, Calendar, LogOut, ChevronRight,
  Footprints, Droplet, Beef, Timer, Activity, Medal, Bell, Palette, Globe, Shield,
  Download, Trash2,
} from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";

export const dynamic = "force-dynamic";

const labelOf = (opts: { value: string; label: string }[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v;

function bmiInfo(h: number | null, w: number | null): { value: string; note: string } | null {
  if (!h || !w) return null;
  const bmi = w / Math.pow(h / 100, 2);
  const note = bmi < 18.5 ? "Zayıf" : bmi < 25 ? "Normal" : bmi < 30 ? "Fazla kilolu" : "Obez";
  return { value: bmi.toFixed(1), note };
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getProfileCenter(user.id);
  if (!data) redirect("/onboarding");

  const { profile: p, gam, stats, memberSince } = data;
  const bmi = bmiInfo(p.height_cm, p.weight_kg);
  const goalLabels = (p.goals ?? []).map((g) => labelOf(GOAL_MULTI_OPTIONS, g));
  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    : null;
  const durationH = Math.round(stats.durationMin / 60);

  return (
    <div className="space-y-5 pb-4">
      {/* ---- HEADER ---- */}
      <header className="glass relative overflow-hidden rounded-3xl p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <SmartImage src={p.avatar_url} alt={p.full_name ?? "Profil"} width={96} height={96} priority className="h-24 w-24 rounded-3xl border border-ink-border object-cover" />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-3xl border border-ink-border bg-ink-soft text-3xl font-black text-fg-muted">
                {(p.full_name ?? "V").charAt(0).toUpperCase()}
              </span>
            )}
            <span
              className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-xl border-2 border-ink text-xs font-black text-black"
              style={{ background: gam.levelColor }}
              title={`Seviye ${gam.level}`}
            >
              {gam.level}
            </span>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="truncate text-xl font-bold">{p.full_name || "Sporcu"}</h1>
              {p.is_premium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400/20 to-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-yellow-400">
                  <Crown size={11} /> PREMIUM
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">
              {gam.levelTitle}
              {memberSinceLabel && <> · <Calendar size={11} className="inline -mt-0.5" /> {memberSinceLabel}'den beri</>}
            </p>
            {p.bio && <p className="mt-2 text-sm text-fg-muted">{p.bio}</p>}

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { icon: Zap, label: "XP", value: formatNumber(gam.totalXp), color: "#A3E635" },
                { icon: Sparkles, label: "Fitness", value: gam.fitnessScore, color: "#34D399" },
                { icon: Flame, label: "Seri", value: `${gam.currentStreak}g`, color: "#FB7185" },
                { icon: Trophy, label: "Sıra", value: gam.leaderboardRank ? `#${gam.leaderboardRank}` : "—", color: "#FBBF24" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-ink-border bg-ink-card/60 p-2 text-center">
                  <s.icon size={15} className="mx-auto" style={{ color: s.color }} />
                  <p className="mt-1 text-sm font-bold tabular-nums">{s.value}</p>
                  <p className="text-[11px] text-fg-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href="/profile/edit" className="btn-primary mt-5 w-full sm:w-auto">
          <Pencil size={16} /> Profili Düzenle
        </Link>
      </header>

      {/* ---- 1. KİŞİSEL BİLGİLER ---- */}
      <SectionCard icon={User} title="Kişisel Bilgiler">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field label="Ad Soyad" value={p.full_name} />
          <Field label="Doğum Tarihi" value={p.birth_date ? new Date(p.birth_date).toLocaleDateString("tr-TR") : null} />
          <Field label="Yaş" value={p.age ? `${p.age}` : null} />
          <Field label="Cinsiyet" value={p.gender ? GENDER_LABELS[p.gender] : null} />
          <Field label="Boy" value={p.height_cm ? `${p.height_cm} cm` : null} />
          <Field label="Kilo" value={p.weight_kg ? `${p.weight_kg} kg` : null} />
          <Field label="Hedef Kilo" value={p.target_weight_kg ? `${p.target_weight_kg} kg` : null} />
          <Field label="BMI" value={bmi ? `${bmi.value} · ${bmi.note}` : null} />
          <Field label="Aktivite" value={p.activity_level ? ACTIVITY_LEVEL_LABELS[p.activity_level] : null} />
          <Field label="Meslek" value={p.occupation} />
        </div>
      </SectionCard>

      {/* ---- 2. HEDEFLER ---- */}
      <SectionCard icon={Target} title="Hedefler">
        <ChipList items={goalLabels} empty="Henüz hedef seçilmedi" />
      </SectionCard>

      {/* ---- 3. ANTRENMAN TERCİHLERİ ---- */}
      <SectionCard icon={Dumbbell} title="Antrenman Tercihleri">
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field label="Ortam" value={p.training_environment ? ENVIRONMENT_LABELS[p.training_environment] : null} />
          <Field label="Deneyim" value={p.experience ? EXPERIENCE_LABELS[p.experience] : null} />
          <Field label="Haftalık Gün" value={p.weekly_training_days ? `${p.weekly_training_days} gün` : null} />
          <Field label="Süre" value={p.preferred_workout_duration ? `${p.preferred_workout_duration} dk` : null} />
        </div>
        <p className="label mt-4">Ekipmanlar</p>
        <ChipList items={(p.available_equipment ?? []).map((e) => labelOf(EQUIPMENT_OPTIONS, e))} empty="Belirtilmedi" />
      </SectionCard>

      {/* ---- 4. BESLENME ---- */}
      <SectionCard
        icon={Salad}
        title="Beslenme"
        action={<Link href="/nutrition/coach" className="text-xs font-semibold text-brand">AI Diyetisyen →</Link>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile icon={Flame} label="Kalori" value={formatNumber(p.daily_calorie_goal ?? 0)} />
          <StatTile icon={Beef} label="Protein" value={`${p.daily_protein_goal ?? 0}g`} color="#f472b6" />
          <StatTile icon={Salad} label="Karb." value={`${p.daily_carb_goal ?? 0}g`} color="#38BDF8" />
          <StatTile icon={Droplet} label="Yağ" value={`${p.daily_fat_goal ?? 0}g`} color="#FBBF24" />
          <StatTile icon={Droplet} label="Su" value={`${((p.daily_water_goal_ml ?? 0) / 1000).toFixed(1)}L`} color="#22D3EE" />
        </div>
        {p.nutrition_goal && (
          <p className="mt-3 text-xs text-fg-muted">Hedef: <span className="font-semibold text-fg">{NUTRITION_GOAL_LABELS[p.nutrition_goal]}</span></p>
        )}
      </SectionCard>

      {/* ---- 5. SAĞLIK ---- */}
      <SectionCard icon={HeartPulse} title="Sağlık">
        <p className="label">Sakatlıklar</p>
        <ChipList items={(p.injuries ?? []).filter((i) => i !== "none").map((i) => labelOf(INJURY_OPTIONS, i))} empty="Yok" />
        <p className="label mt-4">Kronik Rahatsızlıklar</p>
        <ChipList items={p.health_conditions ?? []} empty="Yok" />
        <p className="label mt-4">Alerjiler</p>
        <ChipList items={(p.allergies ?? []).map((a) => labelOf(ALLERGY_OPTIONS, a))} empty="Yok" />
        {(p.smoking_status || p.sleep_hours) && (
          <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
            <Field label="Sigara" value={p.smoking_status ? labelOf(SMOKING_OPTIONS, p.smoking_status) : null} />
            <Field label="Uyku" value={p.sleep_hours ? `${p.sleep_hours} saat` : null} />
          </div>
        )}
        {p.health_notes && <p className="mt-4 rounded-xl bg-ink-soft p-3 text-sm text-fg-muted">{p.health_notes}</p>}
      </SectionCard>

      {/* ---- 6. İSTATİSTİKLER ---- */}
      <SectionCard icon={BarChart3} title="İstatistikler">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Dumbbell} label="Antrenman" value={stats.workouts} />
          <StatTile icon={Timer} label="Toplam Süre" value={`${durationH} sa`} color="#38BDF8" />
          <StatTile icon={Flame} label="Kalori (kayıt)" value={formatNumber(stats.calories)} color="#FB7185" />
          <StatTile icon={Footprints} label="Adım" value={formatNumber(stats.steps)} color="#C084FC" />
          <StatTile icon={Droplet} label="Su" value={`${(stats.waterMl / 1000).toFixed(1)}L`} color="#22D3EE" />
          <StatTile icon={Beef} label="Protein" value={`${formatNumber(stats.proteinG)}g`} color="#f472b6" />
          <StatTile icon={Flame} label="En Uzun Seri" value={`${stats.longestStreak}g`} color="#FBBF24" />
          <StatTile icon={Activity} label="En Çok Kas" value={stats.topMuscle ?? "—"} color="#34D399" />
        </div>
      </SectionCard>

      {/* ---- 7. BAŞARIMLAR ---- */}
      <SectionCard
        icon={Trophy}
        title="Başarımlar"
        action={<Link href="/gamification" className="text-xs font-semibold text-brand">Tümü →</Link>}
      >
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={Zap} label="Toplam XP" value={formatNumber(gam.totalXp)} />
          <StatTile icon={Medal} label="Rozet" value={`${gam.achievementsUnlocked}/${gam.achievementsTotal}`} color="#FBBF24" />
          <StatTile icon={Trophy} label="Sıralama" value={gam.leaderboardRank ? `#${gam.leaderboardRank}` : "—"} color="#34D399" />
        </div>
        {gam.badges.length > 0 && (
          <div className="mt-3">
            <ChipList items={gam.badges.slice(0, 8).map((b) => b.name)} />
          </div>
        )}
      </SectionCard>

      {/* ---- 8. AYARLAR ---- */}
      <SectionCard icon={Settings2} title="Ayarlar">
        <div className="space-y-1">
          <SettingRow icon={Bell} label="Bildirimler" href="/settings" />
          <div className="flex items-center justify-between border-b border-ink-border/50 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium"><Palette size={16} className="text-fg-muted" /> Tema</span>
            <ThemeToggle />
          </div>
          <SettingRow icon={Globe} label="Dil ve Birim" href="/settings" />
          <SettingRow icon={Shield} label="Gizlilik" href="/settings" />
          <SettingRow icon={Download} label="Verilerimi İndir" href="/settings" />
          <SettingRow icon={Trash2} label="Verileri / Hesabı Sil" href="/settings" danger />
        </div>
        <form action="/auth/signout" method="post" className="mt-3">
          <button type="submit" className="btn-ghost w-full justify-center text-coral">
            <LogOut size={16} /> Çıkış Yap
          </button>
        </form>
      </SectionCard>
    </div>
  );
}

function SettingRow({ icon: Icon, label, href, danger }: { icon: typeof Bell; label: string; href: string; danger?: boolean }) {
  return (
    <Link href={href} className="flex items-center justify-between border-b border-ink-border/50 py-2.5 last:border-0">
      <span className={`flex items-center gap-2.5 text-sm font-medium ${danger ? "text-coral" : ""}`}>
        <Icon size={16} className={danger ? "text-coral" : "text-fg-muted"} /> {label}
      </span>
      <ChevronRight size={16} className="text-fg-muted" />
    </Link>
  );
}
