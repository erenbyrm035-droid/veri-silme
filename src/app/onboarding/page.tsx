"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcCalorieGoal, calcProteinGoal, calcMacroTargets } from "@/lib/nutrition";
import {
  GOAL_MULTI_OPTIONS,
  MAX_GOALS,
  EXPERIENCE_OPTIONS,
  ENVIRONMENT_OPTIONS,
  GENDER_OPTIONS,
  WEEKLY_DAYS_OPTIONS,
  WORKOUT_DURATION_OPTIONS,
  SMOKING_OPTIONS,
  INJURY_SIMPLE_OPTIONS,
  EQUIPMENT_OPTIONS,
  NUTRITION_GOAL_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  DIETARY_PREFERENCE_OPTIONS,
  ALLERGY_OPTIONS,
} from "@/lib/constants";
import type {
  Goal,
  Experience,
  TrainingEnvironment,
  Gender,
  NutritionGoal,
  ActivityLevel,
} from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { AiAnalysisScreen } from "@/components/onboarding/AiAnalysisScreen";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

interface FormState {
  full_name: string;
  last_name: string;
  birth_date: string;
  gender: Gender | null;
  height_cm: string;
  weight_kg: string;
  target_weight_kg: string;
  body_fat_pct: string;
  goals: string[];
  experience: Experience | null;
  training_environment: TrainingEnvironment | null;
  equipment: string[];
  preferred_workout_duration: number | null;
  weekly_training_days: number | null;
  activity_level: ActivityLevel | null;
  occupation: string;
  daily_sitting_hours: string;
  sleep_hours: string;
  water_intake_ml: string;
  smoking_status: string | null;
  injuries: string[];
  health_notes: string;
  nutrition_goal: NutritionGoal | null;
  dietary_preferences: string[];
  allergies: string[];
}

const INPUT_STEPS = 10; // 11. adım AI analiz ekranı

