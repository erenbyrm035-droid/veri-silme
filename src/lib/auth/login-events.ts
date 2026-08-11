import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Geçerli oturumdaki kullanıcı için bir giriş olayı kaydeder.
 * RLS: kullanıcı yalnızca kendi kaydını ekleyebilir (login_events_insert_own).
 * Hata olsa bile akışı bozmaz (sessizce yut).
 */
export async function recordLoginEvent(provider = "password"): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_login_events").insert({ user_id: user.id, provider });
  } catch {
    // İzleme kritik değil; sessizce geç.
  }
}
