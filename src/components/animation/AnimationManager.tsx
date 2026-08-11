"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimationPlayerLoader } from "./AnimationPlayerLoader";
import {
  Upload,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  Link2,
  Film,
  Check,
} from "lucide-react";
import type { Animation, GenderSupport } from "@/lib/database.types";

interface ExerciseLite {
  id: string;
  name: string;
}

const GENDERS: { value: GenderSupport; label: string }[] = [
  { value: "both", label: "Her ikisi" },
  { value: "male", label: "Erkek" },
  { value: "female", label: "Kadın" },
];

/**
 * Admin Animation Manager: yükleme, önizleme, egzersize eşleme, silme.
 * .glb dosyaları 'animations' public bucket'ına yüklenir.
 */
export function AnimationManager({
  initialAnimations,
  exercises,
}: {
  initialAnimations: Animation[];
  exercises: ExerciseLite[];
}) {
  const [animations, setAnimations] = useState<Animation[]>(initialAnimations);
  const [previewId, setPreviewId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <CreateForm
        onCreated={(a) => setAnimations((prev) => [a, ...prev])}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Animasyonlar ({animations.length})
        </h2>
        {animations.length === 0 ? (
          <p className="card py-8 text-center text-sm text-fg-muted">
            Henüz animasyon yok. Yukarıdan ekle.
          </p>
        ) : (
          animations.map((a) => (
            <AnimationRow
              key={a.id}
              animation={a}
              exercises={exercises}
              preview={previewId === a.id}
              onTogglePreview={() =>
                setPreviewId((id) => (id === a.id ? null : a.id))
              }
              onDeleted={() =>
                setAnimations((prev) => prev.filter((x) => x.id !== a.id))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: (a: Animation) => void }) {
  const supabase = createClient();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("3");
  const [loop, setLoop] = useState(true);
  const [gender, setGender] = useState<GenderSupport>("both");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!key.trim() || !name.trim()) {
      setMsg("Anahtar ve ad zorunlu.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      let url: string | null = null;
      if (file) {
        const path = `${key.trim().toLowerCase()}-${Date.now()}.glb`;
        const { error: upErr } = await supabase.storage
          .from("animations")
          .upload(path, file, { upsert: true, contentType: "model/gltf-binary" });
        if (upErr) throw upErr;
        url = supabase.storage.from("animations").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase
        .from("animations")
        .insert({
          animation_key: key.trim().toLowerCase(),
          name: name.trim(),
          url,
          duration_sec: Number(duration) || 3,
          loop,
          gender_support: gender,
        })
        .select("*")
        .single();
      if (error) throw error;
      onCreated(data as Animation);
      setKey("");
      setName("");
      setFile(null);
      setMsg("Eklendi ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Hata oluştu.");
    }
    setBusy(false);
  }

  return (
    <div className="card space-y-3">
      <h2 className="flex items-center gap-2 font-bold">
        <Film size={18} className="text-brand" /> Yeni Animasyon
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Anahtar (key)</label>
          <input className="input" placeholder="bench_press" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div>
          <label className="label">Ad</label>
          <input className="input" placeholder="Bench Press" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Süre (sn)</label>
          <input className="input" type="number" step="0.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <label className="label">Cinsiyet desteği</label>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value as GenderSupport)}>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        Döngü (loop)
      </label>
      <label className="btn-ghost w-full cursor-pointer justify-center text-sm">
        <Upload size={15} /> {file ? file.name : ".glb dosyası seç (opsiyonel)"}
        <input
          type="file"
          accept=".glb,model/gltf-binary"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary text-sm">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Kaydet
        </button>
        {msg && <span className="text-xs text-fg-muted">{msg}</span>}
      </div>
      <p className="text-[11px] text-fg-muted">
        Dosya seçmezsen placeholder animasyonla çalışır. .glb yüklersen gerçek
        animasyon otomatik devreye girer.
      </p>
    </div>
  );
}

function AnimationRow({
  animation,
  exercises,
  preview,
  onTogglePreview,
  onDeleted,
}: {
  animation: Animation;
  exercises: ExerciseLite[];
  preview: boolean;
  onTogglePreview: () => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const [mapping, setMapping] = useState(false);
  const [exName, setExName] = useState("");
  const [gender, setGender] = useState<GenderSupport>("both");
  const [priority, setPriority] = useState("100");
  const [mapMsg, setMapMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!confirm(`"${animation.name}" silinsin mi?`)) return;
    setDeleting(true);
    if (animation.url) {
      const path = animation.url.split("/animations/")[1];
      if (path) await supabase.storage.from("animations").remove([path]);
    }
    await supabase.from("animations").delete().eq("id", animation.id);
    onDeleted();
  }

  async function saveMapping() {
    const ex = exercises.find((e) => e.name === exName.trim());
    if (!ex) {
      setMapMsg("Egzersiz bulunamadı (listeden seç).");
      return;
    }
    const { error } = await supabase.from("animation_mapping").insert({
      exercise_id: ex.id,
      animation_id: animation.id,
      gender,
      priority: Number(priority) || 100,
    });
    setMapMsg(error ? error.message : "Eşlendi ✓");
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{animation.name}</p>
          <p className="text-xs text-fg-muted">
            <code>{animation.animation_key}</code> · {animation.duration_sec ?? 3} sn ·{" "}
            {animation.url ? "gerçek .glb" : "placeholder"} · {animation.gender_support}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onTogglePreview} className="btn-ghost text-xs" aria-label="Önizle">
            {preview ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={() => setMapping((m) => !m)} className="btn-ghost text-xs" aria-label="Eşle">
            <Link2 size={14} />
          </button>
          <button
            onClick={del}
            disabled={deleting}
            className="grid h-8 w-8 place-items-center rounded-lg bg-coral/10 text-coral"
            aria-label="Sil"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {preview && (
        <AnimationPlayerLoader
          animation={animation}
          animationKey={animation.animation_key}
          exerciseName={animation.name}
        />
      )}

      {mapping && (
        <div className="space-y-2 rounded-xl bg-ink-soft p-3">
          <p className="text-xs font-semibold text-fg-muted">Egzersize eşle</p>
          <input
            className="input"
            list="ex-list"
            placeholder="Egzersiz ara..."
            value={exName}
            onChange={(e) => setExName(e.target.value)}
          />
          <datalist id="ex-list">
            {exercises.slice(0, 1000).map((e) => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value as GenderSupport)}>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <input
              className="input w-24"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="Öncelik"
            />
            <button onClick={saveMapping} className="btn-primary shrink-0 text-sm">
              Eşle
            </button>
          </div>
          {mapMsg && <p className="text-xs text-fg-muted">{mapMsg}</p>}
        </div>
      )}
    </div>
  );
}
