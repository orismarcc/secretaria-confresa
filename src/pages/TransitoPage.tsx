import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Route, AlertTriangle, FileSignature } from 'lucide-react';
import { FleetAlerts } from '@/components/FleetAlerts';
import { CondutoresTab } from '@/components/transito/CondutoresTab';
import { ViagensTab } from '@/components/transito/ViagensTab';
import { MultasTab } from '@/components/transito/MultasTab';
import { TermosTab } from '@/components/transito/TermosTab';

type TabValue = 'multas' | 'condutores' | 'viagens' | 'termos';

export default function TransitoPage() {
  const [tab, setTab] = useState<TabValue>('multas');

  return (
    <AppLayout>
      <PageHeader
        title="Trânsito"
        description="Multas, condutores, viagens e termos de responsabilidade dos veículos"
      />

      {/* Alertas de vencimento (documentos da frota + CNH de condutores) */}
      <div className="mb-4">
        <FleetAlerts />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="multas" className="gap-2"><AlertTriangle className="h-4 w-4" /> Multas</TabsTrigger>
          <TabsTrigger value="condutores" className="gap-2"><Users className="h-4 w-4" /> Condutores</TabsTrigger>
          <TabsTrigger value="viagens" className="gap-2"><Route className="h-4 w-4" /> Viagens</TabsTrigger>
          <TabsTrigger value="termos" className="gap-2"><FileSignature className="h-4 w-4" /> Termos</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'multas' ? <MultasTab />
        : tab === 'condutores' ? <CondutoresTab />
        : tab === 'viagens' ? <ViagensTab />
        : <TermosTab />}
    </AppLayout>
  );
}
