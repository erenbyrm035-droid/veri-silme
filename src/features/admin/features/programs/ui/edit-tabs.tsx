"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";

export function EditTabs({
  formSlot, builderSlot, relationSlot, statsSlot, versionSlot, previewSlot,
}: {
  formSlot: React.ReactNode;
  builderSlot: React.ReactNode;
  relationSlot: React.ReactNode;
  statsSlot: React.ReactNode;
  versionSlot: React.ReactNode;
  previewSlot: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="builder">
      <TabsList>
        <TabsTrigger value="form">Bilgiler</TabsTrigger>
        <TabsTrigger value="builder">Builder</TabsTrigger>
        <TabsTrigger value="relations">İlişkiler</TabsTrigger>
        <TabsTrigger value="stats">İstatistik</TabsTrigger>
        <TabsTrigger value="versions">Sürümler</TabsTrigger>
        <TabsTrigger value="preview">Önizleme</TabsTrigger>
      </TabsList>
      <TabsContent value="form">{formSlot}</TabsContent>
      <TabsContent value="builder">{builderSlot}</TabsContent>
      <TabsContent value="relations">{relationSlot}</TabsContent>
      <TabsContent value="stats">{statsSlot}</TabsContent>
      <TabsContent value="versions">{versionSlot}</TabsContent>
      <TabsContent value="preview">{previewSlot}</TabsContent>
    </Tabs>
  );
}
