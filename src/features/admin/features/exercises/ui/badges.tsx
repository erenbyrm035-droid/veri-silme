import { Badge } from "@/features/admin/components/ui/badge";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, STATUS_LABELS } from "../constants";
import type { ExerciseCategory, Difficulty, ExerciseStatus } from "@/lib/database.types";

export function StatusBadge({ status }: { status: ExerciseStatus }) {
  return status === "published" ? (
    <Badge variant="success">{STATUS_LABELS.published}</Badge>
  ) : (
    <Badge variant="outline">{STATUS_LABELS.draft}</Badge>
  );
}

export function CategoryBadge({ category }: { category: ExerciseCategory }) {
  return <Badge variant="secondary">{CATEGORY_LABELS[category] ?? category}</Badge>;
}

const DIFF_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "danger",
};
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge variant={DIFF_VARIANT[difficulty]}>{DIFFICULTY_LABELS[difficulty]}</Badge>;
}
