import { z } from "zod";
import { CATEGORY_VALUES, DIFFICULTY_VALUES, RELATION_VALUES } from "./constants";

const categoryEnum = z.enum(CATEGORY_VALUES as [string, ...string[]]);
const difficultyEnum = z.enum(DIFFICULTY_VALUES as [string, ...string[]]);
const statusEnum = z.enum(["published", "draft"]);
const mediaTypeEnum = z.enum(["gif", "animation", "video"]);

/** Yeni/düzenleme egzersiz formu (skalar + dizi alanlar). */
export const exerciseSchema = z.object({
  name: z.string().trim().min(2, "En az 2 karakter").max(160),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  category: categoryEnum,
  subcategory: z.string().trim().max(80).nullable().optional().or(z.literal("")),
  muscle_group: z.string().trim().min(1, "Ana kas zorunlu").max(80),
  secondary_muscles: z.array(z.string().trim()).default([]),
  difficulty: difficultyEnum,
  equipment: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  status: statusEnum.default("published"),
  media_type: mediaTypeEnum.default("gif"),
  gif_url: z.string().trim().url("Geçerli URL girin").nullable().optional().or(z.literal("")),
  description: z.string().trim().max(4000).nullable().optional().or(z.literal("")),
  instructions: z.array(z.string().trim()).default([]),
  breathing: z.string().trim().max(400).nullable().optional().or(z.literal("")),
  tempo: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  range_of_motion: z.string().trim().max(400).nullable().optional().or(z.literal("")),
  start_position: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  end_position: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  common_mistakes: z.array(z.string().trim()).default([]),
  tips: z.array(z.string().trim()).default([]),
  tags: z.array(z.string().trim()).default([]),
  calories: z.coerce.number().int().min(0).max(2000).nullable().optional(),
  movement_type: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  seo_title: z.string().trim().max(160).nullable().optional().or(z.literal("")),
  seo_description: z.string().trim().max(320).nullable().optional().or(z.literal("")),
  og_image_url: z.string().trim().url().nullable().optional().or(z.literal("")),
});

export type ExerciseFormValues = z.input<typeof exerciseSchema>;
export type ExerciseParsed = z.output<typeof exerciseSchema>;

export const createExerciseSchema = exerciseSchema;
export const updateExerciseSchema = exerciseSchema.extend({
  id: z.string().uuid(),
  change_note: z.string().trim().max(300).optional(),
});

export const idSchema = z.object({ id: z.string().uuid() });

export const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export const bulkCategorySchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  category: categoryEnum,
});
export const bulkMuscleGroupSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  muscle_group: z.string().trim().min(1).max(80),
});
export const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: statusEnum,
});

export const muscleLinkSchema = z.object({
  exerciseId: z.string().uuid(),
  muscles: z
    .array(
      z.object({
        muscle_id: z.string().uuid().nullable(),
        muscle_name: z.string().trim().min(1),
        role: z.enum(["primary", "secondary"]),
      })
    )
    .max(30),
});

export const relationSchema = z.object({
  exerciseId: z.string().uuid(),
  relatedId: z.string().uuid(),
  relation: z.enum(RELATION_VALUES as [string, ...string[]]),
});
export const relationIdSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export const mediaAddSchema = z.object({
  exerciseId: z.string().uuid(),
  url: z.string().url(),
  storage_path: z.string().optional(),
  media_type: mediaTypeEnum.default("gif"),
  is_primary: z.boolean().default(false),
});

export const versionRestoreSchema = z.object({
  exerciseId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const mergeSchema = z.object({
  keepId: z.string().uuid(),
  removeIds: z.array(z.string().uuid()).min(1),
});

export const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
});
