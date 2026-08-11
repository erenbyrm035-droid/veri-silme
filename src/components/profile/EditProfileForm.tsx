"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Profile, Gender, Experience, TrainingEnvironment, ActivityLevel, NutritionGoal } from "@/lib/database.types";
import { AvatarUploader } from "./AvatarUploader";
import { updateProfile, type ProfileUpdateInput } from "@/lib/profile/actions";
import {
  GOAL_MULTI_OPTIONS, MAX_GOALS, GENDER_OPTIONS, EXPERIENCE_OPTIONS, ENVIRONMENT_OPTIONS,
  WEEKLY_DAYS_OPTIONS, WORKOUT_DURATION_OPTIONS, EQUIPMENT_OPTIONS, INJURY_SIMPLE_OPTIONS,
  ALLERGY_OPTIONS, NUTRITION_GOAL_OPTIONS, ACTIVITY_LEVEL_OPTIONS, SMOKING_OPTIONS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  User, Target, Dumbbell, Salad, HeartPulse, Check, ArrowLeft, CheckCircle2,
} from "lucide-react";
import Link from "next/link";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function EditProfileForm({ profile: p, userId }: { profile: Profile; userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nameParts = (p.full_name ?? "").trim().split(" ");
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [bio, setBio] = useState(p.bio ?? "");
  const [birthDate, setBirthDate] = useState(p.birth_date ?? "");
  const [gender, setGender] = useState<Gender | null>(p.gender);
  const [heightCm, setHeightCm] = useState(p.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(p.weight_kg?.toString() ?? "");
  const [targetKg, setTargetKg] = useState(p.target_weight_kg?.toString() ?? "");
  const [bodyFat, setBodyFat] = useState(p.body_fat_pct?.toString() ?? "");
  const [activity, setActivity] = useState<ActivityLevel | null>(p.activity_level);
  const [occupation, setOccupation] = useState(p.occupation ?? "");

  const [goals, setGoals] = useState<string[]>(p.goals ?? []);
  const [experience, setExperience] = useState<Experience | null>(p.experience);
  const [environment, setEnvironment] = useState<TrainingEnvironment | null>(p.training_environment);
  const [weeklyDays, setWeeklyDays] = useState<number | null>(p.weekly_training_days);
  const [duration, setDuration] = useState<number | null>(p.preferred_workout_duration);
  const [equipment, setEquipment] = useState<string[]>(p.available_equipment ?? []);

  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(p.nutrition_goal);
  const [autoMacros, setAutoMacros] = useState(false);
  const [cal, setCal] = useState(p.daily_calorie_goal?.toString() ?? "");
  const [protein, setProtein] = useState(p.daily_protein_goal?.toString() ?? "");
  const [carb, setCarb] = useState(p.daily_carb_goal?.toString() ?? "");
  const [fat, setFat] = useState(p.daily_fat_goal?.toString() ?? "");
  const [water, setWater] = useState(p.daily_water_goal_ml?.toString() ?? "");

  const [injuries, setInjuries] = useState<string[]>((p.injuries ?? []).filter((i) => i !== "none"));
  const [conditions, setConditions] = useState((p.health_conditions ?? []).join(", "));
  const [allergies, setAllergies] = useState<string[]>(p.allergies ?? []);
  const [healthNotes, setHealthNotes] = useState(p.health_notes ?? "");
  const [smoking, setSmoking] = useState<string | null>(p.smoking_status);
  const [sleep, setSleep] = useState(p.sleep_hours?.toString() ?? "");

  const toggleIn = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const toggleGoal = (v: string) =>
    setGoals((g) => (g.includes(v) ? g.filter((x) => x !== v) : g.length >= MAX_GOALS ? g : [...g, v]));

  function save() {
    setErr(null);
    const input: ProfileUpdateInput = {
      full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
      bio: bio.trim() || null,
      birth_date: birthDate || null,
      gender,
      height_cm: num(heightCm),
      weight_kg: num(weightKg),
      target_weight_kg: num(targetKg),
      body_fat_pct: num(bodyFat),
      activity_level: activity,
      occupation: occupation.trim() || null,
      goals,
      experience,
      training_environment: environment,
      available_equipment: equipment,
      preferred_workout_duration: duration,
      weekly_training_days: weeklyDays,
      nutrition_goal: nutritionGoal,
      injuries,
      health_conditions: conditions.split(",").map((s) => s.trim()).filter(Boolean),
      allergies,
      health_notes: healthNotes.trim() || null,
      smoking_status: smoking,
      sleep_hours: num(sleep),
      recalcMacros: autoMacros,
    };
    if (!autoMacros) {
      input.daily_calorie_goal = num(cal) ?? undefined;
      input.daily_protein_goal = num(protein) ?? undefined;
      input.daily_carb_goal = num(carb);
      input.daily_fat_goal = num(fat);
      input.daily_water_goal_ml = num(water) ?? undefined;
    }
    start(async () => {
      const res = await updateProfile(input);
      if (!res.ok) { setErr(res.error ?? "Güncellenemedi."); return; }
      setToast(true);
      setTimeout(() => { router.push("/profile"); router.refresh(); }, 1100);
    });
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="grid h-9 w-9 place-items-center rounded-xl border border-ink-border text-fg-muted hover:text-fg" aria-label="Geri">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Profili Düzenle</h1>
          <p className="text-xs text-fg-muted">Bilgilerini güncelle — değişiklikler anında kaydedilir.</p>
        </div>
      </div>

      {/* Avatar */}
      <div className="glass rounded-3xl p-6">
        <AvatarUploader userId={userId} initialUrl={p.avatar_url} name={firstName || "V"} />
      </div>

      {/* 1. Kişisel */}
      <Card icon={User} title="Kişisel Bilgiler">
        <Grid>
          <TextField label="Ad" value={firstName} onChange={setFirstName} placeholder="Adın" autoComplete="given-name" />
          <TextField label="Soyad" value={lastName} onChange={setLastName} placeholder="Soyadın" autoComplete="family-name" />
        </Grid>
        <TextField label="Doğum Tarihi" type="date" value={birthDate} onChange={setBirthDate} max={new Date().toISOString().slice(0, 10)} />
        <div>
          <label className="label">Cinsiyet</label>
          <Pills options={GENDER_OPTIONS} value={gender} onSelect={(v) => setGender(v as Gender)} />
        </div>
        <Grid>
          <TextField label="Boy (cm)" type="number" value={heightCm} onChange={setHeightCm} placeholder="175" />
          <TextField label="Kilo (kg)" type="number" value={weightKg} onChange={setWeightKg} placeholder="75" />
          <TextField label="Hedef Kilo (kg)" type="number" value={targetKg} onChange={setTargetKg} placeholder="Opsiyonel" />
          <TextField label="Yağ oranı (%)" type="number" value={bodyFat} onChange={setBodyFat} placeholder="Opsiyonel" />
        </Grid>
        <div>
          <label className="label">Aktivite Seviyesi</label>
          <select className="input" value={activity ?? ""} onChange={(e) => setActivity((e.target.value || null) as ActivityLevel | null)}>
            <option value="">Seç</option>
            {ACTIVITY_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <TextField label="Meslek" value={occupation} onChange={setOccupation} placeholder="ör. Öğretmen" />
        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-[72px] resize-none" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Kendini kısaca tanıt…" maxLength={200} />
        </div>
      </Card>

      {/* 2. Hedefler */}
      <Card icon={Target} title="Hedefler" hint={`${goals.length} / ${MAX_GOALS} seçildi`}>
        <div className="grid grid-cols-3 gap-2.5">
          {GOAL_MULTI_OPTIONS.map((o) => {
            const selected = goals.includes(o.value);
            const disabled = !selected && goals.length >= MAX_GOALS;
            return (
              <button key={o.value} type="button" onClick={() => toggleGoal(o.value)} disabled={disabled}
                className={cn("relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-all",
                  selected ? "border-brand bg-brand/10" : disabled ? "cursor-not-allowed border-ink-border bg-ink-card opacity-40" : "border-ink-border bg-ink-card hover:border-fg/20 active:scale-[0.97]")}>
                {selected && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-black"><Check size={13} strokeWidth={3} /></span>}
                <span className="text-xl">{o.emoji}</span>
                <span className="text-[11px] font-semibold leading-tight">{o.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Antrenman */}
      <Card icon={Dumbbell} title="Antrenman Tercihleri">
        <div>
          <label className="label">Ortam</label>
          <Pills options={ENVIRONMENT_OPTIONS} value={environment} onSelect={(v) => setEnvironment(v as TrainingEnvironment)} />
        </div>
        <div>
          <label className="label">Deneyim</label>
          <Pills options={EXPERIENCE_OPTIONS} value={experience} onSelect={(v) => setExperience(v as Experience)} />
        </div>
        <div>
          <label className="label">Haftalık Gün</label>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKLY_DAYS_OPTIONS.map((d) => (
              <button key={d} type="button" onClick={() => setWeeklyDays(d)}
                className={cn("rounded-xl border py-2.5 text-sm font-semibold transition-all active:scale-95", weeklyDays === d ? "border-brand bg-brand/10 text-brand" : "border-ink-border bg-ink-card text-fg-muted")}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Antrenman Süresi</label>
          <div className="grid grid-cols-5 gap-2">
            {WORKOUT_DURATION_OPTIONS.map((o) => (
              <button key={o.value} type="button" onClick={() => setDuration(o.value)}
                className={cn("rounded-xl border py-2.5 text-xs font-semibold transition-all active:scale-95", duration === o.value ? "border-brand bg-brand/10 text-brand" : "border-ink-border bg-ink-card text-fg-muted")}>{o.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Ekipmanlar</label>
          <Chips options={EQUIPMENT_OPTIONS} selected={equipment} onToggle={(v) => toggleIn(equipment, setEquipment, v)} />
        </div>
      </Card>

      {/* 4. Beslenme */}
      <Card icon={Salad} title="Beslenme">
        <div>
          <label className="label">Beslenme Hedefi</label>
          <select className="input" value={nutritionGoal ?? ""} onChange={(e) => setNutritionGoal((e.target.value || null) as NutritionGoal | null)}>
            <option value="">Seç</option>
            {NUTRITION_GOAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2.5 rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5 text-sm">
          <input type="checkbox" checked={autoMacros} onChange={(e) => setAutoMacros(e.target.checked)} className="h-4 w-4 accent-brand" />
          Makroları hedefime göre otomatik hesapla
        </label>
        {!autoMacros && (
          <Grid>
            <TextField label="Kalori" type="number" value={cal} onChange={setCal} />
            <TextField label="Protein (g)" type="number" value={protein} onChange={setProtein} />
            <TextField label="Karbonhidrat (g)" type="number" value={carb} onChange={setCarb} />
            <TextField label="Yağ (g)" type="number" value={fat} onChange={setFat} />
            <TextField label="Su (ml)" type="number" value={water} onChange={setWater} />
          </Grid>
        )}
      </Card>

      {/* 5. Sağlık (opsiyonel) */}
      <Card icon={HeartPulse} title="Sağlık" hint="Opsiyonel">
        <div>
          <label className="label">Sakatlıklar</label>
          <Chips options={INJURY_SIMPLE_OPTIONS} selected={injuries} onToggle={(v) => toggleIn(injuries, setInjuries, v)} />
        </div>
        <TextField label="Kronik Rahatsızlıklar (virgülle ayır)" value={conditions} onChange={setConditions} placeholder="ör. Astım, Tip-2 Diyabet" />
        <div>
          <label className="label">Alerjiler</label>
          <Chips options={ALLERGY_OPTIONS} selected={allergies} onToggle={(v) => toggleIn(allergies, setAllergies, v)} />
        </div>
        <Grid>
          <div>
            <label className="label">Sigara</label>
            <select className="input" value={smoking ?? ""} onChange={(e) => setSmoking(e.target.value || null)}>
              <option value="">Seç</option>
              {SMOKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <TextField label="Uyku (saat)" type="number" value={sleep} onChange={setSleep} placeholder="7" />
        </Grid>
        <div>
          <label className="label">Notlar</label>
          <textarea className="input min-h-[72px] resize-none" value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)} placeholder="Dikkat edilmesi gerekenler…" />
        </div>
      </Card>

      {err && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">{err}</p>}

      {/* Kaydet çubuğu */}
      <div className="pb-nav-safe sticky bottom-0 -mx-5 border-t border-ink-border bg-ink/85 px-5 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        <div className="flex gap-3">
          <Link href="/profile" className="btn-ghost flex-1 justify-center">İptal</Link>
          <button onClick={save} disabled={pending} className="btn-primary flex-[2] justify-center">
            {pending ? "Kaydediliyor…" : <><Check size={16} /> Değişiklikleri Kaydet</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[110] mx-auto flex max-w-sm items-center gap-2.5 rounded-2xl border border-brand/40 bg-ink-card px-4 py-3 shadow-2xl"
          >
            <CheckCircle2 size={18} className="text-brand" />
            <p className="text-sm font-semibold">Profil başarıyla güncellendi.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --- yerel form bileşenleri (onboarding'den bağımsız) --- */

function Card({ icon: Icon, title, hint, children }: { icon: typeof User; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand"><Icon size={15} /></span>
          {title}
        </h2>
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function TextField({
  label, value, onChange, type = "text", placeholder, autoComplete, max,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; autoComplete?: string; max?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        max={max}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Pills({ options, value, onSelect }: { options: { value: string; label: string }[]; value: string | null; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onSelect(o.value)}
          className={cn("rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all active:scale-95",
            value === o.value ? "border-brand bg-brand/10 text-brand" : "border-ink-border bg-ink-card text-fg-muted hover:border-fg/20")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onToggle(o.value)}
          className={cn("rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-95",
            selected.includes(o.value) ? "border-brand bg-brand/10 text-brand" : "border-ink-border bg-ink-card text-fg-muted hover:border-fg/20")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
