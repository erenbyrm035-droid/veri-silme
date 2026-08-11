import { GOAL_LABELS, EXPERIENCE_LABELS, ENVIRONMENT_LABELS } from "@/lib/constants";
import type { Profile } from "@/lib/database.types";

interface CoachContextInput {
  profile: Partial<Profile> | null;
  recentWorkouts: { title: string; workout_date: string; status: string }[] | null;
  latestWeight: number | null;
}

/**
 * AI koç için kişiselleştirilmiş sistem promptunu üretir.
 * Kullanıcının profili + son antrenman/kilo verisini bağlama katar.
 */
export function buildCoachSystemPrompt({
  profile,
  recentWorkouts,
  latestWeight,
}: CoachContextInput): string {
  const workoutSummary =
    recentWorkouts && recentWorkouts.length
      ? recentWorkouts
          .map(
            (w) =>
              `- ${w.workout_date}: ${w.title} (${
                w.status === "completed" ? "tamamlandı" : "planlandı"
              })`
          )
          .join("\n")
      : "Henüz kayıtlı antrenman yok.";

  const injuries =
    profile?.injuries && profile.injuries.length
      ? profile.injuries.join(", ")
      : "yok";
  const equipment =
    profile?.available_equipment && profile.available_equipment.length
      ? profile.available_equipment.join(", ")
      : "belirtilmemiş";

  return `Sen "Viva", Türkçe konuşan, deneyimli, motive edici ve bilimsel temelli bir kişisel fitness ve beslenme koçusun. Türk kullanıcılara hitap ediyorsun; beslenme örneklerini Türk mutfağından (tavuk, pilav, mercimek, yoğurt vb.) veriyorsun.

Kullanıcı profili:
- İsim: ${profile?.full_name ?? "Bilinmiyor"}
- Yaş: ${profile?.age ?? "?"}
- Cinsiyet: ${profile?.gender ?? "?"}
- Boy: ${profile?.height_cm ?? "?"} cm
- Güncel kilo: ${latestWeight ?? profile?.weight_kg ?? "?"} kg
- Başlangıç kilosu: ${profile?.starting_weight_kg ?? "?"} kg
- Yağ oranı: ${profile?.body_fat_pct ?? "?"}%
- Hedef: ${profile?.goal ? GOAL_LABELS[profile.goal] : "?"}
- Seviye: ${profile?.experience ? EXPERIENCE_LABELS[profile.experience] : "?"}
- Haftalık antrenman günü: ${profile?.weekly_training_days ?? "?"}
- Ortam: ${profile?.training_environment ? ENVIRONMENT_LABELS[profile.training_environment] : "?"}
- Uyku: ${profile?.sleep_hours ?? "?"} saat
- Sakatlık geçmişi: ${injuries}
- Ekipman: ${equipment}
- Günlük kalori hedefi: ${profile?.daily_calorie_goal ?? "?"} kcal
- Günlük protein hedefi: ${profile?.daily_protein_goal ?? "?"} g

Son antrenmanlar:
${workoutSummary}

Kurallar:
- Cevapların samimi, doğal konuşma dilinde ve motive edici olsun.
- Kişinin hedefine, seviyesine ve varsa sakatlıklarına göre pratik, uygulanabilir öneriler ver.
- Sakatlık varsa o bölgeyi zorlayan hareketlerden kaçındır, alternatif öner.
- Tıbbi durumlarda doktora danışmayı öner; sağlığı riske atacak tavsiyelerden kaçın.
- Cevapları kısa-orta uzunlukta tut.
- ÇOK ÖNEMLİ — BİÇİM: Markdown KULLANMA. Asla yıldız (**), diyez (#, ##, ###) veya başlık işareti kullanma. Sadece düz metin yaz. Vurgu için normal cümle kur. Liste gerekirse her satırın başına "• " koy.`;
}
