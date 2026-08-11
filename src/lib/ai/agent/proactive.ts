import type { AgentSnapshot } from "./context";
import type { ProactiveNudge, GoalProgress } from "./types";

// ============================================================================
// PROAKTİF AI — koç beklemez, kendi söyler.
//
// TASARIM KARARI: Bu uyarılar DETERMİNİSTİK. Dil modeline sorulmuyor.
//
// Neden: "Protein hedefinden 40 gram uzaktasın" bir yorum değil, bir çıkarma
// işlemi. Bunu modele sordurmak üç şeyi birden kaybettirirdi:
//   - Doğruluk: model 40'ı 45 yazabilir.
//   - Maliyet: her sayfa açılışında bir AI çağrısı.
//   - Hız: kart, veri gelir gelmez çizilir; model beklenmez.
// Model, kullanıcı SORDUĞUNDA devreye giriyor; sayı üretmek onun işi değil.
//
// SUSMAYI BİLMEK: Her kural her gün tetiklenirse uygulama dırdırcı olur.
// Bu yüzden eşikler bilinçli olarak yüksek (3 gün üst üste, %20 sapma…) ve
// `priority` ile en fazla birkaç tanesi gösteriliyor.
// ============================================================================

const num = (v: unknown, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** `recovery_score`/`readiness_score` bileşik döndüğü için ikisini de destekler. */
const scoreOf = (v: unknown): number | null =>
  v && typeof v === "object" ? (Number.isFinite(Number(obj(v).score)) ? Number(obj(v).score) : null)
    : Number.isFinite(Number(v)) ? Number(v) : null;

/**
 * Anlık görüntüden proaktif uyarılar üretir.
 *
 * Saf fonksiyon — ağ yok, yan etki yok, test edilebilir.
 */
export function buildNudges(snap: AgentSnapshot | null, now = new Date()): ProactiveNudge[] {
  if (!snap) return [];
  const p = obj(snap.profile);
  if (p.ai_consent === false) return []; // onay yoksa kişisel uyarı da yok

  const t = obj(snap.today);
  const g = obj(snap.gamification);
  const nut = obj(snap.nutrition_7d);
  const social = obj(snap.social);
  const team = snap.team ? obj(snap.team) : null;
  const workouts = arr(snap.recent_workouts).map(obj);
  const goals = (snap.goals ?? []) as GoalProgress[];
  const out: ProactiveNudge[] = [];

  const hour = Number(
    now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" })
  );
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

  // --- 1. Toparlanma düşük → yoğunluğu azalt (en yüksek öncelik: sağlık) ---
  const recovery = scoreOf(t.recovery);
  if (recovery !== null && recovery < 40) {
    out.push({
      id: "recovery_low",
      tone: "alert",
      priority: 95,
      text: `Toparlanma skorun ${recovery}/100 — vücudun yorgun. Bugün ağır çalışma; hafif bir seans ya da dinlenme günü daha doğru.`,
      href: "/coach",
      cta: "Koça sor",
    });
  }

  // --- 2. Hedeften sapma ---
  for (const goal of goals) {
    if (!goal.on_track && goal.progress_pct !== null && goal.time_pct !== null) {
      const gap = Math.round(goal.time_pct - goal.progress_pct);
      out.push({
        id: `goal_off_${goal.id}`,
        tone: "warning",
        priority: 90,
        text:
          `"${goal.title}" hedefinde gerideysin: sürenin %${goal.time_pct}'i geçti ama ilerleme %${goal.progress_pct}. ` +
          `Aradaki fark ${gap} puan${goal.days_left !== null ? `, ${goal.days_left} gün kaldı` : ""}.`,
        href: "/coach",
        cta: "Planı gözden geçir",
      });
    }
  }

  // --- 3. Dün antrenman kaçırıldı / uzun aradır yok ---
  const lastCompleted = workouts.find((w) => w.status === "completed");
  if (lastCompleted?.date) {
    const days = Math.floor(
      (Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${String(lastCompleted.date)}T00:00:00Z`)) / 86_400_000
    );
    if (days >= 3) {
      out.push({
        id: "workout_gap",
        tone: days >= 7 ? "alert" : "warning",
        priority: days >= 7 ? 88 : 70,
        text:
          days >= 7
            ? `Son antrenmanının üzerinden ${days} gün geçti. Geri dönmek için bugün 20 dakikalık hafif bir seans bile yeter.`
            : `${days} gündür antrenman yapmadın. Serini kaybetmeden bugün kısa bir seans sıkıştırabilirsin.`,
        href: "/workout",
        cta: "Antrenmana başla",
      });
    }
  } else if (workouts.length === 0) {
    out.push({
      id: "no_workout_yet",
      tone: "info",
      priority: 60,
      text: "Henüz kayıtlı antrenmanın yok. İlk antrenmanını kaydettiğinde koçun sana özel öneri vermeye başlar.",
      href: "/workout",
      cta: "İlk antrenmanı ekle",
    });
  }

  // --- 4. Bugün planlı antrenman var ama yapılmadı (akşama doğru hatırlat) ---
  if (t.workout_planned && !t.workout_done && hour >= 17) {
    out.push({
      id: "workout_pending_today",
      tone: "warning",
      priority: 80,
      text: `Bugün planladığın antrenman${t.workout_title ? ` ("${t.workout_title}")` : ""} hâlâ bekliyor. Gün bitmeden yapabilirsin.`,
      href: "/workout",
      cta: "Şimdi başla",
    });
  }

  // --- 5. Protein hedefinden uzak (akşam saatlerinde anlamlı) ---
  const protein = num(t.protein_g);
  const proteinGoal = num(t.protein_goal);
  if (proteinGoal > 0 && hour >= 16) {
    const gap = Math.round(proteinGoal - protein);
    if (gap >= 25) {
      out.push({
        id: "protein_gap",
        tone: "warning",
        priority: 72,
        text: `Protein hedefinden ${gap} gram uzaktasın (${Math.round(protein)}/${proteinGoal} g). Akşam öğününde yoğurt, tavuk ya da peynir bu farkı kapatır.`,
        href: "/nutrition",
        cta: "Öğün ekle",
      });
    }
  }

  // --- 6. Su hedefinden uzak ---
  const water = num(t.water_ml);
  const waterGoal = num(t.water_goal);
  if (waterGoal > 0 && hour >= 15) {
    const gap = waterGoal - water;
    if (gap >= 800) {
      out.push({
        id: "water_gap",
        tone: "info",
        priority: 55,
        text: `Bugün ${water} ml su içtin, hedefin ${waterGoal} ml. ${Math.round(gap / 250)} bardak daha gerekiyor.`,
        href: "/dashboard",
        cta: "Su ekle",
      });
    }
  }

  // --- 7. Beslenme kaydı hiç yok ---
  if (num(nut.logged_days) === 0) {
    out.push({
      id: "no_nutrition_log",
      tone: "info",
      priority: 50,
      text: "Son 7 günde hiç öğün kaydetmemişsin. Birkaç gün kaydedersen koçun beslenmen hakkında gerçek veriye dayanarak konuşabilir.",
      href: "/nutrition",
      cta: "Öğün kaydet",
    });
  }

  // --- 8. Seri riski — bugün hiçbir görev tamamlanmadı, gün bitiyor ---
  const streak = num(g.current_streak);
  if (streak >= 3 && num(t.done_count) === 0 && hour >= 19) {
    out.push({
      id: "streak_at_risk",
      tone: "alert",
      priority: 85,
      text: `${streak} günlük serin risk altında — bugün hiçbir görevi tamamlamadın. Su hedefini tutturmak bile seriyi kurtarır.`,
      href: "/dashboard",
      cta: "Görevlere bak",
    });
  }

  // --- 9. Takımda geride kalma ---
  if (team && num(team.active_battles) > 0) {
    out.push({
      id: "team_battle_active",
      tone: "info",
      priority: 65,
      text: `Takımının aktif bir savaşı var. Bugün yapacağın her antrenman takımın skoruna yazılıyor.`,
      href: "/teams",
      cta: "Savaşa bak",
    });
  }

  // --- 10. Bekleyen arkadaşlık isteği ---
  if (num(social.pending_requests) > 0) {
    out.push({
      id: "friend_requests",
      tone: "info",
      priority: 40,
      text: `${num(social.pending_requests)} arkadaşlık isteğin bekliyor.`,
      href: "/feed",
      cta: "Görüntüle",
    });
  }

  // --- 11. Kutlama: seri kilometre taşı ---
  if ([7, 14, 30, 50, 100, 180, 365].includes(streak)) {
    out.push({
      id: `streak_${streak}`,
      tone: "celebrate",
      priority: 92,
      text: `${streak} günlük kesintisiz seri! Bu, çoğu insanın ulaşamadığı bir istikrar. 🔥`,
      href: "/gamification",
      cta: "Rozetlere bak",
    });
  }

  // --- 12. Battle Pass kademesi yakın ---
  const season = obj(snap.season);
  if (season.active && num(season.next_req_xp) > 0 && num(season.next_req_xp) <= 150) {
    out.push({
      id: "season_tier_close",
      tone: "info",
      priority: 58,
      text: `Battle Pass'te sonraki kademeye sadece ${num(season.next_req_xp)} XP kaldı — bir antrenman yeter.`,
      href: "/gamification",
      cta: "Battle Pass",
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

/** En önemli birkaç uyarı — dırdır etmemek için varsayılan 3. */
export function topNudges(snap: AgentSnapshot | null, limit = 3, now = new Date()): ProactiveNudge[] {
  return buildNudges(snap, now).slice(0, limit);
}

/** Uyarıları koçun sistem promptuna eklenecek bloğa çevirir. */
export function nudgesToPrompt(nudges: ProactiveNudge[]): string {
  if (nudges.length === 0) return "";
  return (
    "\n\nŞU AN DİKKAT ÇEKMESİ GEREKENLER (uygulama verisinden hesaplandı):\n" +
    nudges.map((n) => `- ${n.text}`).join("\n") +
    "\nUygun düşerse bunlardan birine doğal biçimde değin; hepsini birden sıralama."
  );
}
