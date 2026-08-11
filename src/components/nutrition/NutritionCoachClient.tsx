"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MacroTargetsCard } from "./MacroTargetsCard";
import { MealPlanView } from "./MealPlanView";
import { ShoppingListView } from "./ShoppingListView";
import { RecipeAssistant } from "./RecipeAssistant";
import { WeeklyReportView } from "./WeeklyReportView";
import { SupplementsInfo } from "./SupplementsInfo";
import { FoodScanTools } from "./FoodScanTools";
import { NutritionDisclaimer } from "./NutritionDisclaimer";
import { NutritionScoreCard } from "./NutritionScoreCard";
import { MealAnalyzer } from "./MealAnalyzer";
import { PantryChef } from "./PantryChef";
import { DietitianV3 } from "./DietitianV3";
import { DietitianChat } from "@/components/nutrition/DietitianChat";
import { MealBuilder } from "./MealBuilder";
import { RestaurantMode } from "./RestaurantMode";
import { MealPlannerPro } from "./MealPlannerPro";
import { DailyAnalysis } from "./DailyAnalysis";
import { SupplementAI } from "./SupplementAI";
import type {
  MacroTargets,
  MealPlan,
  ShoppingList,
  NutritionReport,
} from "@/lib/database.types";

type Tab = "dietitian" | "chat" | "daily" | "score" | "builder" | "analyze" | "restaurant" | "targets" | "planner" | "plan" | "shopping" | "pantry" | "recipe" | "report" | "supplements" | "supplementai" | "scan";

const TABS: { id: Tab; label: string }[] = [
  { id: "dietitian", label: "AI Diyetisyen" },
  { id: "chat", label: "Diyetisyene Sor" },
  { id: "daily", label: "Günlük Analiz" },
  { id: "score", label: "Skor" },
  { id: "builder", label: "Yemek Oluştur" },
  { id: "analyze", label: "Akıllı Analiz" },
  { id: "restaurant", label: "Restoran" },
  { id: "planner", label: "Plan (7/14/30)" },
  { id: "targets", label: "Hedefler" },
  { id: "plan", label: "Öğün Planı" },
  { id: "shopping", label: "Alışveriş" },
  { id: "pantry", label: "Dolabım" },
  { id: "recipe", label: "Tarif" },
  { id: "report", label: "Haftalık Rapor" },
  { id: "supplementai", label: "Supplement AI" },
  { id: "supplements", label: "Takviye" },
  { id: "scan", label: "Barkod & Foto" },
];

export interface NutritionScoreInit { score: number; comment: string; breakdown: Record<string, number> }

export function NutritionCoachClient({
  userId,
  targets,
  initialPlan,
  initialShopping,
  initialReport,
  nutritionScore,
  isPremium = false,
}: {
  userId: string;
  targets: MacroTargets;
  initialPlan: MealPlan | null;
  initialShopping: ShoppingList | null;
  initialReport: NutritionReport | null;
  nutritionScore: NutritionScoreInit;
  isPremium?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("dietitian");
  const [plan, setPlan] = useState<MealPlan | null>(initialPlan);
  const [shopping, setShopping] = useState<ShoppingList | null>(initialShopping);
  const [report, setReport] = useState<NutritionReport | null>(initialReport);
  const [genPlan, setGenPlan] = useState(false);
  const [genReport, setGenReport] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  async function generatePlan() {
    setGenPlan(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/ai/nutrition-plan", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setPlanError(json.error || "Plan oluşturulamadı."); }
      else {
        if (json.plan) setPlan(json.plan);
        if (json.shopping) setShopping(json.shopping);
      }
    } catch {
      setPlanError("Plan oluşturulamadı. Lütfen tekrar dene.");
    }
    setGenPlan(false);
  }

  async function generateReport() {
    setGenReport(true);
    try {
      const res = await fetch("/api/ai/nutrition-report", { method: "POST" });
      const json = await res.json();
      if (json.report) setReport(json.report);
    } catch {
      /* sessiz */
    }
    setGenReport(false);
  }

  return (
    <div className="space-y-5">
      {/* Sekme çubuğu — mobilde yatay kaydırma, temiz (çubuksuz), snap + aktif ortala */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => { if (tab === t.id && el) el.scrollIntoView({ inline: "center", block: "nearest" }); }}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 snap-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.id
                ? "bg-brand text-black"
                : "bg-ink-soft text-fg-muted hover:text-fg"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dietitian" && <DietitianV3 isPremium={isPremium} />}
      {tab === "chat" && <DietitianChat />}
      {tab === "daily" && <DailyAnalysis />}
      {tab === "builder" && <MealBuilder />}
      {tab === "restaurant" && <RestaurantMode />}
      {tab === "planner" && <MealPlannerPro />}
      {tab === "supplementai" && <SupplementAI />}
      {tab === "score" && (
        <NutritionScoreCard initialScore={nutritionScore.score} initialComment={nutritionScore.comment} initialBreakdown={nutritionScore.breakdown} />
      )}
      {tab === "analyze" && <MealAnalyzer />}
      {tab === "targets" && (
        <div className="space-y-4">
          <MacroTargetsCard targets={targets} />
          <NutritionDisclaimer />
        </div>
      )}
      {tab === "plan" && (
        <div className="space-y-3">
          <MealPlanView plan={plan} onGenerate={generatePlan} generating={genPlan} />
          {planError && (
            <div className="space-y-2 rounded-xl bg-coral/10 px-4 py-3">
              <p className="text-sm text-coral">{planError}</p>
              {planError.includes("Premium") && (
                <a href="/premium" className="btn-primary w-full">Premium'a Yükselt</a>
              )}
            </div>
          )}
        </div>
      )}
      {tab === "shopping" && <ShoppingListView list={shopping} />}
      {tab === "pantry" && <PantryChef />}
      {tab === "recipe" && <RecipeAssistant />}
      {tab === "report" && (
        <WeeklyReportView report={report} onGenerate={generateReport} generating={genReport} />
      )}
      {tab === "supplements" && <SupplementsInfo />}
      {tab === "scan" && <FoodScanTools userId={userId} />}
    </div>
  );
}
