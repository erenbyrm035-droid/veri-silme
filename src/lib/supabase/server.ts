import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * Sunucu (Server Component / Route Handler / Server Action) tarafında
 * kullanılacak Supabase istemcisi. Cookie tabanlı oturumu yönetir.
 */
export async function createClient() {
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
}

/**
 * Service role anahtarıyla admin işlemleri için istemci (RLS bypass).
 * SADECE sunucu tarafında, güvenilir bağlamda kullanılmalı.
 */
export function createAdminClient() {
  const { createClient: createSbClient } = require("@supabase/supabase-js");
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
