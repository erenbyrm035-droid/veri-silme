import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * Sunucu (Server Component / Route Handler / Server Action) tarafında
 * kullanılacak Supabase istemcisi. Cookie tabanlı oturumu yönetir.
 *
 * İSTEK BAŞINA TEK İSTEMCİ. Bu fonksiyon kod tabanında 165 yerde çağrılıyor;
 * tek bir sayfa isteği sırasında onlarca kez çalışabiliyor ve her seferinde
 * sıfırdan bir istemci (GoTrue + Postgrest + Storage + Realtime alt istemcileri)
 * kuruluyordu. `cache()` bunu istek başına bire indirir.
 *
 * İSTEKLER ARASI SIZINTI YOK — kontrol edildi, varsayılmadı. React'in
 * `cache()` gövdesi şununla başlıyor:
 *     var dispatcher = ReactSharedInternals.A;
 *     if (!dispatcher) return fn.apply(null, arguments);
 * Yani önbellek dispatcher'ın istek başına oluşturduğu köke bağlı; dispatcher
 * yoksa (istek kapsamı dışında) hiç önbellekleme yapılmaz, fonksiyon doğrudan
 * çağrılır. En kötü ihtimalle eski davranış. Çerezli bir istemcinin başka bir
 * kullanıcının isteğine taşınması bu yüzden mümkün değil.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieItem[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component içinden çağrıldığında set edilemez;
            // middleware oturumu zaten yeniliyorsa bu güvenle yok sayılabilir.
          }
        },
      },
    }
  );
});

/**
 * Service role anahtarıyla admin işlemleri için istemci (RLS bypass).
 * SADECE sunucu tarafında, güvenilir bağlamda kullanılmalı.
 *
 * TEK ÖRNEK (lambda ömrü boyunca). 265 çağrı yeri var ve her biri yeni bir
 * istemci kuruyordu. Bu istemcinin çerez/oturum durumu YOK — `persistSession`
 * ve `autoRefreshToken` kapalı, kimlik tek bir sabit service-role anahtarı.
 * Dolayısıyla paylaşmak güvenli: kullanıcıya özel hiçbir şey taşımıyor.
 * (Çerezli `createClient` için durum farklı; o yüzden orada istek başına
 * `cache()` kullanıldı, modül düzeyinde tekil DEĞİL.)
 *
 * Tembel kurulum bilinçli: modül yüklenirken kurulsaydı ortam değişkenleri
 * olmayan build adımında patlardı.
 */
let adminClient: ReturnType<typeof buildAdminClient> | null = null;

function buildAdminClient() {
  // Fonksiyon senkron; statik import dönüş tipini daraltıp 65 dosyada tip
  // hatası açardı (ayrı bir iş).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient: createSbClient } = require("@supabase/supabase-js");
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function createAdminClient() {
  if (!adminClient) adminClient = buildAdminClient();
  return adminClient;
}
