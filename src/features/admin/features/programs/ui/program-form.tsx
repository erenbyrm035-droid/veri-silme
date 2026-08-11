"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { ArrayField } from "@/features/admin/features/exercises/ui/array-field";
import { CoverThumb } from "./cover-thumb";
import { programSchema, type ProgramFormValues } from "../schema";
import {
  LEVEL_LABELS, LEVEL_VALUES, GENDER_LABELS, GENDER_VALUES, ENV_LABELS, ENV_VALUES, slugify,
} from "../constants";
import { createProgram, updateProgram } from "../actions";
import type { WorkoutProgram } from "@/lib/database.types";

function toDefaults(p?: WorkoutProgram | null): ProgramFormValues {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    cover_url: p?.cover_url ?? "",
    short_description: p?.short_description ?? "",
    description: p?.description ?? "",
    category: p?.category ?? "",
    level: p?.level ?? "beginner",
    goal: p?.goal ?? "",
    gender: p?.gender ?? "both",
    environment: p?.environment ?? "both",
    weeks: p?.weeks ?? 4,
    days_per_week: p?.days_per_week ?? 3,
    est_minutes: p?.est_minutes ?? null,
    calories: p?.calories ?? null,
    tags: p?.tags ?? [],
    status: p?.status ?? "draft",
  };
}

export function ProgramForm({
  program, categories, tagSuggestions,
}: {
  program?: WorkoutProgram | null;
  categories: { slug: string; name: string }[];
  tagSuggestions: string[];
}) {
  const router = useRouter();
  const isEdit = !!program;
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProgramFormValues>({
    resolver: zodResolver(programSchema),
    defaultValues: toDefaults(program),
  });

  const nameVal = watch("name");
  const coverVal = watch("cover_url");
  const slugTouched = React.useRef(false);
  React.useEffect(() => {
    if (!isEdit && !slugTouched.current) setValue("slug", slugify(nameVal || ""));
  }, [nameVal, isEdit, setValue]);

  async function persist(values: ProgramFormValues) {
    setErrorMsg(null); setSaveState("saving");
    if (isEdit && program) {
      const res = await updateProgram({ ...values, id: program.id });
      if (!res.ok) { setSaveState("error"); setErrorMsg(res.error ?? "Kaydedilemedi."); return; }
      setSaveState("saved"); router.refresh();
    } else {
      const res = await createProgram(values);
      if (!res.ok || !res.data) { setSaveState("error"); setErrorMsg(res.error ?? "Oluşturulamadı."); return; }
      setSaveState("saved"); router.push(`/admin/programs/${res.data.id}`);
    }
  }

  const persistRef = React.useRef(persist); persistRef.current = persist;
  React.useEffect(() => {
    if (!isEdit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch(() => {
      setSaveState("idle");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handleSubmit((v) => persistRef.current(v))(), 1200);
    });
    return () => { if (timer) clearTimeout(timer); sub.unsubscribe(); };
  }, [watch, handleSubmit, isEdit]);

  return (
    <form onSubmit={handleSubmit(persist)} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          {saveState === "saving" && <><Loader2 size={15} className="animate-spin" /> Kaydediliyor…</>}
          {saveState === "saved" && <span className="flex items-center gap-1 text-emerald-400"><Check size={15} /> {isEdit ? "Kaydedildi" : "Oluşturuldu"}</span>}
          {saveState === "error" && <span className="text-coral">{errorMsg}</span>}
          {isEdit && saveState === "idle" && <span>Otomatik kayıt açık</span>}
        </div>
        <Button type="submit" size="sm" disabled={saveState === "saving"}><Save size={15} /> {isEdit ? "Kaydet" : "Program Oluştur"}</Button>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <CoverThumb url={coverVal || null} size={96} />
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Program Adı *</Label>
              <Input {...register("name")} placeholder="Push Pull Legs" />
              {errors.name && <p className="mt-1 text-xs text-coral">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Slug</Label>
              <Input {...register("slug", { onChange: () => (slugTouched.current = true) })} placeholder="push-pull-legs" />
            </div>
            <div className="sm:col-span-2">
              <Label>Kapak Fotoğrafı (URL)</Label>
              <Input {...register("cover_url")} placeholder="https://…/kapak.jpg" />
            </div>
          </div>
        </div>

        <div>
          <Label>Kısa Açıklama</Label>
          <Input {...register("short_description")} placeholder="Tek cümlelik özet" />
        </div>
        <div>
          <Label>Detay Açıklama</Label>
          <Textarea {...register("description")} placeholder="Program hakkında detaylı bilgi" className="min-h-[120px]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Kategori</Label>
            <Select {...register("category")}>
              <option value="">Seçiniz</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Seviye</Label>
            <Select {...register("level")}>{LEVEL_VALUES.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</Select>
          </div>
          <div>
            <Label>Hedef</Label>
            <Input {...register("goal")} placeholder="Kas kazanma" />
          </div>
          <div>
            <Label>Cinsiyet</Label>
            <Select {...register("gender")}>{GENDER_VALUES.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}</Select>
          </div>
          <div>
            <Label>Ortam</Label>
            <Select {...register("environment")}>{ENV_VALUES.map((e) => <option key={e} value={e}>{ENV_LABELS[e]}</option>)}</Select>
          </div>
          <div>
            <Label>Yayın Durumu</Label>
            <Select {...register("status")}><option value="draft">Taslak</option><option value="published">Yayında</option></Select>
          </div>
          <div>
            <Label>Hafta Sayısı</Label>
            <Input type="number" {...register("weeks")} min={1} max={52} />
          </div>
          <div>
            <Label>Gün / Hafta</Label>
            <Input type="number" {...register("days_per_week")} min={1} max={7} />
          </div>
          <div>
            <Label>Tahmini Süre (dk)</Label>
            <Input type="number" {...register("est_minutes")} placeholder="45" />
          </div>
          <div>
            <Label>Kalori (yaklaşık)</Label>
            <Input type="number" {...register("calories")} placeholder="0" />
          </div>
        </div>

        <div>
          <Label>Etiketler</Label>
          <Controller control={control} name="tags" render={({ field }) => (
            <ArrayField value={field.value ?? []} onChange={field.onChange} suggestions={tagSuggestions} placeholder="Etiket ekle" />
          )} />
        </div>
      </Card>
    </form>
  );
}
