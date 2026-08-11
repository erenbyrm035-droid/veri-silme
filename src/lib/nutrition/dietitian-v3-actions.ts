"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import {
  INTERVIEW_QUESTIONS,
  nextQuestion,
  answeredCount,
  TOTAL_QUESTIONS,
  type InterviewAnswers,
  type DietPlan,
} from "./interview";

export interface DietV3Result<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): DietV3Result<never> => ({ ok: false, error: e });

async function uid(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Akıllı hafıza — profildeki bilinen alanları görüşme cevaplarına tohumlar.
// Sadece DOLU (null olmayan) alanlar tohumlanır; böylece o soru tekrar sorulmaz.
// ---------------------------------------------------------------------------
type ProfileLike = Record<string, unknown> | null;

function seedFromProfile(p: ProfileLike): InterviewAnswers {
  const seed: InterviewAnswers = {};
  if (!p) return seed;
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  if (num(p.height_cm) != null) seed.height_cm = p.height_cm as number;
  if (num(p.weight_kg) != null) seed.weight_kg = p.weight_kg as number;
  if (num(p.age) != null) seed.age = p.age as number;
  if (str(p.gender)) seed.gender = p.gender as string;
  if (num(p.weekly_training_days) != null) seed.training_days = p.weekly_training_days as number;
  if (num(p.meals_per_day) != null) seed.meals_per_day = String(p.meals_per_day);
  if (num(p.daily_sitting_hours) != null) seed.sitting_hours = p.daily_sitting_hours as number;
  if (str(p.occupation)) seed.occupation = p.occupation as string;

  const fav = arr(p.favorite_foods);
  if (fav && fav.length) seed.favorites = fav.join(", ");
  const dis = arr(p.disliked_foods);
  if (dis && dis.length) seed.dislikes = dis.join(", ");
  const alg = arr(p.allergies);
  if (alg && alg.length) seed.allergies = alg.join(", ");

  // Beslenme hedefi → görüşme hedefi eşlemesi (yalnızca netse).
  const ng = str(p.nutrition_goal);
  if (ng) {
    const map: Record<string, string> = { lose_fat: "lose_fat", gain_muscle: "gain_muscle", strength: "gain_muscle", healthy: "maintain" };
    if (map[ng]) seed.goal = map[ng];
  }
  return seed;
}

// Görüşme cevaplarını profile geri yazar (diğer modüller de kullanır).
function profilePatchFromAnswer(id: string, value: unknown): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  const toArr = (v: unknown) => String(v ?? "").split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
  switch (id) {
    case "height_cm": patch.height_cm = Number(value) || null; break;
    case "weight_kg": patch.weight_kg = Number(value) || null; break;
    case "age": patch.age = Number(value) || null; break;
    case "gender": patch.gender = value; break;
    case "training_days": patch.weekly_training_days = Number(value) || null; break;
    case "meals_per_day": patch.meals_per_day = Number(value) || null; break;
    case "sitting_hours": patch.daily_sitting_hours = Number(value) || null; break;
    case "occupation": patch.occupation = String(value ?? "") || null; break;
    case "favorites": patch.favorite_foods = toArr(value); break;
    case "dislikes": patch.disliked_foods = toArr(value); break;
    case "allergies": patch.allergies = toArr(value); break;
    default: return null;
  }
  return Object.keys(patch).length ? patch : null;
}

/** Materyalize edilmiş alışveriş kalemi (bkz. migration 0045). */
export interface ShoppingItem {
  name: string;
  category: string;
  checked: boolean;
}

export interface ShoppingListView {
  id: string;
  items: ShoppingItem[];
}

export interface DietitianState {
  answers: InterviewAnswers;
  nextId: string | null;
  answered: number;
  total: number;
  completed: boolean;
  plan: (DietPlan & { id: string }) | null;
  /**
   * Alışveriş listesi TEK KAYNAKTAN gelir: `shopping_lists`.
   * `dietitian_plans.shopping` planın ham çıktısı olarak kalır ama artık
   * okunmaz — plan kaydedilince trigger burayı günceller ve kullanıcının
   * işaretleri korunur (eskiden iki yer senkron değildi).
   */
  shopping: ShoppingListView | null;
}

