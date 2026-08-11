"use server";

import { requireAdmin } from "@/features/admin/features/users/guard";
import { searchProgramsLite, searchExerciseLibrary } from "./queries";

export async function searchProgramsAction(q: string, excludeId?: string): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  if (!q || q.trim().length < 2) return [];
  return searchProgramsLite(q, excludeId);
}

export async function searchExerciseAction(q: string): Promise<{ id: string; name: string }[]> {
  await requireAdmin();
  if (!q || q.trim().length < 2) return [];
  return searchExerciseLibrary(q);
}