/** Doğum tarihinden yaş hesabı. */
function ageFromBirth(iso: string): number {
  const b = new Date(iso);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    full_name: "",
    last_name: "",
    birth_date: "",
    gender: null,
    height_cm: "",
    weight_kg: "",
    target_weight_kg: "",
    body_fat_pct: "",
    goals: [],
    experience: null,
    training_environment: null,
    equipment: [],
    preferred_workout_duration: null,
    weekly_training_days: null,
    activity_level: null,
    occupation: "",
    daily_sitting_hours: "",
    sleep_hours: "",
    water_intake_ml: "",
    smoking_status: null,
    injuries: [],
    health_notes: "",
    nutrition_goal: null,
    dietary_preferences: [],
    allergies: [],
  });

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Çoklu hedef: en fazla MAX_GOALS. Doluysa yeni seçim engellenir.
  const toggleGoal = (value: string) =>
    setForm((f) => {
      if (f.goals.includes(value)) return { ...f, goals: f.goals.filter((v) => v !== value) };
      if (f.goals.length >= MAX_GOALS) return f;
      return { ...f, goals: [...f.goals, value] };
    });

  const toggleDiet = (value: string) =>
    setForm((f) => {
      if (value === "none") return { ...f, dietary_preferences: ["none"] };
      const base = f.dietary_preferences.filter((v) => v !== "none");
      return {
        ...f,
        dietary_preferences: base.includes(value)
          ? base.filter((v) => v !== value)
          : [...base, value],
      };
    });

  const toggleAllergy = (value: string) =>
    setForm((f) => ({
      ...f,
      allergies: f.allergies.includes(value)
        ? f.allergies.filter((v) => v !== value)
        : [...f.allergies, value],
    }));

  const toggleEquip = (value: string) =>
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(value)
        ? f.equipment.filter((v) => v !== value)
        : [...f.equipment, value],
    }));

  const toggleInjury = (value: string) =>
    setForm((f) => {
      if (value === "none") return { ...f, injuries: ["none"] };
      const base = f.injuries.filter((v) => v !== "none");
      return {
        ...f,
        injuries: base.includes(value)
          ? base.filter((v) => v !== value)
          : [...base, value],
      };
    });

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return form.full_name.trim().length > 1 && !!form.birth_date && !!form.gender;
      case 2:
        return !!form.height_cm && !!form.weight_kg;
      case 3:
        return form.goals.length >= 1;
      case 4:
        return !!form.experience;
      case 5:
        return !!form.training_environment;
      case 6:
        return form.equipment.length > 0;
      case 7:
        return form.preferred_workout_duration !== null && form.weekly_training_days !== null;
      case 8:
        return !!form.activity_level;
      case 9:
        return form.injuries.length > 0;
      case 10:
        return !!form.nutrition_goal;
      default:
        return false;
    }
  }

  async function handleFinish() {
    setStep(11);
    setAnalyzing(true);
    setError(null);
    const startedAt = Date.now();

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const age = ageFromBirth(form.birth_date);
    const numeric = {
      age,
      height_cm: parseFloat(form.height_cm),
      weight_kg: parseFloat(form.weight_kg),
    };

    // Birincil hedef (ilk seçilen) → kalori/makro hesabı için Goal enum'u.
    const primaryGoal: Goal =
      GOAL_MULTI_OPTIONS.find((o) => o.value === form.goals[0])?.primary ?? "get_fit";

    const goalInput = {
      gender: form.gender,
      age: numeric.age,
      height_cm: numeric.height_cm,
      weight_kg: numeric.weight_kg,
      goal: primaryGoal,
      experience: form.experience,
      weekly_training_days: form.weekly_training_days,
    };

    const injuries = form.injuries.includes("none") ? [] : form.injuries;
    const dietaryPrefs = form.dietary_preferences.includes("none") ? [] : form.dietary_preferences;
    const fullName = [form.full_name.trim(), form.last_name.trim()].filter(Boolean).join(" ");

    const macros = calcMacroTargets({
      gender: form.gender,
      age: numeric.age,
      height_cm: numeric.height_cm,
      weight_kg: numeric.weight_kg,
      activity_level: form.activity_level,
      nutrition_goal: form.nutrition_goal,
      weekly_training_days: form.weekly_training_days,
    });

    const { error: saveErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        birth_date: form.birth_date,
        age: numeric.age,
        gender: form.gender,
        height_cm: numeric.height_cm,
        weight_kg: numeric.weight_kg,
        starting_weight_kg: numeric.weight_kg,
        target_weight_kg: form.target_weight_kg ? parseFloat(form.target_weight_kg) : null,
        body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : null,
        goal: primaryGoal,
        goals: form.goals,
        experience: form.experience,
        training_environment: form.training_environment,
        available_equipment: form.equipment,
        preferred_workout_duration: form.preferred_workout_duration,
        weekly_training_days: form.weekly_training_days,
        activity_level: form.activity_level,
        occupation: form.occupation.trim() || null,
        daily_sitting_hours: form.daily_sitting_hours ? parseFloat(form.daily_sitting_hours) : null,
        sleep_hours: form.sleep_hours ? parseFloat(form.sleep_hours) : null,
        water_intake_ml: form.water_intake_ml ? parseInt(form.water_intake_ml, 10) : null,
        smoking_status: form.smoking_status,
        injuries,
        health_notes: form.health_notes.trim() || null,
        nutrition_goal: form.nutrition_goal,
        dietary_preferences: dietaryPrefs,
        allergies: form.allergies,
        daily_calorie_goal: macros.calories || calcCalorieGoal(goalInput),
        daily_protein_goal: macros.protein_g || calcProteinGoal(goalInput),
        daily_carb_goal: macros.carbs_g,
        daily_fat_goal: macros.fat_g,
        daily_fiber_goal: macros.fiber_g,
        daily_water_goal_ml: macros.water_ml,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (saveErr) {
      setError("Kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
      setAnalyzing(false);
      return;
    }

    await supabase.from("body_measurements").insert({
      user_id: user.id,
      weight_kg: numeric.weight_kg,
    });

    try {
      await fetch("/api/ai/generate-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: [] }),
      });
    } catch {
      /* program üretilemese de onboarding tamam */
    }

    const elapsed = Date.now() - startedAt;
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, Math.max(0, 3800 - elapsed));
  }

  if (step === 11) {
    return (
      <div className="px-safe mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <AiAnalysisScreen error={error} />
      </div>
    );
  }

  return (
    <div className="px-safe mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      {/* İlerleme çubuğu */}
      <div className="mb-8 flex items-center gap-1.5">
        {Array.from({ length: INPUT_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < step ? "bg-brand" : "bg-ink-border"
            )}
          />
        ))}
      </div>

      <div className="flex-1 animate-fade-up">
        {step === 1 && (
          <StepWrapper title="Seni tanıyalım" subtitle="Birkaç temel bilgiyle başlayalım.">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ad</label>
                <input
                  className="input"
                  value={form.full_name}
                  onChange={(e) => update({ full_name: e.target.value })}
                  placeholder="Adın"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="label">Soyad — opsiyonel</label>
                <input
                  className="input"
                  value={form.last_name}
                  onChange={(e) => update({ last_name: e.target.value })}
                  placeholder="Soyadın"
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div>
              <label className="label">Doğum Tarihi</label>
              <input
                className="input"
                type="date"
                value={form.birth_date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => update({ birth_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Cinsiyet</label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    selected={form.gender === o.value}
                    onClick={() => update({ gender: o.value })}
                    label={o.label}
                  />
                ))}
              </div>
            </div>
          </StepWrapper>
        )}

        {step === 2 && (
          <StepWrapper title="Vücut ölçülerin" subtitle="Hedeflerini hesaplamak için gerekli.">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Boy (cm)</label>
                <input className="input" type="number" inputMode="numeric" value={form.height_cm}
                  onChange={(e) => update({ height_cm: e.target.value })} placeholder="175" />
              </div>
              <div>
                <label className="label">Kilo (kg)</label>
                <input className="input" type="number" inputMode="decimal" value={form.weight_kg}
                  onChange={(e) => update({ weight_kg: e.target.value })} placeholder="75" />
              </div>
              <div>
                <label className="label">Hedef Kilo (kg)</label>
                <input className="input" type="number" inputMode="decimal" value={form.target_weight_kg}
                  onChange={(e) => update({ target_weight_kg: e.target.value })} placeholder="Opsiyonel" />
              </div>
              <div>
                <label className="label">Yağ oranı (%)</label>
                <input className="input" type="number" inputMode="decimal" value={form.body_fat_pct}
                  onChange={(e) => update({ body_fat_pct: e.target.value })} placeholder="Opsiyonel" />
              </div>
            </div>
          </StepWrapper>
        )}

        {step === 3 && (
          <StepWrapper title="Hedeflerin ne?" subtitle="En fazla 3 hedef seç; program bunlara göre şekillenecek.">
            <div className="grid grid-cols-3 gap-2.5">
              {GOAL_MULTI_OPTIONS.map((o) => {
                const selected = form.goals.includes(o.value);
                const disabled = !selected && form.goals.length >= MAX_GOALS;
                return (
                  <GoalCard
                    key={o.value}
                    selected={selected}
                    disabled={disabled}
                    onClick={() => toggleGoal(o.value)}
                    emoji={o.emoji}
                    label={o.label}
                  />
                );
              })}
            </div>
            <div className="sticky bottom-0 mt-1 flex items-center justify-center">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  form.goals.length === MAX_GOALS ? "bg-brand/15 text-brand" : "bg-ink-soft text-fg-muted"
                )}
              >
                {form.goals.length} / {MAX_GOALS} hedef seçildi
              </span>
            </div>
          </StepWrapper>
        )}

        {step === 4 && (
          <StepWrapper title="Spor deneyimin?" subtitle="Deneyimine uygun başlayalım.">
            <div className="space-y-3">
              {EXPERIENCE_OPTIONS.map((o) => (
                <OptionRow key={o.value} selected={form.experience === o.value}
                  onClick={() => update({ experience: o.value })} label={o.label} />
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 5 && (
          <StepWrapper title="Nerede çalışıyorsun?" subtitle="Ekipmanına uygun hareketler önerelim.">
            <div className="grid grid-cols-2 gap-3">
              {ENVIRONMENT_OPTIONS.map((o) => (
                <OptionCard key={o.value} selected={form.training_environment === o.value}
                  onClick={() => update({ training_environment: o.value })} emoji={o.emoji} label={o.label} />
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 6 && (
          <StepWrapper title="Hangi ekipmanların var?" subtitle="Birden fazla seçebilirsin.">
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((o) => (
                <Chip key={o.value} selected={form.equipment.includes(o.value)}
                  onClick={() => toggleEquip(o.value)} label={o.label} />
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 7 && (
          <StepWrapper title="Antrenman planın" subtitle="Süre ve haftalık sıklık programını belirler.">
            <div>
              <label className="label">Antrenman süresi</label>
              <div className="grid grid-cols-5 gap-2">
                {WORKOUT_DURATION_OPTIONS.map((o) => (
                  <OptionCard key={o.value} selected={form.preferred_workout_duration === o.value}
                    onClick={() => update({ preferred_workout_duration: o.value })} label={o.label} />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <label className="label">Haftalık program (gün)</label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKLY_DAYS_OPTIONS.map((d) => (
                  <OptionCard key={d} selected={form.weekly_training_days === d}
                    onClick={() => update({ weekly_training_days: d })} label={String(d)} compact />
                ))}
              </div>
            </div>
          </StepWrapper>
        )}

        {step === 8 && (
          <StepWrapper title="Yaşam tarzın" subtitle="Kaloriyi ve programı günlük hayatına göre ayarlarız.">
            <div>
              <label className="label">Aktivite seviyen</label>
              <div className="mt-2 space-y-2">
                {ACTIVITY_LEVEL_OPTIONS.map((o) => (
                  <OptionRow key={o.value} selected={form.activity_level === o.value}
                    onClick={() => update({ activity_level: o.value })} label={`${o.label} · ${o.desc}`} />
                ))}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Meslek — opsiyonel</label>
                <input className="input" value={form.occupation}
                  onChange={(e) => update({ occupation: e.target.value })} placeholder="ör. Öğretmen, Yazılımcı" />
              </div>
              <div>
                <label className="label">Günlük oturma (saat)</label>
                <input className="input" type="number" inputMode="numeric" value={form.daily_sitting_hours}
                  onChange={(e) => update({ daily_sitting_hours: e.target.value })} placeholder="8" />
              </div>
              <div>
                <label className="label">Uyku (saat)</label>
                <input className="input" type="number" inputMode="decimal" value={form.sleep_hours}
                  onChange={(e) => update({ sleep_hours: e.target.value })} placeholder="7" />
              </div>
              <div>
                <label className="label">Su tüketimi (ml)</label>
                <input className="input" type="number" inputMode="numeric" value={form.water_intake_ml}
                  onChange={(e) => update({ water_intake_ml: e.target.value })} placeholder="2000" />
              </div>
              <div>
                <label className="label">Sigara — opsiyonel</label>
                <select className="input" value={form.smoking_status ?? ""}
                  onChange={(e) => update({ smoking_status: e.target.value || null })}>
                  <option value="">Seç</option>
                  {SMOKING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </StepWrapper>
        )}

        {step === 9 && (
          <StepWrapper title="Sağlık durumun" subtitle="Programı güvenle uyarlayabilmemiz için.">
            <div>
              <label className="label">Sakatlık geçmişi</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {INJURY_SIMPLE_OPTIONS.map((o) => (
                  <Chip key={o.value} selected={form.injuries.includes(o.value)}
                    onClick={() => toggleInjury(o.value)} label={o.label} />
                ))}
                <Chip selected={form.injuries.includes("none")} onClick={() => toggleInjury("none")} label="Yok" />
              </div>
            </div>
            <div className="mt-5">
              <label className="label">Sağlık notları — opsiyonel</label>
              <textarea className="input min-h-[84px] resize-none" value={form.health_notes}
                onChange={(e) => update({ health_notes: e.target.value })}
                placeholder="Kronik rahatsızlık, ilaç, dikkat edilmesi gereken durumlar…" />
              <p className="mt-2 text-xs text-fg-muted">
                Sağlık durumların varsa programı ve öğün planını bir uzmana danışarak kullan.
              </p>
            </div>
          </StepWrapper>
        )}

        {step === 10 && (
          <StepWrapper title="Beslenme hedefin" subtitle="AI Diyetisyen makrolarını buna göre hesaplayacak.">
            <div className="grid grid-cols-2 gap-3">
              {NUTRITION_GOAL_OPTIONS.map((o) => (
                <OptionCard key={o.value} selected={form.nutrition_goal === o.value}
                  onClick={() => update({ nutrition_goal: o.value })} emoji={o.emoji} label={o.label} />
              ))}
            </div>
            <div className="mt-5">
              <label className="label">Diyet tercihi</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip selected={form.dietary_preferences.includes("none")} onClick={() => toggleDiet("none")} label="Fark etmez" />
                {DIETARY_PREFERENCE_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                  <Chip key={o.value} selected={form.dietary_preferences.includes(o.value)}
                    onClick={() => toggleDiet(o.value)} label={o.label} />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <label className="label">Alerji / hassasiyet</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALLERGY_OPTIONS.map((o) => (
                  <Chip key={o.value} selected={form.allergies.includes(o.value)}
                    onClick={() => toggleAllergy(o.value)} label={o.label} />
                ))}
              </div>
            </div>
          </StepWrapper>
        )}
      </div>

      {/* Navigasyon */}
      <div className="mt-8 flex items-center gap-3">
        {step > 1 && (
          <button onClick={() => setStep((s) => s - 1)} className="btn-ghost" type="button">
            <ArrowLeft size={18} /> Geri
          </button>
        )}
        {step < INPUT_STEPS ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="btn-primary flex-1" type="button">
            Devam Et <ArrowRight size={18} />
          </button>
        ) : (
          <button onClick={handleFinish} disabled={!canProceed() || analyzing} className="btn-primary flex-1" type="button">
            Analizi Başlat <Check size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function GoalCard({
  selected,
  disabled,
  onClick,
  emoji,
  label,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-all",
        selected
          ? "border-brand bg-brand/10 shadow-[0_0_0_1px_rgb(var(--brand))]"
          : disabled
            ? "cursor-not-allowed border-ink-border bg-ink-card opacity-40"
            : "border-ink-border bg-ink-card hover:border-fg/20 active:scale-[0.97]"
      )}
    >
      {selected && (
        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-black">
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}

function OptionCard({
  selected,
  onClick,
  emoji,
  label,
  compact,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border text-center transition-all active:scale-[0.97]",
        compact ? "p-2.5" : "p-5",
        selected ? "border-brand bg-brand/10" : "border-ink-border bg-ink-card hover:border-fg/20"
      )}
    >
      {emoji && <span className="text-2xl">{emoji}</span>}
      <span className={cn("font-semibold", compact ? "text-sm" : "text-sm")}>{label}</span>
    </button>
  );
}

function OptionRow({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
        selected ? "border-brand bg-brand/10" : "border-ink-border bg-ink-card hover:border-fg/20"
      )}
    >
      <span className="font-semibold">{label}</span>
      {selected && <Check size={18} className="text-brand" />}
    </button>
  );
}

function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-95",
        selected
          ? "border-brand bg-brand/10 text-brand"
          : "border-ink-border bg-ink-card text-fg-muted hover:border-fg/20"
      )}
    >
      {label}
    </button>
  );
}