/** Görüşme durumunu + son planı döndürür. İlk açılışta profilden tohumlar. */
export async function getDietitianState(): Promise<DietV3Result<DietitianState>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const [{ data: row }, { data: profile }, { data: planRow }] = await Promise.all([
      admin.from("dietitian_profiles").select("answers, completed").eq("user_id", userId).maybeSingle(),
      admin.from("profiles").select("height_cm, weight_kg, age, gender, weekly_training_days, meals_per_day, daily_sitting_hours, occupation, favorite_foods, disliked_foods, allergies, nutrition_goal").eq("id", userId).maybeSingle(),
      admin.from("dietitian_plans").select("id, span, analysis, plan, shopping, targets, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const { data: shoppingRow } = planRow
      ? await admin.from("shopping_lists").select("id, items")
          .eq("dietitian_plan_id", planRow.id as string)
          .order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };

    const answers: InterviewAnswers = { ...((row?.answers as InterviewAnswers) ?? {}) };
    // Tohumla (yalnızca eksik anahtarlar).
    const seed = seedFromProfile(profile as ProfileLike);
    let changed = false;
    for (const [k, v] of Object.entries(seed)) {
      if (!Object.prototype.hasOwnProperty.call(answers, k)) { answers[k] = v; changed = true; }
    }
    if (changed) {
      await admin.from("dietitian_profiles").upsert(
        { user_id: userId, answers, updated_at: new Date().toISOString() }, { onConflict: "user_id" }
      );
    }

    const nq = nextQuestion(answers);
    const plan = planRow
      ? ({ id: planRow.id, span: planRow.span, analysis: planRow.analysis ?? "", days: (planRow.plan as { days?: unknown })?.days ?? [], shopping: planRow.shopping ?? [], targets: planRow.targets ?? {}, created_at: planRow.created_at } as DietPlan & { id: string })
      : null;

    return {
      ok: true,
      data: {
        answers, nextId: nq?.id ?? null, answered: answeredCount(answers), total: TOTAL_QUESTIONS,
        completed: !nq, plan,
        shopping: shoppingRow
          ? {
              id: shoppingRow.id as string,
              items: ((shoppingRow.items as ShoppingItem[]) ?? []).map((i) => ({
                name: i.name ?? "",
                category: i.category ?? "Diğer",
                checked: !!i.checked,
              })),
            }
          : null,
      },
    };
  } catch (err) {
    await reportError(err, { where: "dietitian-v3/getState", userId });
    return fail("Durum yüklenemedi.");
  }
}

/** Bir soruyu cevaplar; cevabı kaydeder, profile senkronlar, sıradaki soruyu döndürür. */
export async function answerQuestion(id: string, value: string | number | string[] | boolean | null): Promise<DietV3Result<{ nextId: string | null; answered: number; completed: boolean }>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  if (!INTERVIEW_QUESTIONS.some((q) => q.id === id)) return fail("Geçersiz soru.");
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("dietitian_profiles").select("answers").eq("user_id", userId).maybeSingle();
    const answers: InterviewAnswers = { ...((row?.answers as InterviewAnswers) ?? {}) };
    answers[id] = value;
    const nq = nextQuestion(answers);
    await admin.from("dietitian_profiles").upsert(
      { user_id: userId, answers, completed: !nq, updated_at: new Date().toISOString() }, { onConflict: "user_id" }
    );
    // Profile geri yaz (varsa).
    const patch = profilePatchFromAnswer(id, value);
    if (patch) await admin.from("profiles").update(patch).eq("id", userId);

    return { ok: true, data: { nextId: nq?.id ?? null, answered: answeredCount(answers), completed: !nq } };
  } catch (err) {
    await reportError(err, { where: "dietitian-v3/answer", userId });
    return fail("Cevap kaydedilemedi.");
  }
}

/** Belirli soruları yeniden sordurmak için cevaplarını siler ("Bilgilerimi güncelle"). */
export async function reopenQuestions(ids: string[]): Promise<DietV3Result> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("dietitian_profiles").select("answers").eq("user_id", userId).maybeSingle();
    const answers: InterviewAnswers = { ...((row?.answers as InterviewAnswers) ?? {}) };
    for (const id of ids) delete answers[id];
    await admin.from("dietitian_profiles").upsert(
      { user_id: userId, answers, completed: false, updated_at: new Date().toISOString() }, { onConflict: "user_id" }
    );
    revalidatePath("/nutrition/coach");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "dietitian-v3/reopen", userId });
    return fail("Güncellenemedi.");
  }
}

/** Görüşmeyi baştan başlatır (tüm cevaplar temizlenir; profil tekrar tohumlanır). */
export async function resetInterview(): Promise<DietV3Result> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const admin = createAdminClient();
    await admin.from("dietitian_profiles").upsert(
      { user_id: userId, answers: {}, completed: false, updated_at: new Date().toISOString() }, { onConflict: "user_id" }
    );
    revalidatePath("/nutrition/coach");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "dietitian-v3/reset", userId });
    return fail("Sıfırlanamadı.");
  }
}

/**
 * Alışveriş kalemini işaretler/kaldırır.
 *
 * `toggle_shopping_item()` RPC'si (migration 0045) hem sahiplik hem indeks
 * sınırı kontrolünü kendi içinde yapar — yarış koşulu olmadan tek UPDATE.
 */
export async function toggleShoppingItem(
  listId: string, index: number, checked: boolean
): Promise<DietV3Result<{ checked: boolean }>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    // RPC auth.uid() ile sahipliği doğruluyor → oturumlu istemci gerekli.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_shopping_item", {
      p_list: listId, p_index: index, p_checked: checked,
    });
    if (error) return fail(error.message);
    if (data !== true) return fail("Kalem güncellenemedi.");
    return { ok: true, data: { checked } };
  } catch (err) {
    await reportError(err, { where: "dietitian-v3/toggleShoppingItem", userId });
    return fail("Kalem güncellenemedi.");
  }
}
