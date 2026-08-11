import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, Calendar } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getAnalysis } from "@/features/admin/features/posture/queries";
import { buildRegionScores, buildPostureMuscleAnalysis, overallRisk, RISK_TR } from "@/lib/posture/recommend";
import { RegionBodyMap } from "@/components/posture/RegionBodyMap";
import { MuscleAnalysisCard } from "@/components/posture/MuscleAnalysisCard";
import { FindingCard } from "@/components/posture/FindingCard";
import { ClinicalWarning } from "@/components/posture/ClinicalWarning";
import { Card } from "@/features/admin/components/ui/card";
import { Badge } from "@/features/admin/components/ui/badge";
import { Button } from "@/features/admin/components/ui/button";
import type { PostureMuscleAnalysis, RegionScore } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AdminPostureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const { id } = await params;
  const analysis = await getAnalysis(id);
  if (!analysis) notFound();

  const findings = analysis.findings ?? [];
  const regionScores: Record<string, RegionScore> =
    Object.keys(analysis.region_scores ?? {}).length > 0 ? analysis.region_scores : buildRegionScores(findings);
  const muscle: PostureMuscleAnalysis =
    "short" in (analysis.muscle_analysis ?? {}) ? (analysis.muscle_analysis as PostureMuscleAnalysis) : buildPostureMuscleAnalysis(findings);
  const risk = analysis.risk_level ?? overallRisk(findings);
  const fmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(analysis.created_at));

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/posture"><ArrowLeft size={16} /> Postür Analizleri</Link></Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{analysis.user_name ?? "İsimsiz kullanıcı"}</h1>
          <Badge variant={risk === "high" ? "danger" : risk === "moderate" ? "warning" : "success"}>{RISK_TR[risk]}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1.5"><Mail size={14} /> {analysis.email ?? "—"}</span>
          <span className="inline-flex items-center gap-1.5"><Calendar size={14} /> {fmt}</span>
        </div>
      </div>

      <ClinicalWarning risk={risk} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Posture Score</h3>
            <span className="text-3xl font-bold">{analysis.posture_score}<span className="text-base text-fg-muted">/100</span></span>
          </div>
          <div className="mt-4"><RegionBodyMap regions={regionScores} /></div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Kas Dengesizliği (Akıllı Öneri Motoru)</h3>
          <MuscleAnalysisCard analysis={muscle} />
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Bulgular ({findings.length})</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {findings.map((f, i) => <FindingCard key={i} finding={f} />)}
          {findings.length === 0 && <p className="text-sm text-fg-muted">Bulgu kaydı yok.</p>}
        </div>
      </div>

      {analysis.summary && (
        <Card className="p-5"><h3 className="mb-2 text-sm font-semibold">Özet</h3><p className="text-sm text-fg-muted whitespace-pre-wrap">{analysis.summary}</p></Card>
      )}
    </div>
  );
}
