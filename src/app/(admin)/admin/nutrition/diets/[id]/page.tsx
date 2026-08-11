import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getDiet, getDietTree } from "@/features/admin/features/nutrition/queries";
import { DietForm } from "@/features/admin/features/nutrition/ui/diet-form";
import { DietBuilder } from "@/features/admin/features/nutrition/ui/diet-builder";
import { ContentStatusBadge } from "@/features/admin/features/nutrition/ui/shared";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditDietPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const { id } = await params;
  const diet = await getDiet(id);
  if (!diet) notFound();
  const tree = await getDietTree(id);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition/diets"><ArrowLeft size={16} /> Diyet Planları</Link></Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{diet.name}</h1>
          <ContentStatusBadge status={diet.status} />
        </div>
      </div>
      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="form">Bilgiler</TabsTrigger>
          <TabsTrigger value="builder">Takvim & Öğünler</TabsTrigger>
        </TabsList>
        <TabsContent value="form"><DietForm diet={diet} /></TabsContent>
        <TabsContent value="builder"><DietBuilder planId={id} days={diet.days} tree={tree} /></TabsContent>
      </Tabs>
    </div>
  );
}
