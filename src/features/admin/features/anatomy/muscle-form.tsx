"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { ArrayField } from "@/features/admin/features/exercises/ui/array-field";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { muscleSchema, type MuscleFormValues } from "./schema";
import { createMuscle, updateMuscle, deleteMuscle } from "./actions";
import type { Muscle } from "@/lib/database.types";

function toDefaults(m?: Muscle | null): MuscleFormValues {
  return {
    name_tr: m?.name_tr ?? "", latin_name: m?.latin_name ?? "", muscle_group: m?.muscle_group ?? "", region: m?.region ?? "front",
    slug: m?.slug ?? "", svg_region_id: m?.svg_region_id ?? "", overview: m?.overview ?? "", functions: m?.functions ?? [],
    origin: m?.origin ?? "", insertion: m?.insertion ?? "", innervation: m?.innervation ?? "", common_injuries: m?.common_injuries ?? [],
    rehab_notes: m?.rehab_notes ?? "", joints: m?.joints ?? [], daily_life: m?.daily_life ?? "", growth_tips: m?.growth_tips ?? [],
    color: m?.color ?? "", model_region: m?.model_region ?? "", sort_order: m?.sort_order ?? 0,
  };
}

export function MuscleForm({ muscle }: { muscle?: Muscle | null }) {
  const router = useRouter();
  const isEdit = !!muscle;
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const { register, control, handleSubmit, formState: { errors } } = useForm<MuscleFormValues>({ resolver: zodResolver(muscleSchema), defaultValues: toDefaults(muscle) });

  function onSubmit(values: MuscleFormValues) {
    setError(null); setSaved(false);
    startTransition(async () => {
      const res = isEdit ? await updateMuscle({ ...values, id: muscle!.id }) : await createMuscle(values);
      if (!res.ok) return setError(res.error ?? "Kaydedilemedi.");
      setSaved(true);
      if (!isEdit && "data" in res && res.data) router.push(`/admin/anatomy/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm">{saved && <span className="text-emerald-400">Kaydedildi</span>}{error && <span className="text-coral">{error}</span>}</div>
        <div className="flex gap-2">
          {isEdit && <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDel(true)}><Trash2 size={15} /> Sil</Button>}
          <Button type="submit" size="sm" disabled={isPending}><Save size={15} /> {isEdit ? "Kaydet" : "Kas Oluştur"}</Button>
        </div>
      </div>
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Kas Adı (TR) *</Label><Input {...register("name_tr")} placeholder="Biceps" />{errors.name_tr && <p className="mt-1 text-xs text-coral">{errors.name_tr.message}</p>}</div>
          <div><Label>Latince Adı</Label><Input {...register("latin_name")} placeholder="Biceps brachii" /></div>
          <div><Label>Kas Grubu *</Label><Input {...register("muscle_group")} placeholder="Kol" /></div>
          <div><Label>Bölge</Label><Select {...register("region")}><option value="front">Ön</option><option value="back">Arka</option></Select></div>
          <div><Label>SVG Bölge ID</Label><Input {...register("svg_region_id")} placeholder="biceps" /></div>
          <div><Label>3D Model Bölgesi</Label><Input {...register("model_region")} placeholder="biceps (chest, shoulders, quads…)" /></div>
          <div><Label>Renk (hex)</Label><Input {...register("color")} placeholder="#22C55E" /></div>
          <div><Label>Sıra</Label><Input type="number" {...register("sort_order")} /></div>
        </div>
        <div><Label>Genel Bakış</Label><Textarea {...register("overview")} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Origo</Label><Textarea {...register("origin")} /></div>
          <div><Label>İnsersiyo</Label><Textarea {...register("insertion")} /></div>
          <div><Label>İnnervasyon</Label><Input {...register("innervation")} /></div>
        </div>
        <div><Label>Fonksiyonlar</Label><Controller control={control} name="functions" render={({ field }) => <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Fonksiyon ekle" />} /></div>
        <div><Label>Eklemler</Label><Controller control={control} name="joints" render={({ field }) => <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Eklem ekle" />} /></div>
        <div><Label>Yaygın Sakatlıklar</Label><Controller control={control} name="common_injuries" render={({ field }) => <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Sakatlık ekle" />} /></div>
        <div><Label>Rehabilitasyon Notları</Label><Textarea {...register("rehab_notes")} /></div>
        <div><Label>Günlük Yaşam</Label><Textarea {...register("daily_life")} /></div>
        <div><Label>Gelişim İpuçları</Label><Controller control={control} name="growth_tips" render={({ field }) => <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="İpucu ekle" />} /></div>
      </Card>

      {isEdit && (
        <ConfirmDialog open={confirmDel} onOpenChange={setConfirmDel} title="Kası sil" description={`"${muscle?.name_tr}" silinecek.`} confirmLabel="Sil" destructive loading={isPending}
          onConfirm={() => startTransition(async () => { await deleteMuscle(muscle!.id); router.push("/admin/anatomy"); })} />
      )}
    </form>
  );
}
