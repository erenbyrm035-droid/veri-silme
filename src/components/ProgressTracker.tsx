"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BodyMeasurement } from "@/lib/database.types";
import { todayISO, formatShortDate } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Plus, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricKey = "weight_kg" | "waist_cm" | "arm_cm" | "chest_cm" | "shoulder_cm" | "leg_cm";

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: "weight_kg", label: "Kilo", unit: "kg", color: "#d6f84c" },
  { key: "waist_cm", label: "Bel", unit: "cm", color: "#38bdf8" },
  { key: "arm_cm", label: "Kol", unit: "cm", color: "#f472b6" },
  { key: "chest_cm", label: "Göğüs", unit: "cm", color: "#a78bfa" },
  { key: "shoulder_cm", label: "Omuz", unit: "cm", color: "#fb923c" },
  { key: "leg_cm", label: "Bacak", unit: "cm", color: "#34d399" },
];

export function ProgressTracker({
  userId,
  initial,
}: {
  userId: string;
  initial: BodyMeasurement[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>(initial);
  const [metric, setMetric] = useState<MetricKey>("weight_kg");
  const [form, setForm] = useState({
    weight_kg: "",
    waist_cm: "",
    arm_cm: "",
    chest_cm: "",
    shoulder_cm: "",
    leg_cm: "",
    photo_url: "",
  });
  const [saving, setSaving] = useState(false);

  const active = METRICS.find((m) => m.key === metric)!;

  const chartData = measurements
    .filter((m) => m[metric] != null)
    .map((m) => ({
      date: formatShortDate(m.measured_on),
      value: Number(m[metric]),
    }));

  async function save() {
    const payload = {
      user_id: userId,
      measured_on: todayISO(),
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      waist_cm: form.waist_cm ? parseFloat(form.waist_cm) : null,
      arm_cm: form.arm_cm ? parseFloat(form.arm_cm) : null,
      chest_cm: form.chest_cm ? parseFloat(form.chest_cm) : null,
      shoulder_cm: form.shoulder_cm ? parseFloat(form.shoulder_cm) : null,
      leg_cm: form.leg_cm ? parseFloat(form.leg_cm) : null,
      photo_url: form.photo_url || null,
    };
    if (
      !payload.weight_kg &&
      !payload.waist_cm &&
      !payload.arm_cm &&
      !payload.chest_cm &&
      !payload.shoulder_cm &&
      !payload.leg_cm
    )
      return;

    setSaving(true);
    const { data, error } = await supabase
      .from("body_measurements")
      .insert(payload)
      .select("*")
      .single();

    // Kilo güncellendiyse profildeki güncel kiloyu da güncelle.
    if (payload.weight_kg) {
      await supabase
        .from("profiles")
        .update({ weight_kg: payload.weight_kg })
        .eq("id", userId);
    }

    if (!error && data) {
      setMeasurements((m) => [...m, data as BodyMeasurement]);
      setForm({ weight_kg: "", waist_cm: "", arm_cm: "", chest_cm: "", shoulder_cm: "", leg_cm: "", photo_url: "" });
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Grafik */}
      <div className="card">
        <div className="mb-4 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                metric === m.key
                  ? "bg-brand text-black"
                  : "border border-ink-border bg-ink-soft text-fg-muted"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {chartData.length < 2 ? (
          <p className="py-12 text-center text-sm text-fg-muted">
            Grafik için en az 2 ölçüm gerekli. Ölçümlerini eklemeye devam et.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26262b" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1d",
                  border: "1px solid #26262b",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(v) => [`${v} ${active.unit}`, active.label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={active.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: active.color }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Yeni ölçüm */}
      <div className="card space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          <Ruler size={16} /> Yeni Ölçüm Ekle
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Kilo (kg)"
            value={form.weight_kg}
            onChange={(v) => setForm((f) => ({ ...f, weight_kg: v }))}
          />
          <Field
            label="Bel (cm)"
            value={form.waist_cm}
            onChange={(v) => setForm((f) => ({ ...f, waist_cm: v }))}
          />
          <Field
            label="Kol (cm)"
            value={form.arm_cm}
            onChange={(v) => setForm((f) => ({ ...f, arm_cm: v }))}
          />
          <Field
            label="Göğüs (cm)"
            value={form.chest_cm}
            onChange={(v) => setForm((f) => ({ ...f, chest_cm: v }))}
          />
          <Field
            label="Omuz (cm)"
            value={form.shoulder_cm}
            onChange={(v) => setForm((f) => ({ ...f, shoulder_cm: v }))}
          />
          <Field
            label="Bacak (cm)"
            value={form.leg_cm}
            onChange={(v) => setForm((f) => ({ ...f, leg_cm: v }))}
          />
        </div>
        <div>
          <label className="label">Fotoğraf URL (opsiyonel)</label>
          <input
            className="input"
            value={form.photo_url}
            onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          <Plus size={18} /> {saving ? "Kaydediliyor..." : "Ölçümü Kaydet"}
        </button>
      </div>

      {/* Geçmiş */}
      {measurements.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold">Ölçüm Geçmişi</h3>
          <div className="space-y-2">
            {[...measurements].reverse().slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="rounded-xl bg-ink-soft px-3 py-2.5 text-sm"
              >
                <p className="mb-1.5 text-xs font-medium text-fg-muted">
                  {formatShortDate(m.measured_on)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {m.weight_kg && <Chip>{m.weight_kg} kg</Chip>}
                  {m.waist_cm && <Chip>Bel {m.waist_cm}</Chip>}
                  {m.arm_cm && <Chip>Kol {m.arm_cm}</Chip>}
                  {m.chest_cm && <Chip>Göğüs {m.chest_cm}</Chip>}
                  {m.shoulder_cm && <Chip>Omuz {m.shoulder_cm}</Chip>}
                  {m.leg_cm && <Chip>Bacak {m.leg_cm}</Chip>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-ink-card px-2 py-1 text-xs font-medium text-fg">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}
