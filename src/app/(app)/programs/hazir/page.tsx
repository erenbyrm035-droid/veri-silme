import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listReadyPrograms,  getMyProgramProgress } from "@/lib/data/ready-programs";
import { getCachedProgramCategories } from "@/lib/data/catalog";
import { ReadyProgramsBrowser } from "@/components/programs/ReadyProgramsBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hazır Programlar · Viva",
  description: "Pilates, yoga, mobilite, kalistenik, HIIT ve fonksiyonel hazır antrenman programları.",
};

export default async function ReadyProgramsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [programs, categories, progress] = await Promise.all([
    listReadyPrograms(),
    getCachedProgramCategories(),
    user ? getMyProgramProgress(user.id) : Promise.resolve({}),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/programs" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={16} /> Programlar
      </Link>
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Hazır Programlar</h1>
        <p className="text-sm text-fg-muted">Hedefine ve seviyene göre hazır antrenman planı seç, hemen başla.</p>
      </header>

      {programs.length === 0 ? (
        <div className="rounded-2xl border border-ink-border bg-ink-card p-6 text-center text-sm text-fg-muted">
          Henüz yayınlanmış program yok. Yönetici <code>ready_programs.sql</code> seed’ini çalıştırınca burada görünür.
        </div>
      ) : (
        <ReadyProgramsBrowser programs={programs} categories={categories} progress={progress} />
      )}
    </div>
  );
}
