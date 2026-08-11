import { z } from "zod";
import { LEVEL_VALUES, GENDER_VALUES, ENV_VALUES, BLOCK_VALUES, RELATION_VALUES } from "./constants";

const levelEnum = z.enum(LEVEL_VALUES as [string, ...string[]]);
const genderEnum = z.enum(GENDER_VALUES as [string, ...string[]]);
const envEnum = z.enum(ENV_VALUES as [string, ...string[]]);
const blockEnum = z.enum(BLOCK_VALUES as [string, ...string[]]);
const statusEnum = z.enum(["published", "draft"]);

export const programSchema = z.object({
  name: z.string().trim().min(2, "En az 2 karakter").max(160),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  cover_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  short_description: z.string().trim().max(300).nullable().optional().or(z.literal("")),
  description: z.string().trim().max(6000).nullable().optional().or(z.literal("")),
  category: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  level: levelEnum,
  goal: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  gender: genderEnum,
  environment: envEnum,
  weeks: z.coerce.number().int().min(1).max(52),
  days_per_week: z.coerce.number().int().min(1).max(7),
  est_minutes: z.coerce.number().int().min(0).max(600).nullable().optional(),
  calories: z.coerce.number().int().min(0).max(5000).nullable().optional(),
  tags: z.array(z.string().trim()).default([]),
  status: statusEnum.default("draft"),
});

export const createProgramSchema = programSchema;
export const updateProgramSchema = programSchema.extend({
  id: z.string().uuid(),
  change_note: z.string().trim().max(300).optional(),
});

export const idSchema = z.object({ id: z.string().uuid() });
export const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });
export const bulkStatusSchema = z.object({ ids: z.array(z.string().uuid()).min(1), status: statusEnum });
export const bulkCategorySchema = z.object({ ids: z.array(z.string().uuid()).min(1), category: z.string().min(1) });

export const daySchema = z.object({
  programId: z.string().uuid(),
  week: z.coerce.number().int().min(1).max(52),
  day: z.coerce.number().int().min(1).max(7),
  title: z.string().trim().max(120).optional(),
  focus: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  is_rest: z.boolean().default(false),
});
export const dayUpdateSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  title: z.string().trim().max(120).nullable().optional(),
  focus: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  is_rest: z.boolean().optional(),
});
export const dayIdSchema = z.object({ id: z.string().uuid(), programId: z.string().uuid() });

export const exerciseSchema = z.object({
  dayId: z.string().uuid(),
  programId: z.string().uuid(),
  exercise_id: z.string().uuid().nullable().optional(),
  exercise_name: z.string().trim().min(1).max(160),
  block_type: blockEnum.default("normal"),
  block_group: z.coerce.number().int().min(0).default(0),
  sets: z.coerce.number().int().min(0).max(50).nullable().optional(),
  reps: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  duration_sec: z.coerce.number().int().min(0).max(7200).nullable().optional(),
  rest_sec: z.coerce.number().int().min(0).max(3600).nullable().optional(),
  tempo: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  rpe: z.coerce.number().min(0).max(10).nullable().optional(),
  rir: z.coerce.number().int().min(0).max(10).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});
export const exerciseUpdateSchema = exerciseSchema.extend({ id: z.string().uuid() });
export const exerciseIdSchema = z.object({ id: z.string().uuid(), programId: z.string().uuid() });

export const reorderSchema = z.object({
  programId: z.string().uuid(),
  dayId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});

export const relationSchema = z.object({
  programId: z.string().uuid(),
  relatedId: z.string().uuid(),
  relation: z.enum(RELATION_VALUES as [string, ...string[]]),
});
export const relationIdSchema = z.object({ id: z.string().uuid(), programId: z.string().uuid() });

export const versionRestoreSchema = z.object({ programId: z.string().uuid(), versionId: z.string().uuid() });
export const applyTemplateSchema = z.object({ templateSlug: z.string(), name: z.string().trim().min(2).max(160).optional() });
export const importSchema = z.object({ programs: z.array(z.record(z.string(), z.unknown())).min(1).max(500) });

export type ProgramFormValues = z.input<typeof programSchema>;
