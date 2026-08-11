import { z } from "zod";

export const muscleSchema = z.object({
  name_tr: z.string().trim().min(2).max(120),
  latin_name: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  muscle_group: z.string().trim().min(1).max(80),
  region: z.enum(["front", "back"]),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  svg_region_id: z.string().trim().max(80).nullable().optional().or(z.literal("")),
  overview: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  functions: z.array(z.string().trim()).default([]),
  origin: z.string().trim().max(500).nullable().optional().or(z.literal("")),
  insertion: z.string().trim().max(500).nullable().optional().or(z.literal("")),
  innervation: z.string().trim().max(200).nullable().optional().or(z.literal("")),
  common_injuries: z.array(z.string().trim()).default([]),
  rehab_notes: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  joints: z.array(z.string().trim()).default([]),
  daily_life: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  growth_tips: z.array(z.string().trim()).default([]),
  color: z.string().trim().max(20).nullable().optional().or(z.literal("")),
  model_region: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type MuscleFormValues = z.input<typeof muscleSchema>;
