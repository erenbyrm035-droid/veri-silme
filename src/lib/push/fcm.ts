// Push bildirim soyutlaması — Firebase Cloud Messaging (FCM) için hazırlık.
// Cihaz token'ları `push_tokens` tablosunda tutulur. Gönderim, FCM_SERVER_KEY
// (veya service account) tanımlıysa gerçekleşir; değilse no-op (uygulama bildirimi
// yine notifications tablosuna yazılır). Yeni özellik değil — üretim iskeleti.
import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import type { PushCategory } from "./categories";

export type { PushCategory } from "./categories";
export { PUSH_CATEGORY_LABELS } from "./categories";

export interface PushMessage {
  userId: string;
  category: PushCategory;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export function isFcmConfigured(): boolean {
  return !!(process.env.FCM_SERVER_KEY || process.env.FCM_SERVICE_ACCOUNT_JSON);
}

/**
 * Bir kullanıcıya push gönderir. Her durumda in-app notification yazar;
 * FCM yapılandırılmışsa cihaz token'larına da iletir. Asla throw etmez.
 */
export async function sendPush(msg: PushMessage): Promise<{ inApp: boolean; pushed: number }> {
  const supabase = createAdminClient();
  let inApp = false;
  let pushed = 0;

  // 1) In-app notification (mevcut sistem) — kullanıcı kategori tercihine saygı
  try {
    const { data: settings } = await supabase
      .from("user_settings").select("notif_prefs").eq("user_id", msg.userId).maybeSingle();
    const prefs = (settings?.notif_prefs ?? {}) as Record<string, boolean>;
    if (prefs[msg.category] !== false) {
      await supabase.from("notifications").insert({
        user_id: msg.userId, type: msg.category, title: msg.title, body: msg.body,
      });
      inApp = true;
    }
  } catch (err) {
    await reportError(err, { where: "push/sendPush:inApp", severity: "warning" });
  }

  // 2) FCM (yapılandırılmışsa)
  if (isFcmConfigured()) {
    try {
      const { data: tokens } = await supabase
        .from("push_tokens").select("token").eq("user_id", msg.userId).eq("active", true);
      const list = ((tokens as { token: string }[]) ?? []).map((t) => t.token);
      // TODO: FCM HTTP v1 / legacy ile list'e gönder. Başarısız token'ları deactivate et.
      //       pushed = <başarılı gönderim sayısı>;
      pushed = 0; // entegrasyon tamamlanınca güncellenecek
      void list;
    } catch (err) {
      await reportError(err, { where: "push/sendPush:fcm", severity: "warning" });
    }
  }

  return { inApp, pushed };
}
