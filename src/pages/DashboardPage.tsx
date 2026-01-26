import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { ClipboardList, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useDashboardStats, 
  useServices, 
  useProducers, 
  useDemandTypes,
  useUpdateService 
} from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const updateService = useUpdateService();

  // Setup realtime subscription for services
  useEffect(() => {
    const channel = supabase
      .channel('services_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['services'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter pending/in_progress and sort by scheduled_date (oldest first)
  const pendingServices = services
    .filter(s => s.status === 'pending' || s.status === 'in_progress')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  const handleFinalize = (serviceId: string) => {
    updateService.mutate({ 
      id: serviceId, 
      status: 'completed', 
      completed_at: new Date().toISOString() 
    });
  };

  const isLoading = statsLoading || servicesLoading;

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do sistema" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatsCard title="Total de Atendimentos" value={stats?.totalServices || 0} icon={ClipboardList} variant="primary" />
            <StatsCard title="Pendentes" value={stats?.pendingServices || 0} icon={Clock} variant="warning" />
            <StatsCard title="Em Execução" value={stats?.inProgressServices || 0} icon={Loader2} variant="info" />
            <StatsCard title="Finalizados" value={stats?.completedServices || 0} icon={CheckCircle2} variant="success" />
          </>
        )}
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
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : pendingServices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum atendimento pendente</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {pendingServices.map((service) => {
                  const producer = producers.find(p => p.id === service.producer_id);
                  const demandType = demandTypes.find(d => d.id === service.demand_type_id);
                  return (
                    <div key={service.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{producer?.name || service.producers?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground truncate">{demandType?.name || service.demand_types?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(service.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed'} />
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => handleFinalize(service.id)}
                          disabled={updateService.isPending}
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
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{stats?.totalProducers || 0}</p>
              <p className="text-muted-foreground">produtores cadastrados</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
