import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { useData } from '@/contexts/DataContext';
import { ClipboardList, Users, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { stats, services, producers, demandTypes } = useData();
  const navigate = useNavigate();

  const recentServices = services.slice(0, 5);

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do sistema" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard title="Total de Atendimentos" value={stats.totalServices} icon={ClipboardList} variant="primary" />
        <StatsCard title="Pendentes" value={stats.pendingServices} icon={Clock} variant="warning" />
        <StatsCard title="Em Execução" value={stats.inProgressServices} icon={Loader2} variant="info" />
        <StatsCard title="Finalizados" value={stats.completedServices} icon={CheckCircle2} variant="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Atendimentos Recentes</span>
              <button onClick={() => navigate('/services')} className="text-sm text-primary hover:underline">Ver todos</button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentServices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum atendimento</p>
            ) : (
              <div className="space-y-3">
                {recentServices.map((service) => {
                  const producer = producers.find(p => p.id === service.producerId);
                  const demandType = demandTypes.find(d => d.id === service.demandTypeId);
                  return (
                    <div key={service.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{producer?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{demandType?.name}</p>
                      </div>
                      <StatusBadge status={service.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Produtores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{stats.totalProducers}</p>
              <p className="text-muted-foreground">produtores cadastrados</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
