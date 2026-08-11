import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrograms } from "@/lib/data/programs";
import { ProgramGenerator } from "@/components/programs/ProgramGenerator";
import { Card } from "@/components/ui/Card";
import { formatShortDate } from "@/lib/utils";
import { CalendarDays, ChevronRight, LayoutGrid } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const programs = await getPrograms(user!.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">AI Programlar</h1>
        <p className="text-sm text-fg-muted">
          Kaslarını analiz et, sana özel 8 haftalık plan al.
        </p>
      </header>

      <Link href="/programs/hazir">
        <Card className="card-hover flex items-center justify-between border-brand/30 bg-brand/5">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand">
              <LayoutGrid size={20} />
            </span>
            <div>
              <p className="font-semibold">Hazır Programlar</p>
              <p className="text-sm text-fg-muted">
                Pilates, yoga, mobilite, kalistenik, HIIT ve daha fazlası — seç ve başla.
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-fg-muted" />
        </Card>
      </Link>

      <ProgramGenerator />

      {programs.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Programların
          </h2>
          <div className="space-y-3">
            {programs.map((p) => (
              <Link key={p.id} href={`/programs/${p.id}`}>
                <Card className="card-hover flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                      <CalendarDays size={20} />
                    </span>
                    <div>
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-sm text-fg-muted">
                        {p.weeks} hafta · {formatShortDate(p.created_at)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-fg-muted" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
