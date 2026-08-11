import { Badge } from "@/features/admin/components/ui/badge";
import { LEVEL_LABELS, GENDER_LABELS, ENV_LABELS, BLOCK_LABELS } from "../constants";
import type { ProgramLevel, ProgramStatus, ProgramGender, ProgramEnvironment, ProgramBlockType } from "@/lib/database.types";

const LEVEL_VARIANT: Record<ProgramLevel, "success" | "warning" | "danger"> = {
  beginner: "success", intermediate: "warning", advanced: "danger",
};

export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return status === "published" ? <Badge variant="success">Yayında</Badge> : <Badge variant="outline">Taslak</Badge>;
}
export function LevelBadge({ level }: { level: ProgramLevel }) {
  return <Badge variant={LEVEL_VARIANT[level]}>{LEVEL_LABELS[level]}</Badge>;
}
export function GenderBadge({ gender }: { gender: ProgramGender }) {
  return <Badge variant="secondary">{GENDER_LABELS[gender]}</Badge>;
}
export function EnvBadge({ environment }: { environment: ProgramEnvironment }) {
  return <Badge variant="outline">{ENV_LABELS[environment]}</Badge>;
}

const BLOCK_VARIANT: Record<ProgramBlockType, "default" | "secondary" | "warning"> = {
  normal: "secondary", superset: "default", dropset: "warning", circuit: "default",
  emom: "warning", amrap: "warning", tabata: "warning",
};
export function BlockBadge({ type }: { type: ProgramBlockType }) {
  if (type === "normal") return null;
  return <Badge variant={BLOCK_VARIANT[type]}>{BLOCK_LABELS[type]}</Badge>;
}
