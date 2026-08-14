"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/features/admin/components/ui/tabs";
import type { AiCenterData } from "./queries";
import { AgentsTab } from "./tabs/AgentsTab";
import { PromptsTab } from "./tabs/PromptsTab";
import { MetricsTab } from "./tabs/MetricsTab";
import { AbTab } from "./tabs/AbTab";

// ============================================================================
// AI Yönetim Merkezi — arayüz.
//
// Beş sekme: Ajanlar / Promptlar / Metrikler / A-B Testleri / Çalışma Kaydı
//
// TASARIM NOTU: "Varsayılan" rozeti önemli. DB'de kaydı olmayan bir ajan
// bozuk değil, kod varsayılanıyla çalışıyor demek. Bunu göstermezsek yönetici
// ajanın çalışmadığını sanıp gereksiz müdahale eder.
// ============================================================================


export function AiCenterAdmin({ data }: { data: AiCenterData }) {
  return (
    <Tabs defaultValue="agents" className="space-y-5">
      <TabsList>
        <TabsTrigger value="agents">Ajanlar</TabsTrigger>
        <TabsTrigger value="prompts">Promptlar</TabsTrigger>
        <TabsTrigger value="metrics">Metrikler</TabsTrigger>
        <TabsTrigger value="ab">A/B Testleri</TabsTrigger>
      </TabsList>

      <TabsContent value="agents">
        <AgentsTab data={data} />
      </TabsContent>
      <TabsContent value="prompts">
        <PromptsTab data={data} />
      </TabsContent>
      <TabsContent value="metrics">
        <MetricsTab data={data} />
      </TabsContent>
      <TabsContent value="ab">
        <AbTab data={data} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// AJANLAR
// ---------------------------------------------------------------------------
