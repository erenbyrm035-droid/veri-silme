import type { Goal } from "./database.types";

const MESSAGES: Record<Goal, string[]> = {
  lose_weight: [
    "Küçük açık, büyük sonuç. Bugün bir adım daha at! 🔥",
    "Terazi bir günün değil, alışkanlıkların aynasıdır.",
    "Su iç, protein al, hareket et — gerisi zamanla gelir. 💧",
  ],
  gain_muscle: [
    "Kaslar mutfakta yapılır, salonda şekillenir. 💪",
    "Bugünkü ekstra tekrar, yarınki gücün.",
    "Yeterli protein + uyku = gerçek gelişim. 🛌",
  ],
  get_fit: [
    "Fit görünüm tutarlılığın ödülüdür. ✨",
    "En iyi antrenman, yaptığın antrenmandır.",
    "Bugün kendine 30 dakika ayır, yarın teşekkür edersin.",
  ],
  improve_endurance: [
    "Nefesin uzadıkça sınırların genişler. 🏃",
    "Bugün biraz daha, yarın çok daha uzağa.",
    "Kondisyon sabırla örülür — devam et!",
  ],
  gain_strength: [
    "Güç, sabırla eklenen her kilonun toplamıdır. 🏋️",
    "Bugün 1 tekrar daha, yarın 1 kilo daha.",
    "Teknik önce, ağırlık sonra — güç böyle gelir.",
  ],
};

/** Hedefe ve güne göre değişen motivasyon mesajı. */
export function getDailyMotivation(goal: Goal | null): string {
  const list = MESSAGES[goal ?? "get_fit"];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return list[dayOfYear % list.length];
}

interface SuggestionInput {
  hasWorkoutToday: boolean;
  workoutCompleted: boolean;
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  waterMl: number;
  waterGoalMl: number;
}

/** Günün verisinden bağlamsal, uygulanabilir tek bir öneri üretir. */
export function buildDashboardSuggestion(i: SuggestionInput): {
  title: string;
  body: string;
  href: string;
} {
  if (!i.hasWorkoutToday) {
    return {
      title: "Bugün henüz antrenman yok",
      body: "15 dakikan varsa bile küçük bir seans farkı yaratır. Hadi başlayalım!",
      href: "/workouts/new",
    };
  }
  if (i.hasWorkoutToday && !i.workoutCompleted) {
    return {
      title: "Antrenmanın yarım kaldı",
      body: "Kaldığın yerden devam et ve seansı tamamla. 💪",
      href: "/workouts",
    };
  }
  if (i.protein < i.proteinGoal * 0.6) {
    return {
      title: "Protein hedefin geride",
      body: `Bugün ${Math.round(i.protein)}/${i.proteinGoal} g. Bir öğün daha protein ekle.`,
      href: "/nutrition",
    };
  }
  if (i.waterMl < i.waterGoalMl * 0.5) {
    return {
      title: "Su tüketimini artır",
      body: "Hedefin yarısına henüz ulaşmadın. Bir bardak su iyi gelir. 💧",
      href: "/nutrition",
    };
  }
  return {
    title: "Harika gidiyorsun! ✨",
    body: "Hedeflerine bugün de yaklaştın. AI koçundan bir sonraki adımını sor.",
    href: "/coach",
  };
}
