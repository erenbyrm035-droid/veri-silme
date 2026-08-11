// AI motivasyon mesajları — kullanıcının oyunlaştırma durumuna göre kişisel,
// deterministik öneriler üretir (AI koç bu bağlamı zenginleştirebilir).
import type { GamificationOverview, ChallengeView } from "./queries";

export interface MotivationMessage { tone: "celebrate" | "nudge" | "streak" | "goal"; text: string; }

export function buildMotivation(o: GamificationOverview, challenges: ChallengeView[], leaderboardRank?: number | null): MotivationMessage[] {
  const msgs: MotivationMessage[] = [];
  const s = o.stats;

  if (o.sync.leveled_up) {
    msgs.push({ tone: "celebrate", text: `🎉 Tebrikler! ${o.currentLevel?.title ?? `Seviye ${s.level}`} oldun. Momentum harika!` });
  }
  if (s.current_streak >= 3) {
    msgs.push({ tone: "streak", text: `🔥 ${s.current_streak} günlük serideysin — bugünü de tamamla, seriyi bozma!` });
  } else if (s.longest_streak > 0 && s.current_streak === 0) {
    msgs.push({ tone: "streak", text: `Serin sıfırlandı ama en uzun serin ${s.longest_streak} gündü. Bugün yeniden başla!` });
  }
  if (leaderboardRank && leaderboardRank > 1 && leaderboardRank <= 120) {
    msgs.push({ tone: "goal", text: `Liderlik tablosunda ${leaderboardRank}. sıradasın. Bugün biraz XP ile ilk 100'e girebilirsin!` });
  }
  const nextLevel = o.nextLevel;
  if (nextLevel) {
    const need = nextLevel.min_xp - s.total_xp;
    if (need > 0 && need <= 250) msgs.push({ tone: "goal", text: `${nextLevel.title} seviyesine sadece ${need} XP kaldı. Bir antrenman yeter!` });
  }
  const openChallenge = challenges.find((c) => !c.completed);
  if (openChallenge) {
    const remaining = Math.max(0, Number(openChallenge.target) - openChallenge.progress);
    msgs.push({ tone: "nudge", text: `Haftalık görev "${openChallenge.title}" için ${remaining} kaldı. Tamamlayınca +${openChallenge.xp_reward} XP!` });
  }
  if (s.fitness_score >= 80) {
    msgs.push({ tone: "celebrate", text: `Fitness skorun ${s.fitness_score}/100 — muhteşem bir formdasın. Böyle devam!` });
  } else if (s.fitness_score < 40) {
    msgs.push({ tone: "nudge", text: `Fitness skorun ${s.fitness_score}/100. Su ve protein hedeflerini tutturmak skoru hızla yükseltir.` });
  }

  if (msgs.length === 0) {
    msgs.push({ tone: "nudge", text: "Bugün küçük bir adım at — bir antrenman, bir bardak su. Her hareket seni ileri taşır 💪" });
  }
  return msgs.slice(0, 3);
}
