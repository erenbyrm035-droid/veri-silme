import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { FilesBrowser, type StorageObj } from "@/features/admin/features/files/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dosyalar · Admin" };

const BUCKETS = ["exercise-media", "animations", "body-photos", "posture-photos", "meal-photos"];
const PUBLIC = new Set(["exercise-media", "animations"]);

export default async function FilesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const bucket = BUCKETS.includes(sp.bucket ?? "") ? sp.bucket! : "exercise-media";

  const supabase = createAdminClient();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const { data } = await supabase.storage.from(bucket).list("", { limit: 1000, sortBy: { column: "updated_at", order: "desc" } });
  const objects: StorageObj[] = (data ?? [])
    .filter((o: { name: string }) => o.name && !o.name.startsWith("."))
    .map((o: { name: string; updated_at?: string; metadata?: { size?: number } }) => ({
      name: o.name,
      size: o.metadata?.size ?? 0,
      updated_at: o.updated_at ?? null,
      publicUrl: PUBLIC.has(bucket) ? `${base}/storage/v1/object/public/${bucket}/${o.name}` : null,
    }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dosyalar</h1>
        <p className="mt-1 text-sm text-fg-muted">Supabase Storage bucket'larını görüntüle ve yönet.</p>
      </div>
      <FilesBrowser buckets={BUCKETS} bucket={bucket} objects={objects} />
    </div>
  );
}
