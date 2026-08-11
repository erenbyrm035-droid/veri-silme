"use client";

import * as React from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Select } from "@/features/admin/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { ImageThumb } from "./shared";
import { ArrayField } from "@/features/admin/features/exercises/ui/array-field";
import { foodSchema, type FoodFormValues } from "../schema";
import { FOOD_CATEGORIES, COMMON_ALLERGENS } from "../constants";
import { createFood, updateFood } from "../actions";
import type { Food } from "@/lib/database.types";

function toDefaults(f?: Food | null): FoodFormValues {
  const n = (v: number | null | undefined) => v ?? 0;
  return {
    name: f?.name ?? "", brand: f?.brand ?? "", category: f?.category ?? "", subcategory: f?.subcategory ?? "",
    barcode: f?.barcode ?? "", external_id: f?.external_id ?? "", external_source: f?.external_source ?? "",
    image_url: f?.image_url ?? "", serving_desc: f?.serving_desc ?? "", serving_grams: f?.serving_grams ?? 100,
    glycemic_index: f?.glycemic_index ?? null, is_verified: f?.is_verified ?? false, is_turkish: f?.is_turkish ?? true,
    allergens: f?.allergens ?? [],
    calories: n(f?.calories), protein_g: n(f?.protein_g), carbs_g: n(f?.carbs_g), fat_g: n(f?.fat_g),
    fiber_g: n(f?.fiber_g), sugar_g: n(f?.sugar_g), sodium_mg: n(f?.sodium_mg), potassium_mg: n(f?.potassium_mg),
    cholesterol_mg: n(f?.cholesterol_mg), calcium_mg: n(f?.calcium_mg), iron_mg: n(f?.iron_mg), magnesium_mg: n(f?.magnesium_mg),
    phosphorus_mg: n(f?.phosphorus_mg), zinc_mg: n(f?.zinc_mg), vitamin_a_mcg: n(f?.vitamin_a_mcg), vitamin_b_mg: n(f?.vitamin_b_mg),
    vitamin_c_mg: n(f?.vitamin_c_mg), vitamin_d_mcg: n(f?.vitamin_d_mcg), vitamin_e_mg: n(f?.vitamin_e_mg), vitamin_k_mcg: n(f?.vitamin_k_mcg),
    omega3_g: n(f?.omega3_g), omega6_g: n(f?.omega6_g), water_g: n(f?.water_g),
  };
}

const MACRO_FIELDS: { key: keyof FoodFormValues; label: string }[] = [
  { key: "calories", label: "Kalori (kcal)" }, { key: "protein_g", label: "Protein (g)" },
  { key: "carbs_g", label: "Karbonhidrat (g)" }, { key: "fat_g", label: "Yağ (g)" },
  { key: "fiber_g", label: "Lif (g)" }, { key: "sugar_g", label: "Şeker (g)" },
  { key: "water_g", label: "Su (g)" }, { key: "omega3_g", label: "Omega 3 (g)" }, { key: "omega6_g", label: "Omega 6 (g)" },
];
const MICRO_FIELDS: { key: keyof FoodFormValues; label: string }[] = [
  { key: "sodium_mg", label: "Sodyum (mg)" }, { key: "potassium_mg", label: "Potasyum (mg)" },
  { key: "cholesterol_mg", label: "Kolesterol (mg)" }, { key: "calcium_mg", label: "Kalsiyum (mg)" },
  { key: "iron_mg", label: "Demir (mg)" }, { key: "magnesium_mg", label: "Magnezyum (mg)" },
  { key: "phosphorus_mg", label: "Fosfor (mg)" }, { key: "zinc_mg", label: "Çinko (mg)" },
  { key: "vitamin_a_mcg", label: "Vitamin A (mcg)" }, { key: "vitamin_b_mg", label: "Vitamin B (mg)" },
  { key: "vitamin_c_mg", label: "Vitamin C (mg)" }, { key: "vitamin_d_mcg", label: "Vitamin D (mcg)" },
  { key: "vitamin_e_mg", label: "Vitamin E (mg)" }, { key: "vitamin_k_mcg", label: "Vitamin K (mcg)" },
];

