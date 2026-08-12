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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { ArrayField } from "./array-field";
import { GifThumb } from "./gif-thumb";
import { exerciseSchema, type ExerciseFormValues } from "../schema";
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  DIFFICULTY_LABELS,
  DIFFICULTY_VALUES,
  MOVEMENT_PATTERNS,
  slugify,
} from "../constants";
import { createExercise, updateExercise } from "../actions";
import type { Exercise } from "@/lib/database.types";

function toDefaults(ex?: Exercise | null): ExerciseFormValues {
  return {
    name: ex?.name ?? "",
    slug: ex?.slug ?? "",
    category: ex?.category ?? "compound",
    subcategory: ex?.subcategory ?? "",
    muscle_group: ex?.muscle_group ?? "",
    secondary_muscles: ex?.secondary_muscles ?? [],
    difficulty: ex?.difficulty ?? "beginner",
    equipment: ex?.equipment ?? "",
    status: ex?.status ?? "published",
    media_type: ex?.media_type ?? "gif",
    gif_url: ex?.gif_url ?? "",
    description: ex?.description ?? "",
    instructions: ex?.instructions ?? [],
    breathing: ex?.breathing ?? "",
    tempo: ex?.tempo ?? "",
    range_of_motion: ex?.range_of_motion ?? "",
    start_position: ex?.start_position ?? "",
    end_position: ex?.end_position ?? "",
    common_mistakes: ex?.common_mistakes ?? [],
    tips: ex?.tips ?? [],
    tags: ex?.tags ?? [],
    calories: ex?.calories ?? null,
    movement_type: ex?.movement_type ?? "",
    english_name: ex?.english_name ?? "",
    aliases: ex?.aliases ?? [],
    video_slug: ex?.video_slug ?? "",
    rec_sets: ex?.rec_sets ?? null,
    rec_reps: ex?.rec_reps ?? "",
    rec_rest_sec: ex?.rec_rest_sec ?? null,
    average_duration_sec: ex?.average_duration_sec ?? null,
    seo_title: ex?.seo_title ?? "",
    seo_description: ex?.seo_description ?? "",
    og_image_url: ex?.og_image_url ?? "",
  };
}

