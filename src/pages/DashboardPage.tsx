import { useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { ClipboardList, Clock, Loader2, CheckCircle2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDashboardStats,
  useServices,
  useUpdateService,
  useUpdateServicePositions
} from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableServiceItem } from '@/components/SortableServiceItem';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const updateService = useUpdateService();
  const updatePositions = useUpdateServicePositions();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Filter pending/in_progress and sort by position then scheduled_date
  const pendingServices = useMemo(() => {
    return services
      .filter(s => s.status === 'pending' || s.status === 'in_progress')
      .sort((a, b) => {
        const posA = (a as any).position ?? 999999;
        const posB = (b as any).position ?? 999999;
        if (posA !== posB) return posA - posB;
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      });
  }, [services]);

  const handleFinalize = (serviceId: string) => {
    updateService.mutate({ 
      id: serviceId, 
      status: 'completed', 
      completed_at: new Date().toISOString() 
    });
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pendingServices.findIndex((s) => s.id === active.id);
      const newIndex = pendingServices.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(pendingServices, oldIndex, newIndex);
        
        // Update positions in database
        const updates = reordered.map((service, index) => ({
          id: service.id,
          position: index + 1,
        }));
        
        updatePositions.mutate(updates);
      }
    }
  }, [pendingServices, updatePositions]);

  const isLoading = statsLoading || servicesLoading;

  const completionRate = stats?.totalServices
    ? Math.round(((stats.completedServices || 0) / stats.totalServices) * 100)
    : 0;

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do sistema" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6">
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

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Atendimentos Pendentes</span>
                <span className="text-xs text-muted-foreground font-normal">(arraste para reordenar)</span>
              </div>
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pendingServices.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {pendingServices.map((service) => (
                      <SortableServiceItem
                        key={service.id}
                        service={service}
                        producerName={(service as any).producers?.name || 'N/A'}
                        demandTypeName={(service as any).demand_types?.name || 'N/A'}
                        onFinalize={handleFinalize}
                        isFinalizePending={updateService.isPending}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-primary/10 shrink-0">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-4xl font-bold">{stats?.totalProducers || 0}</p>
                <p className="text-sm text-muted-foreground">produtores cadastrados</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de conclusão</span>
                <span className="font-semibold">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats?.completedServices || 0} de {stats?.totalServices || 0} atendimentos finalizados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
