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
import { recipeSchema, type RecipeFormValues } from "../schema";
import { DIET_CATEGORIES } from "../constants";
import { createRecipe, updateRecipe } from "../actions";
import type { Recipe } from "@/lib/database.types";

function toDefaults(r?: Recipe | null): RecipeFormValues {
  return {
    name: r?.name ?? "", slug: r?.slug ?? "", cover_url: r?.cover_url ?? "", video_url: r?.video_url ?? "",
    description: r?.description ?? "", instructions: r?.instructions ?? [], servings: r?.servings ?? 1,
    prep_minutes: r?.prep_minutes ?? null, cook_minutes: r?.cook_minutes ?? null,
    calories: r?.calories ?? 0, protein_g: r?.protein_g ?? 0, carbs_g: r?.carbs_g ?? 0, fat_g: r?.fat_g ?? 0,
    category: r?.category ?? "", tags: r?.tags ?? [], status: r?.status ?? "draft",
  };
}

export function RecipeForm({ recipe, macrosLocked }: { recipe?: Recipe | null; macrosLocked?: boolean }) {
  const router = useRouter();
  const isEdit = !!recipe;
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema), defaultValues: toDefaults(recipe),
  });
  const coverVal = watch("cover_url");

  async function persist(values: RecipeFormValues) {
    setErrorMsg(null); setSaveState("saving");
    if (isEdit && recipe) {
      const res = await updateRecipe({ ...values, id: recipe.id });
      if (!res.ok) { setSaveState("error"); setErrorMsg(res.error ?? "Kaydedilemedi."); return; }
      setSaveState("saved"); router.refresh();
    } else {
      const res = await createRecipe(values);
      if (!res.ok || !res.data) { setSaveState("error"); setErrorMsg(res.error ?? "Oluşturulamadı."); return; }
      setSaveState("saved"); router.push(`/admin/nutrition/recipes/${res.data.id}`);
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
        <Button type="submit" size="sm" disabled={saveState === "saving"}><Save size={15} /> {isEdit ? "Kaydet" : "Tarif Oluştur"}</Button>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ImageThumb url={coverVal || null} size={88} className="!h-24 !w-24" />
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div><Label>Tarif Adı *</Label><Input {...register("name")} placeholder="Tavuklu Bulgur Pilavı" />{errors.name && <p className="mt-1 text-xs text-coral">{errors.name.message}</p>}</div>
            <div><Label>Slug</Label><Input {...register("slug")} placeholder="tavuklu-bulgur-pilavi" /></div>
            <div><Label>Kapak Görseli (URL)</Label><Input {...register("cover_url")} placeholder="https://…/kapak.jpg" /></div>
            <div><Label>Video (URL)</Label><Input {...register("video_url")} placeholder="https://…/video.mp4" /></div>
          </div>
        </div>
        <div><Label>Açıklama</Label><Textarea {...register("description")} /></div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div><Label>Porsiyon</Label><Input type="number" {...register("servings")} /></div>
          <div><Label>Hazırlama (dk)</Label><Input type="number" {...register("prep_minutes")} /></div>
          <div><Label>Pişirme (dk)</Label><Input type="number" {...register("cook_minutes")} /></div>
          <div><Label>Yayın Durumu</Label><Select {...register("status")}><option value="draft">Taslak</option><option value="published">Yayında</option></Select></div>
          <div><Label>Kategori</Label><Select {...register("category")}><option value="">Seçiniz</option>{DIET_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div><Label>Kalori {macrosLocked && <span className="text-fg-muted">(oto)</span>}</Label><Input type="number" step="any" {...register("calories")} readOnly={macrosLocked} /></div>
          <div><Label>Protein (g)</Label><Input type="number" step="any" {...register("protein_g")} readOnly={macrosLocked} /></div>
          <div><Label>Karbonhidrat (g)</Label><Input type="number" step="any" {...register("carbs_g")} readOnly={macrosLocked} /></div>
          <div><Label>Yağ (g)</Label><Input type="number" step="any" {...register("fat_g")} readOnly={macrosLocked} /></div>
        </div>
        {macrosLocked && <p className="text-xs text-fg-muted">Makrolar malzemelerden porsiyon başına otomatik hesaplanır. Malzeme yoksa elle girebilirsiniz.</p>}

        <div><Label>Hazırlanış (adımlar)</Label>
          <Controller control={control} name="instructions" render={({ field }) => (<ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Adım ekle" />)} />
        </div>
        <div><Label>Etiketler</Label>
          <Controller control={control} name="tags" render={({ field }) => (<ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Etiket ekle" />)} />
        </div>
      </Card>
    </form>
  );
}