export function ExerciseForm({
  exercise,
  muscleSuggestions,
  tagSuggestions,
}: {
  exercise?: Exercise | null;
  muscleSuggestions: string[];
  tagSuggestions: string[];
}) {
  const router = useRouter();
  const isEdit = !!exercise;
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: toDefaults(exercise),
  });

  const nameVal = watch("name");
  const slugVal = watch("slug");
  const gifVal = watch("gif_url");

  // Yeni kayıtta slug otomatik türet (kullanıcı elle değiştirmediyse).
  const slugTouched = React.useRef(false);
  React.useEffect(() => {
    if (!isEdit && !slugTouched.current) {
      setValue("slug", slugify(nameVal || ""));
    }
  }, [nameVal, isEdit, setValue]);

  async function persist(values: ExerciseFormValues) {
    setErrorMsg(null);
    setSaveState("saving");
    if (isEdit && exercise) {
      const res = await updateExercise({ ...values, id: exercise.id });
      if (!res.ok) { setSaveState("error"); setErrorMsg(res.error ?? "Kaydedilemedi."); return; }
      setSaveState("saved");
      router.refresh();
    } else {
      const res = await createExercise(values);
      if (!res.ok || !res.data) { setSaveState("error"); setErrorMsg(res.error ?? "Oluşturulamadı."); return; }
      setSaveState("saved");
      router.push(`/admin/exercises/${res.data.id}`);
    }
  }

  // Auto Save (yalnızca düzenlemede) — değişiklikte 1.2sn debounce ile kaydeder.
  const persistRef = React.useRef(persist);
  persistRef.current = persist;
  React.useEffect(() => {
    if (!isEdit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch(() => {
      setSaveState("idle");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        handleSubmit((v) => persistRef.current(v))();
      }, 1200);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [watch, handleSubmit, isEdit]);

  return (
    <form onSubmit={handleSubmit(persist)} className="space-y-4">
      {/* Kaydet çubuğu */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          {saveState === "saving" && <><Loader2 size={15} className="animate-spin" /> Kaydediliyor…</>}
          {saveState === "saved" && <span className="flex items-center gap-1 text-emerald-400"><Check size={15} /> {isEdit ? "Kaydedildi" : "Oluşturuldu"}</span>}
          {saveState === "error" && <span className="text-coral">{errorMsg}</span>}
          {isEdit && saveState === "idle" && <span>Otomatik kayıt açık</span>}
        </div>
        <Button type="submit" size="sm" disabled={saveState === "saving"}>
          <Save size={15} /> {isEdit ? "Kaydet" : "Egzersiz Oluştur"}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="content">İçerik</TabsTrigger>
          <TabsTrigger value="media">Medya & SEO</TabsTrigger>
        </TabsList>

        {/* GENEL */}
        <TabsContent value="general">
          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Egzersiz Adı *</Label>
                <Input {...register("name")} placeholder="Bench Press" />
                {errors.name && <p className="mt-1 text-xs text-coral">{errors.name.message}</p>}
              </div>
              <div>
                <Label>Slug</Label>
                <Input {...register("slug", { onChange: () => (slugTouched.current = true) })} placeholder="bench-press" />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select {...register("category")}>
                  {CATEGORY_VALUES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </Select>
              </div>
              <div>
                <Label>Alt Kategori</Label>
                <Input {...register("subcategory")} placeholder="Örn. Üst Göğüs" />
              </div>
              <div>
                <Label>Ana Kas *</Label>
                <Input {...register("muscle_group")} placeholder="Göğüs" list="muscle-suggestions" />
                <datalist id="muscle-suggestions">
                  {muscleSuggestions.map((m) => <option key={m} value={m} />)}
                </datalist>
                {errors.muscle_group && <p className="mt-1 text-xs text-coral">{errors.muscle_group.message}</p>}
              </div>
              <div>
                <Label>Zorluk</Label>
                <Select {...register("difficulty")}>
                  {DIFFICULTY_VALUES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </Select>
              </div>
              <div>
                <Label>Ekipman</Label>
                <Input {...register("equipment")} placeholder="Barbell" />
              </div>
              <div>
                <Label>Hareket Paterni</Label>
                <Input {...register("movement_type")} placeholder="push / pull / squat…" list="mp-suggestions" />
                <datalist id="mp-suggestions">
                  {MOVEMENT_PATTERNS.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <Label>Kalori (yaklaşık)</Label>
                <Input type="number" {...register("calories")} placeholder="0" />
              </div>
              {/* GÖSTERİLEN İSİM — arayüz her yerde bunu gösteriyor.
                  `name` yalnızca veritabanı iç anahtarı. */}
              <div>
                <Label>Standart İngilizce Ad (gösterilen isim)</Label>
                <Input {...register("english_name")} placeholder="Romanian Deadlift" />
              </div>
              <div>
                <Label>Video dosya adı (slug)</Label>
                <Input {...register("video_slug")} placeholder="romanian-deadlift" />
              </div>
              {/* WORKOUT ENGINE bu üç alanı okuyor: hedef tekrar aralığı
                  progressive overload önerisini, dinlenme süresi sayacı,
                  ortalama süre ise antrenman süresi tahminini belirliyor. */}
              <div>
                <Label>Önerilen Set</Label>
                <Input type="number" {...register("rec_sets")} placeholder="3" />
              </div>
              <div>
                <Label>Önerilen Tekrar (aralık)</Label>
                <Input {...register("rec_reps")} placeholder="8-12" />
              </div>
              <div>
                <Label>Dinlenme (sn)</Label>
                <Input type="number" {...register("rec_rest_sec")} placeholder="90" />
              </div>
              <div>
                <Label>Ortalama Set Süresi (sn)</Label>
                <Input type="number" {...register("average_duration_sec")} placeholder="45" />
              </div>
              <div>
                <Label>Durum</Label>
                <Select {...register("status")}>
                  <option value="published">Yayında</option>
                  <option value="draft">Taslak</option>
                </Select>
              </div>
            </div>

            <div>
              <Label>İkincil Kaslar</Label>
              <Controller
                control={control}
                name="secondary_muscles"
                render={({ field }) => (
                  <ArrayField value={field.value ?? []} onChange={field.onChange} suggestions={muscleSuggestions} placeholder="Kas ekle" />
                )}
              />
            </div>
            <div>
              <Label>Etiketler</Label>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <ArrayField value={field.value ?? []} onChange={field.onChange} suggestions={tagSuggestions} placeholder="Etiket ekle" />
                )}
              />
            </div>
          </Card>
        </TabsContent>

        {/* İÇERİK */}
        <TabsContent value="content">
          <Card className="space-y-4 p-5">
            <div>
              <Label>Açıklama</Label>
              <Textarea {...register("description")} placeholder="Egzersizin kısa açıklaması" />
            </div>
            <div>
              <Label>Nasıl Yapılır (adımlar)</Label>
              <Controller
                control={control}
                name="instructions"
                render={({ field }) => (
                  <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Adım ekle" />
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nefes</Label>
                <Input {...register("breathing")} placeholder="İterken nefes ver" />
              </div>
              <div>
                <Label>Tempo</Label>
                <Input {...register("tempo")} placeholder="2-0-1-0" />
              </div>
              <div>
                <Label>ROM (Hareket Açıklığı)</Label>
                <Input {...register("range_of_motion")} placeholder="Tam ROM" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Başlangıç Pozisyonu</Label>
                <Textarea {...register("start_position")} />
              </div>
              <div>
                <Label>Bitiş Pozisyonu</Label>
                <Textarea {...register("end_position")} />
              </div>
            </div>
            <div>
              <Label>Yaygın Hatalar</Label>
              <Controller
                control={control}
                name="common_mistakes"
                render={({ field }) => (
                  <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="Hata ekle" />
                )}
              />
            </div>
            <div>
              <Label>İpuçları</Label>
              <Controller
                control={control}
                name="tips"
                render={({ field }) => (
                  <ArrayField value={field.value ?? []} onChange={field.onChange} placeholder="İpucu ekle" />
                )}
              />
            </div>
          </Card>
        </TabsContent>

        {/* MEDYA & SEO */}
        <TabsContent value="media">
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <GifThumb exercise={{ gif_url: gifVal || null, slug: slugVal || null }} size={72} />
              <div className="flex-1">
                <Label>GIF URL</Label>
                <Input {...register("gif_url")} placeholder="https://…/hareket.gif" />
                <p className="mt-1 text-xs text-fg-muted">
                  Boş bırakılırsa slug&apos;a göre <code>exercise-media/{slugVal || "slug"}.gif</code> otomatik denenir.
                  Dosya yüklemek için aşağıdaki Medya bölümünü kullanın.
                </p>
              </div>
            </div>
            <div>
              <Label>Medya Tipi</Label>
              <Select {...register("media_type")}>
                <option value="gif">GIF</option>
                <option value="animation">Animasyon (yakında)</option>
                <option value="video">Video (yakında)</option>
              </Select>
            </div>
            <div className="border-t border-ink-border pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>SEO Başlığı</Label>
                  <Input {...register("seo_title")} placeholder="Bench Press Nasıl Yapılır?" />
                </div>
                <div>
                  <Label>Open Graph Görseli (URL)</Label>
                  <Input {...register("og_image_url")} placeholder="https://…/og.png" />
                </div>
              </div>
              <div className="mt-4">
                <Label>SEO Açıklaması</Label>
                <Textarea {...register("seo_description")} placeholder="Arama motorları için kısa açıklama" />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
}
