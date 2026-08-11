"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";

export function EditTabs({
  formSlot,
  muscleSlot,
  mediaSlot,
  relationSlot,
  versionSlot,
}: {
  formSlot: React.ReactNode;
  muscleSlot: React.ReactNode;
  mediaSlot: React.ReactNode;
  relationSlot: React.ReactNode;
  versionSlot: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="form">
      <TabsList>
        <TabsTrigger value="form">Bilgiler</TabsTrigger>
        <TabsTrigger value="muscles">Kaslar</TabsTrigger>
        <TabsTrigger value="media">Medya</TabsTrigger>
        <TabsTrigger value="relations">İlişkiler</TabsTrigger>
        <TabsTrigger value="versions">Sürümler</TabsTrigger>
      </TabsList>
      <TabsContent value="form">{formSlot}</TabsContent>
      <TabsContent value="muscles">{muscleSlot}</TabsContent>
      <TabsContent value="media">{mediaSlot}</TabsContent>
      <TabsContent value="relations">{relationSlot}</TabsContent>
      <TabsContent value="versions">{versionSlot}</TabsContent>
    </Tabs>
  );
}
