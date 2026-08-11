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
import { ImageThumb } from "./shared";
import { ArrayField } from "@/features/admin/features/exercises/ui/array-field";
import { dietSchema, type DietFormValues } from "../schema";
import { DIET_CATEGORIES } from "../constants";
import { createDiet, updateDiet } from "../actions";
import type { DietPlan } from "@/lib/database.types";

function toDefaults(d?: DietPlan | null): DietFormValues {
  return {
    name: d?.name ?? "", slug: d?.slug ?? "", cover_url: d?.cover_url ?? "", description: d?.description ?? "",
    goal: d?.goal ?? "", category: d?.category ?? "", total_calories: d?.total_calories ?? null,
    protein_g: d?.protein_g ?? null, carbs_g: d?.carbs_g ?? null, fat_g: d?.fat_g ?? null,
    days: d?.days ?? 7, tags: d?.tags ?? [], status: d?.status ?? "draft",
  };
}

export function DietForm({ diet }: { diet?: DietPlan | null }) {
  const router = useRouter();
  const isEdit = !!diet;
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<DietFormValues>({
    resolver: zodResolver(dietSchema), defaultValues: toDefaults(diet),
  });
  const coverVal = watch("cover_url");

  async function persist(values: DietFormValues) {
    setErrorMsg(null); setSaveState("saving");
    if (isEdit && diet) {
      const res = await updateDiet({ ...values, id: diet.id });
      if (!res.ok) { setSaveState("error"); setErrorMsg(res.error ?? "Kaydedilemedi."); return; }
      setSaveState("saved"); router.refresh();
    } else {
      const res = await createDiet(values);
      if (!res.ok || !res.data) { setSaveState("error"); setErrorMsg(res.error ?? "Oluşturulamadı."); return; }
      setSaveState("saved"); router.push(`/admin/nutrition/diets/${res.data.id}`);
    }
  }
  const persistRef = React.useRef(persist); persistRef.current = persist;
  React.useEffect(() => {
    if (!isEdit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch(() => { setSaveState("idle"); if (timer) clearTimeout(timer); timer = setTimeout(() => handleSubmit((v) => persistRef.current(v))(), 1200); });
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
        <Button type="submit" size="sm" disabled={saveState === "saving"}><Save size={15} /> {isEdit ? "Kaydet" : "Plan Oluştur"}</Button>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ImageThumb url={coverVal || null} size={88} className="!h-24 !w-24" />
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div><Label>Plan Adı *</Label><Input {...register("name")} placeholder="Yağ Yakım Diyeti" />{errors.name && <p className="mt-1 text-xs text-coral">{errors.name.message}</p>}</div>
            <div><Label>Slug</Label><Input {...register("slug")} placeholder="yag-yakim-diyeti" /></div>
            <div><Label>Kapak (URL)</Label><Input {...register("cover_url")} placeholder="https://…/kapak.jpg" /></div>
            <div><Label>Hedef</Label><Input {...register("goal")} placeholder="Haftada 0.5 kg yağ kaybı" /></div>
          </div>
        </div>
        <div><Label>Açıklama</Label><Textarea {...register("description")} className="min-h-[100px]" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Kategori</Label><Select {...register("category")}><option value="">Seçiniz</option>{DIET_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select></div>
          <div><Label>Gün Sayısı</Label><Input type="number" {...register("days")} /></div>
          <div><Label>Yayın Durumu</Label><Select {...register("status")}><option value="draft">Taslak</option><option value="published">Yayında</option></Select></div>
          <div><Label>Toplam Kalori</Label><Input type="number" {...register("total_calories")} placeholder="2000" /></div>
          <div><Label>Protein (g)</Label><Input type="number" {...register("protein_g")} /></div>
          <div><Label>Karbonhidrat (g)</Label><Input type="number" {...register("carbs_g")} /></div>
          <div><Label>Yağ (g)</Label><Input type="number" {...register("fat_g")} /></div>
        </div>
        <div><Label>Etiketler</Label>
          <Controller control={control} name="tags" render={({ field }) => (<ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Etiket ekle" />)} />
        </div>
      </Card>
    </form>
  );
}
