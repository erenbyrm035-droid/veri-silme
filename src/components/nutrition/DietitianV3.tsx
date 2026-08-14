"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Salad, Send, Sparkles, RefreshCw, Pencil, ChevronDown, Clock, ShoppingCart, Utensils, ArrowRight, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INTERVIEW_QUESTIONS,
  type InterviewQuestion, type DietPlan, type DietMeal,
} from "@/lib/nutrition/interview";
import {
  getDietitianState, answerQuestion, resetInterview, toggleShoppingItem,
  type ShoppingItem, type ShoppingListView,
} from "@/lib/nutrition/dietitian-v3-actions";

type Phase = "loading" | "interview" | "generate" | "plan";
type PlanWithId = DietPlan & { id: string };
interface LogMsg { role: "ai" | "user"; text: string }

const qById = (id: string | null) => INTERVIEW_QUESTIONS.find((q) => q.id === id) ?? null;

export function DietitianV3({ isPremium = false }: { isPremium?: boolean }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [answered, setAnswered] = useState(0);
  const [log, setLog] = useState<LogMsg[]>([]);
  const [plan, setPlan] = useState<PlanWithId | null>(null);
  // Alışveriş listesi artık plandan değil `shopping_lists`ten gelir (migration 0045).
  const [shopping, setShopping] = useState<ShoppingListView | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log, phase, busy]);

  const boot = useCallback(async () => {
    const res = await getDietitianState();
    if (!res.ok || !res.data) { setPhase("interview"); return; }
    const { nextId, answered: a, completed, plan: p } = res.data;
    setAnswered(a);
    if (p) setPlan(p as PlanWithId);
    setShopping(res.data.shopping ?? null);
    if (!completed && nextId) {
      const q = qById(nextId);
      setQuestion(q);
      setLog([
        { role: "ai", text: "Merhaba! Ben Viva diyetisyeninim 👋 Sana tamamen özel bir beslenme planı hazırlayacağım. Bunun için birkaç kısa soru soracağım — hazırsan başlayalım." },
        ...(q ? [{ role: "ai" as const, text: q.prompt }] : []),
      ]);
      setPhase("interview");
    } else if (p) {
      setPhase("plan");
    } else {
      setPhase("generate");
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  async function submit(value: string | number | string[]) {
    if (!question || busy) return;
    setBusy(true);
    const label = valueLabel(question, value);
    setLog((l) => [...l, { role: "user", text: label }]);
    const res = await answerQuestion(question.id, value);
    setBusy(false);
    if (!res.ok || !res.data) {
      setLog((l) => [...l, { role: "ai", text: "Bir sorun oldu, tekrar dener misin?" }]);
      return;
    }
    setAnswered(res.data.answered);
    if (res.data.completed || !res.data.nextId) {
      setQuestion(null);
      setLog((l) => [...l, { role: "ai", text: "Harika, seni tanıdım! 🙌 Şimdi verdiğin bilgilere göre seni analiz edip planını hazırlayacağım." }]);
      setPhase("generate");
      return;
    }
    const nq = qById(res.data.nextId);
    setQuestion(nq);
    if (nq) setLog((l) => [...l, { role: "ai", text: nq.prompt }]);
  }

  // -------- render --------
  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center py-16">
          <Sparkles className="animate-pulse text-brand" size={28} />
        </div>
      </Shell>
    );
  }

  if (phase === "interview") {
    return (
      <Shell progress={answered / INTERVIEW_QUESTIONS.length}>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {log.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
          {busy && <Bubble role="ai" text="" typing />}
          <div ref={endRef} />
        </div>
        {question && <QuestionInput key={question.id} q={question} onSubmit={submit} disabled={busy} />}
      </Shell>
    );
  }

  if (phase === "generate") {
    return <GenerateView isPremium={isPremium} onDone={(p) => {
      setPlan(p);
      setPhase("plan");
      // Alışveriş listesi plan kaydedilirken trigger ile üretilir; tazele.
      void getDietitianState().then((r) => {
        if (r.ok && r.data) setShopping(r.data.shopping ?? null);
      });
    }} onEdit={boot} />;
  }

  // plan
  return <PlanView plan={plan!} shopping={shopping} isPremium={isPremium} onNew={() => setPhase("generate")} onReset={boot} />;
}

// ===========================================================================
// Görüşme — soru giriş kontrolü
// ===========================================================================
function QuestionInput({ q, onSubmit, disabled }: { q: InterviewQuestion; onSubmit: (v: string | number | string[]) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);

  if (q.kind === "choice") {
    return (
      <div className="border-t border-ink-border p-3">
        {q.why && <p className="mb-2 px-1 text-[11px] text-fg-muted">💡 {q.why}</p>}
        <div className="grid gap-2">
          {q.options!.map((o) => (
            <button key={o.value} disabled={disabled} onClick={() => onSubmit(o.value)}
              className="rounded-xl border border-ink-border bg-ink-soft px-4 py-3 text-left text-sm font-medium transition-colors hover:border-brand/60 hover:bg-brand/5 disabled:opacity-50">
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.kind === "multi") {
    const toggle = (v: string) => setMulti((m) => m.includes(v) ? m.filter((x) => x !== v) : [...m, v]);
    return (
      <div className="border-t border-ink-border p-3">
        {q.why && <p className="mb-2 px-1 text-[11px] text-fg-muted">💡 {q.why}</p>}
        <div className="mb-3 flex flex-wrap gap-2">
          {q.options!.map((o) => (
            <button key={o.value} disabled={disabled} onClick={() => toggle(o.value)}
              className={cn("rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                multi.includes(o.value) ? "border-brand bg-brand text-black" : "border-ink-border bg-ink-soft text-fg-muted hover:text-fg")}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button disabled={disabled} onClick={() => onSubmit(multi)} className="btn-primary flex-1">Devam et</button>
          {q.optional && <button disabled={disabled} onClick={() => onSubmit([])} className="rounded-xl px-4 text-sm text-fg-muted hover:text-fg">Yok / geç</button>}
        </div>
      </div>
    );
  }

  // number / text
  const send = () => {
    const v = q.kind === "number" ? Number(text) : text.trim();
    if (q.kind === "number" && (!text || Number.isNaN(Number(text)))) return;
    onSubmit(v);
    setText("");
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-ink-border p-3">
      {q.why && <p className="mb-2 px-1 text-[11px] text-fg-muted">💡 {q.why}</p>}
      <div className="flex items-center gap-2">
        <input
          value={text} onChange={(e) => setText(e.target.value)} disabled={disabled}
          type={q.kind === "number" ? "number" : "text"} inputMode={q.kind === "number" ? "decimal" : "text"}
          placeholder={q.placeholder ?? "Yaz…"} className="input flex-1" autoFocus
        />
        {q.unit && <span className="shrink-0 text-sm text-fg-muted">{q.unit}</span>}
        <button type="submit" disabled={disabled || (q.kind === "number" ? !text : !text.trim())} className="btn-primary aspect-square w-11 !px-0">
          <Send size={18} />
        </button>
      </div>
      {q.optional && (
        <button type="button" disabled={disabled} onClick={() => onSubmit("")} className="mt-2 text-xs text-fg-muted hover:text-fg">
          Bu soruyu geç →
        </button>
      )}
    </form>
  );
}

function valueLabel(q: InterviewQuestion, value: string | number | string[]): string {
  if (Array.isArray(value)) {
    if (!value.length) return "Yok";
    return value.map((v) => q.options?.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  if (q.kind === "choice") return q.options?.find((o) => o.value === String(value))?.label ?? String(value);
  if (value === "" ) return "Geçtim";
  return `${value}${q.unit ? " " + q.unit : ""}`;
}

// ===========================================================================
// Analiz + plan üretimi
// ===========================================================================
function GenerateView({ onDone, onEdit, isPremium }: { onDone: (p: PlanWithId) => void; onEdit: () => void; isPremium: boolean }) {
  const [span, setSpan] = useState<7 | 14 | 30>(7);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/ai/dietitian/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", days: span }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || "Plan oluşturulamadı."); }
      else if (json.plan) { onDone(json.plan); }
    } catch { setErr("Bağlantı hatası. Tekrar dene."); }
    setLoading(false);
  }

  return (
    <Shell>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm leading-relaxed">
            Görüşmeyi tamamladık 🎉 Sana özel planı hazırlamaya hazırım. Kaç günlük plan istersin?
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([7, 14, 30] as const).map((s) => {
            const locked = !isPremium && s > 7;
            return (
              <button key={s} onClick={() => !locked && setSpan(s)} disabled={locked}
                className={cn("relative rounded-xl border py-3 text-sm font-bold transition-colors",
                  span === s ? "border-brand bg-brand text-black" : "border-ink-border bg-ink-soft text-fg-muted",
                  locked && "cursor-not-allowed opacity-60")}>
                {s} Gün
                {locked && <span className="absolute right-1.5 top-1.5 text-[10px]">🔒</span>}
              </button>
            );
          })}
        </div>
        {!isPremium && <p className="text-center text-[11px] text-fg-muted">Ücretsiz sürümde 7 günlük plan. 14 ve 30 günlük planlar Premium'a özel.</p>}
        <button onClick={go} disabled={loading} className="btn-primary w-full">
          {loading ? <span className="flex items-center justify-center gap-2"><Sparkles size={16} className="animate-pulse" /> Analiz ediliyor…</span> : `${span} günlük planımı oluştur`}
        </button>
        {loading && <p className="text-center text-xs text-fg-muted">Diyetisyenin seni analiz ediyor, öğünleri ve alışveriş listeni hazırlıyor. Bu 15-30 saniye sürebilir.</p>}
        {err && (
          <div className="space-y-2 rounded-xl bg-coral/10 px-4 py-3">
            <p className="text-sm text-coral">{err}</p>
            {err.includes("Premium") && <a href="/premium" className="btn-primary w-full">Premium'a Yükselt</a>}
          </div>
        )}
        <button onClick={onEdit} className="mx-auto flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg">
          <Pencil size={13} /> Bilgilerimi düzenle
        </button>
      </div>
    </Shell>
  );
}

// ===========================================================================
// Plan görünümü
// ===========================================================================
function PlanView({ plan, shopping, onNew, onReset, isPremium }: {
  plan: PlanWithId;
  /** Materyalize alışveriş listesi; plan üretildikten sonra dolar. */
  shopping: ShoppingListView | null;
  onNew: () => void; onReset: () => void; isPremium: boolean;
}) {
  const [days, setDays] = useState(plan.days);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<"plan" | "shopping">("plan");
  const [regen, setRegen] = useState<string | null>(null); // "day-slot"
  const [upsell, setUpsell] = useState(false);

  const greeting = dayGreeting();

  async function changeMeal(day: number, slot: string) {
    if (!isPremium) { setUpsell(true); return; }
    const key = `${day}-${slot}`;
    setRegen(key);
    try {
      const res = await fetch("/api/ai/dietitian/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "meal", planId: plan.id, day, slot }),
      });
      const json = await res.json();
      if (res.ok && json.meal) {
        setDays((ds) => ds.map((d) => d.day !== day ? d : { ...d, meals: d.meals.map((m) => m.slot === slot ? json.meal : m) }));
      }
    } catch { /* sessiz */ }
    setRegen(null);
  }

  const cur = days[active];

  return (
    <div className="space-y-4">
      {upsell && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-3.5">
          <p className="text-sm leading-relaxed">🔒 Öğün değiştirme Premium'a özel. Planındaki her öğünü sınırsız değiştirmek için Premium'a geç.</p>
          <a href="/premium" className="btn-primary shrink-0 !py-1.5 text-xs">Premium</a>
        </div>
      )}
      {greeting && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-ink-border bg-ink-card p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">{greeting.icon}</span>
          <p className="text-sm leading-relaxed">{greeting.text}</p>
        </div>
      )}

      {/* Analiz */}
      {plan.analysis && (
        <div className="rounded-2xl border border-brand/25 bg-brand/5 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand"><Sparkles size={13} /> Diyetisyen Analizi</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{plan.analysis}</p>
        </div>
      )}

      {/* Hedef makrolar */}
      <div className="grid grid-cols-4 gap-2">
        <Macro label="Kalori" value={plan.targets.calories} unit="kcal" />
        <Macro label="Protein" value={plan.targets.protein} unit="g" />
        <Macro label="Karb" value={plan.targets.carbs} unit="g" />
        <Macro label="Yağ" value={plan.targets.fat} unit="g" />
      </div>

      {/* Alt sekmeler */}
      <div className="flex gap-2">
        <button onClick={() => setTab("plan")} className={cn("flex-1 rounded-xl py-2.5 text-sm font-semibold", tab === "plan" ? "bg-brand text-black" : "bg-ink-soft text-fg-muted")}>
          <Utensils size={15} className="mr-1.5 inline" /> Öğün Planı
        </button>
        <button onClick={() => setTab("shopping")} className={cn("flex-1 rounded-xl py-2.5 text-sm font-semibold", tab === "shopping" ? "bg-brand text-black" : "bg-ink-soft text-fg-muted")}>
          <ShoppingCart size={15} className="mr-1.5 inline" /> Alışveriş
        </button>
      </div>

      {tab === "plan" ? (
        <>
          {/* Gün seçici */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <button key={d.day} onClick={() => setActive(i)}
                className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold", active === i ? "bg-brand text-black" : "bg-ink-soft text-fg-muted")}>
                {d.day}. Gün
              </button>
            ))}
          </div>
          {cur && <DayTotal meals={cur.meals} targets={plan.targets} />}
          <div className="space-y-3">
            {cur?.meals.map((m) => (
              <MealCard key={m.slot} meal={m} locked={!isPremium} regenerating={regen === `${cur.day}-${m.slot}`} onChange={() => changeMeal(cur.day, m.slot)} />
            ))}
          </div>
        </>
      ) : (
        <ShoppingList list={shopping} />
      )}

      {/* Aksiyonlar */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onNew} className="flex items-center gap-1.5 rounded-xl border border-ink-border bg-ink-soft px-4 py-2.5 text-sm font-semibold hover:border-brand/50">
          <RefreshCw size={14} /> Yeni plan oluştur
        </button>
        <button onClick={onReset} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm text-fg-muted hover:text-fg">
          <Pencil size={14} /> Bilgilerimi güncelle
        </button>
      </div>
      <ResetInterview onDone={onReset} />
    </div>
  );
}

function DayTotal({ meals, targets }: { meals: DietMeal[]; targets: DietPlan["targets"] }) {
  const sum = meals.reduce((a, m) => ({
    cal: a.cal + (m.calories || 0), p: a.p + (m.protein || 0), c: a.c + (m.carbs || 0), f: a.f + (m.fat || 0),
  }), { cal: 0, p: 0, c: 0, f: 0 });
  const rows: [string, number, number, string][] = [
    ["Kalori", sum.cal, targets.calories, "kcal"],
    ["Protein", sum.p, targets.protein, "g"],
    ["Karb", sum.c, targets.carbs, "g"],
    ["Yağ", sum.f, targets.fat, "g"],
  ];
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
      <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-fg-muted">Günlük Toplam · {meals.length} öğün</p>
      <div className="space-y-2">
        {rows.map(([label, got, goal, unit]) => {
          const pct = goal ? Math.min(100, Math.round((got / goal) * 100)) : 0;
          return (
            <div key={label}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="text-fg-muted">{label}</span>
                <span className="font-semibold"><b>{Math.round(got)}</b> / {Math.round(goal)} {unit}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MealCard({ meal, onChange, regenerating, locked }: { meal: DietMeal; onChange: () => void; regenerating: boolean; locked?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-2xl border border-ink-border bg-ink-card p-4 transition-opacity", regenerating && "opacity-50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{meal.slot}</p>
          <p className="mt-0.5 font-bold leading-snug">{meal.name}</p>
          {meal.grams && <p className="mt-0.5 text-xs text-fg-muted">{meal.grams}</p>}
        </div>
        <button onClick={onChange} disabled={regenerating} title={locked ? "Öğün değiştirme Premium'a özel" : "Bu öğünü değiştir"}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink-border bg-ink-soft text-fg-muted transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-50">
          <RefreshCw size={15} className={cn(regenerating && "animate-spin")} />
          {locked && <span className="absolute -right-1 -top-1 text-[9px]">🔒</span>}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span><b>{Math.round(meal.calories)}</b> kcal</span>
        <span className="text-fg-muted">P: <b className="text-fg">{Math.round(meal.protein)}g</b></span>
        <span className="text-fg-muted">K: <b className="text-fg">{Math.round(meal.carbs)}g</b></span>
        <span className="text-fg-muted">Y: <b className="text-fg">{Math.round(meal.fat)}g</b></span>
        {meal.prep_min > 0 && <span className="flex items-center gap-1 text-fg-muted"><Clock size={12} /> {meal.prep_min} dk</span>}
      </div>

      {(meal.recipe || (meal.alternatives?.length ?? 0) > 0) && (
        <button onClick={() => setOpen((o) => !o)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand">
          Tarif & alternatifler <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      )}
      {open && (
        <div className="mt-2 space-y-2 border-t border-ink-border pt-2.5">
          {meal.recipe && <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{meal.recipe}</p>}
          {(meal.alternatives?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">Alternatifler</p>
              <ul className="mt-1 space-y-0.5">
                {meal.alternatives.map((a, i) => (
                  <li key={i} className="flex gap-1.5 text-sm"><ArrowRight size={14} className="mt-0.5 shrink-0 text-brand" /> {a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShoppingList({ list }: { list: ShoppingListView | null }) {
  // İşaretler sunucuda tutulur (`shopping_lists.items[].checked`) — telefonda
  // işaretleyip markette masaüstünden bakınca da doğru görünsün diye.
  // Yanıt beklenmeden UI güncellenir, hata olursa geri alınır.
  const [items, setItems] = useState(list?.items ?? []);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => { setItems(list?.items ?? []); }, [list]);

  async function toggle(index: number) {
    if (!list || busy !== null) return;
    const next = !items[index].checked;
    setBusy(index);
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, checked: next } : it)));
    const res = await toggleShoppingItem(list.id, index, next);
    setBusy(null);
    if (!res.ok) {
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, checked: !next } : it)));
    }
  }

  if (!list || items.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-muted">Alışveriş listesi bulunamadı.</p>;
  }

  // Kategoriye göre grupla (sıra korunur).
  const groups: { category: string; entries: { item: ShoppingItem; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const cat = item.category || "Diğer";
    let g = groups.find((x) => x.category === cat);
    if (!g) { g = { category: cat, entries: [] }; groups.push(g); }
    g.entries.push({ item, index });
  });

  const done = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-ink-border bg-ink-card px-3.5 py-2.5">
        <p className="text-xs font-semibold text-fg-muted">
          <span className="text-brand">{done}</span> / {items.length} kalem alındı
        </p>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-soft">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${Math.round((done / items.length) * 100)}%` }}
          />
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.category} className="rounded-2xl border border-ink-border bg-ink-card p-4">
          <p className="mb-2 text-sm font-bold text-brand">{g.category}</p>
          <ul className="space-y-1.5">
            {g.entries.map(({ item, index }) => (
              <li key={`${g.category}-${index}`}>
                <button
                  onClick={() => toggle(index)}
                  disabled={busy === index}
                  aria-pressed={item.checked}
                  className="flex w-full items-center gap-2.5 text-left text-sm disabled:opacity-60"
                >
                  <span className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                    item.checked ? "border-brand bg-brand text-black" : "border-ink-border"
                  )}>
                    {item.checked && "✓"}
                  </span>
                  <span className={cn(item.checked && "text-fg-muted line-through")}>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ResetInterview({ onDone }: { onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!confirming) {
    return <button onClick={() => setConfirming(true)} className="text-xs text-fg-muted/70 hover:text-coral">Görüşmeyi baştan başlat</button>;
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-fg-muted">Tüm cevaplar silinsin mi?</span>
      <button disabled={loading} onClick={async () => { setLoading(true); await resetInterview(); onDone(); }} className="font-semibold text-coral">Evet, sıfırla</button>
      <button onClick={() => setConfirming(false)} className="text-fg-muted">Vazgeç</button>
    </div>
  );
}

// ===========================================================================
// Ortak parçalar
// ===========================================================================
function Shell({ children, progress }: { children: React.ReactNode; progress?: number }) {
  return (
    <div className="flex h-[calc(100dvh-17.5rem)] max-h-[720px] min-h-[360px] flex-col overflow-hidden rounded-2xl border border-ink-border bg-ink-card md:h-[calc(100dvh-13rem)]">
      <div className="border-b border-ink-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><Salad size={19} /></span>
          <div className="min-w-0">
            <p className="text-sm font-bold">AI Diyetisyen</p>
            <p className="truncate text-[11px] text-fg-muted">Seninle görüşüp sana özel plan hazırlar</p>
          </div>
        </div>
        {progress != null && (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-soft">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Bubble({ role, text, typing }: { role: "ai" | "user"; text: string; typing?: boolean }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
        role === "user" ? "bg-brand text-black" : "border border-ink-border bg-ink-soft text-fg"
      )}>
        {typing ? <span className="flex gap-1 py-0.5"><Dot /><Dot d="150ms" /><Dot d="300ms" /></span> : text}
      </div>
    </div>
  );
}

function Macro({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-card p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{Math.round(value || 0)}</p>
      <p className="text-[9px] text-fg-muted">{unit}</p>
    </div>
  );
}

function Dot({ d = "0ms" }: { d?: string }) {
  return <span className="h-2 w-2 animate-bounce rounded-full bg-fg/40" style={{ animationDelay: d }} />;
}

function dayGreeting(): { icon: React.ReactNode; text: string } | null {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { icon: <Sun size={17} />, text: "Günaydın! Bugünkü beslenme planına hazır mısın? Aşağıda günün öğünleri seni bekliyor." };
  if (h >= 18 && h < 24) return { icon: <Moon size={17} />, text: "İyi akşamlar! Bugünkü öğünlerini değerlendirelim — planına ne kadar uydun?" };
  return null;
}
