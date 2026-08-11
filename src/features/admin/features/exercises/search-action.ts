"use server";

import { requireAdmin } from "@/features/admin/features/users/guard";
import { searchExercisesLite } from "./queries";

/** İlişki seçici için istemciden çağrılan hafif egzersiz araması. */
export async function searchExercisesAction(
  q: string,
  excludeId?: string
): Promise<{ id: string; name: string; slug: string | null }[]> {
  await requireAdmin();
  if (!q || q.trim().length < 2) return [];
  return searchExercisesLite(q, excludeId);
}