export function FoodForm({ food }: { food?: Food | null }) {
  const router = useRouter();
  const isEdit = !!food;
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FoodFormValues>({
    resolver: zodResolver(foodSchema), defaultValues: toDefaults(food),
  });
  const imageVal = watch("image_url");

  async function persist(values: FoodFormValues) {
    setErrorMsg(null); setSaveState("saving");
    if (isEdit && food) {
      const res = await updateFood({ ...values, id: food.id });
      if (!res.ok) { setSaveState("error"); setErrorMsg(res.error ?? "Kaydedilemedi."); return; }
      setSaveState("saved"); router.refresh();
    } else {
      const res = await createFood(values);
      if (!res.ok || !res.data) { setSaveState("error"); setErrorMsg(res.error ?? "Oluşturulamadı."); return; }
      setSaveState("saved"); router.push(`/admin/nutrition/foods/${res.data.id}`);
    }
  }
  const persistRef = React.useRef(persist); persistRef.current = persist;
  React.useEffect(() => {
    if (!isEdit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch(() => { setSaveState("idle"); if (timer) clearTimeout(timer); timer = setTimeout(() => handleSubmit((v) => persistRef.current(v))(), 1200); });
    return () => { if (timer) clearTimeout(timer); sub.unsubscribe(); };
  }, [watch, handleSubmit, isEdit]);

  const NumField = ({ k, label }: { k: keyof FoodFormValues; label: string }) => (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="any" {...register(k as Path<FoodFormValues>)} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(persist)} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          {saveState === "saving" && <><Loader2 size={15} className="animate-spin" /> Kaydediliyor…</>}
          {saveState === "saved" && <span className="flex items-center gap-1 text-emerald-400"><Check size={15} /> {isEdit ? "Kaydedildi" : "Oluşturuldu"}</span>}
          {saveState === "error" && <span className="text-coral">{errorMsg}</span>}
          {isEdit && saveState === "idle" && <span>Otomatik kayıt açık · 100 g başına değerler</span>}
        </div>
        <Button type="submit" size="sm" disabled={saveState === "saving"}><Save size={15} /> {isEdit ? "Kaydet" : "Besin Oluştur"}</Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="macros">Makrolar</TabsTrigger>
          <TabsTrigger value="micros">Mikro & Vitamin</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="space-y-4 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <ImageThumb url={imageVal || null} size={88} className="!h-24 !w-24" />
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div><Label>İsim *</Label><Input {...register("name")} placeholder="Tavuk Göğsü" />{errors.name && <p className="mt-1 text-xs text-coral">{errors.name.message}</p>}</div>
                <div><Label>Marka</Label><Input {...register("brand")} placeholder="—" /></div>
                <div className="sm:col-span-2"><Label>Görsel (URL)</Label><Input {...register("image_url")} placeholder="https://…/gorsel.jpg" /></div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label>Kategori</Label><Select {...register("category")}><option value="">Seçiniz</option>{FOOD_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select></div>
              <div><Label>Alt Kategori</Label><Input {...register("subcategory")} placeholder="—" /></div>
              <div><Label>Barkod</Label><Input {...register("barcode")} placeholder="—" /></div>
              <div><Label>Porsiyon Açıklaması</Label><Input {...register("serving_desc")} placeholder="1 orta boy / 100 g" /></div>
              <div><Label>Porsiyon (g)</Label><Input type="number" step="any" {...register("serving_grams")} /></div>
              <div><Label>Glisemik İndeks</Label><Input type="number" {...register("glycemic_index")} placeholder="—" /></div>
              <div><Label>Dış Kaynak</Label><Input {...register("external_source")} placeholder="turkomp / usda" /></div>
              <div><Label>Dış Kaynak ID</Label><Input {...register("external_id")} placeholder="—" /></div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("is_verified")} className="accent-brand" /> Doğrulanmış</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("is_turkish")} className="accent-brand" /> Türk mutfağı</label>
              </div>
            </div>
            <div>
              <Label>Alerjen Bilgisi</Label>
              <Controller control={control} name="allergens" render={({ field }) => (
                <ArrayField value={field.value ?? []} onChange={field.onChange} suggestions={COMMON_ALLERGENS} placeholder="Alerjen ekle" />
              )} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="macros">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">{MACRO_FIELDS.map((f) => <NumField key={f.key} k={f.key} label={f.label} />)}</div>
          </Card>
        </TabsContent>

        <TabsContent value="micros">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">{MICRO_FIELDS.map((f) => <NumField key={f.key} k={f.key} label={f.label} />)}</div>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
}
