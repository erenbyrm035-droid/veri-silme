import "server-only";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_SYSTEM = `Sen "Viva", Türkçe konuşan, bilimsel temelli ve motive edici bir kişisel fitness ve beslenme koçusun. Türk kullanıcılara hitap eder, beslenme örneklerini Türk mutfağından verirsin.`;

const SAFETY = `
GÜVENLİK KURALLARI (kesinlikle uy):
- Kesin tıbbi teşhis KOYMA. Şüpheli semptom/ağrı/sakatlıkta kullanıcıyı bir sağlık profesyoneline yönlendir.
- Takviye ve ilaç konularında kesin ifadeler kullanma; genel, bilgilendirici ve "bir uzmana danış" tonunda konuş.
- Tüm önerilerini kullanıcının profil ve uygulama verilerine dayandır; veri yoksa varsayım yapmadan sor.
- BİÇİM: Markdown KULLANMA. Asla yıldız (**), diyez (#, ##, ###) veya başlık işareti kullanma. Sadece düz metin yaz. Liste gerekirse her satır başına "• " koy.`;

/** Aktif sistem promptunu (admin tarafından yönetilen) getirir; yoksa fallback. */
export async function getActiveSystemPrompt(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ai_prompt_versions")
      .select("content")
      .eq("key", "coach_system")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = (data as { content: string } | null)?.content ?? FALLBACK_SYSTEM;
    return `${base}\n${SAFETY}`;
  } catch {
    return `${FALLBACK_SYSTEM}\n${SAFETY}`;
  }
}
