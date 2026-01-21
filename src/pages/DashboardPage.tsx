import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { useData } from '@/contexts/DataContext';
import { ClipboardList, Users, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DashboardPage() {
  const { stats, services, producers, demandTypes, updateService } = useData();
  const navigate = useNavigate();

  // Filter pending/in_progress and sort by createdAt (oldest first)
  const pendingServices = services
    .filter(s => s.status === 'pending' || s.status === 'in_progress')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleFinalize = (serviceId: string) => {
    updateService(serviceId, { 
      status: 'completed', 
      completedDate: new Date() 
    });
    toast.success('Atendimento finalizado com sucesso!');
  };

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
              <span>Atendimentos Pendentes</span>
              <button onClick={() => navigate('/services')} className="text-sm text-primary hover:underline">Ver todos</button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingServices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum atendimento pendente</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {pendingServices.map((service) => {
                  const producer = producers.find(p => p.id === service.producerId);
                  const demandType = demandTypes.find(d => d.id === service.demandTypeId);
                  return (
                    <div key={service.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{producer?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground truncate">{demandType?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(service.scheduledDate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={service.status} />
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => handleFinalize(service.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Finalizar
                        </Button>
                      </div>
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
