import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { ExerciseMediaListRow, ExerciseMediaStatus } from "@/lib/database.types";

export type MediaFilter = "all" | "complete" | "partial" | "none" | "no_gif" | "no_video" | "no_thumb";

const PAGE = 20;

interface RawExercise {
  id: string; name: string; category: string; muscle_group: string;
  gif_url: string | null; video_url: string | null; image_url: string | null;
  exercise_media_set: MediaSetEmbed | MediaSetEmbed[] | null;
}
interface MediaSetEmbed {
  thumbnail_url: string | null; gif_url: string | null; video_url: string | null;
  male_gif: string | null; female_gif: string | null; male_video: string | null; female_video: string | null;
  status: ExerciseMediaStatus;
}

function embed(x: RawExercise): MediaSetEmbed | null {
  const s = x.exercise_media_set;
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function toRow(x: RawExercise): ExerciseMediaListRow {
  const s = embed(x);
  // Medya seti yoksa exercises tablosundaki eski alanları da dikkate al.
  const gif = s?.gif_url ?? x.gif_url ?? null;
  const video = s?.video_url ?? x.video_url ?? null;
  const thumb = s?.thumbnail_url ?? x.image_url ?? null;
  const maleGif = s?.male_gif ?? null, femaleGif = s?.female_gif ?? null;
  const maleVid = s?.male_video ?? null, femaleVid = s?.female_video ?? null;

  const hasGif = !!gif || (!!maleGif && !!femaleGif);
  const hasVideo = !!video || (!!maleVid && !!femaleVid);
  const hasThumb = !!thumb;
  const any = hasGif || hasVideo || hasThumb || !!maleGif || !!femaleGif || !!maleVid || !!femaleVid;
  const status: ExerciseMediaStatus = !any ? "none" : hasThumb && hasGif && hasVideo ? "complete" : "partial";

  return {
    exercise_id: x.id, name: x.name, category: x.category, muscle_group: x.muscle_group,
    thumbnail_url: thumb, gif_url: gif, video_url: video,
    male_gif: maleGif, female_gif: femaleGif, male_video: maleVid, female_video: femaleVid, status,
  };
}

async function fetchAll(): Promise<ExerciseMediaListRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercises")
    .select("id, name, category, muscle_group, gif_url, video_url, image_url, exercise_media_set(thumbnail_url, gif_url, video_url, male_gif, female_gif, male_video, female_video, status)")
    .order("name");
  return ((data as RawExercise[]) ?? []).map(toRow);
}

export interface MediaListResult { rows: ExerciseMediaListRow[]; total: number; page: number; pageCount: number; }

export async function listExerciseMedia(p: { q?: string; filter?: MediaFilter; page?: number }): Promise<MediaListResult> {
  const all = await fetchAll();
  let rows = all;
  if (p.q) { const t = p.q.toLowerCase().trim(); rows = rows.filter((r) => r.name.toLowerCase().includes(t) || r.muscle_group.toLowerCase().includes(t)); }
  switch (p.filter) {
    case "complete": rows = rows.filter((r) => r.status === "complete"); break;
    case "partial": rows = rows.filter((r) => r.status === "partial"); break;
    case "none": rows = rows.filter((r) => r.status === "none"); break;
    case "no_gif": rows = rows.filter((r) => !r.gif_url && !(r.male_gif && r.female_gif)); break;
    case "no_video": rows = rows.filter((r) => !r.video_url && !(r.male_video && r.female_video)); break;
    case "no_thumb": rows = rows.filter((r) => !r.thumbnail_url); break;
  }
  const total = rows.length;
  const page = Math.max(1, p.page ?? 1);
  const from = (page - 1) * PAGE;
  return { rows: rows.slice(from, from + PAGE), total, page, pageCount: Math.max(1, Math.ceil(total / PAGE)) };
}

export interface MediaStats {
  total: number;
  complete: number; partial: number; none: number;
  missingGif: number; missingVideo: number; missingThumb: number;
  pctGif: number; pctVideo: number; pctThumb: number; pctComplete: number;
}

export async function getMediaStats(): Promise<MediaStats> {
  const all = await fetchAll();
  const total = all.length || 1;
  const has = (r: ExerciseMediaListRow, k: "gif" | "video" | "thumb") =>
    k === "gif" ? !!r.gif_url || (!!r.male_gif && !!r.female_gif)
    : k === "video" ? !!r.video_url || (!!r.male_video && !!r.female_video)
    : !!r.thumbnail_url;
  const missingGif = all.filter((r) => !has(r, "gif")).length;
  const missingVideo = all.filter((r) => !has(r, "video")).length;
  const missingThumb = all.filter((r) => !has(r, "thumb")).length;
  const complete = all.filter((r) => r.status === "complete").length;
  const pct = (n: number) => Math.round(((total - n) / total) * 100);
  return {
    total: all.length,
    complete, partial: all.filter((r) => r.status === "partial").length, none: all.filter((r) => r.status === "none").length,
    missingGif, missingVideo, missingThumb,
    pctGif: pct(missingGif), pctVideo: pct(missingVideo), pctThumb: pct(missingThumb),
    pctComplete: Math.round((complete / total) * 100),
  };
}
