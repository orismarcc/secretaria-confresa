import { useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import {
  ClipboardList, Clock, Loader2, CheckCircle2, Users, CalendarCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDashboardStats,
  useServices,
  useUpdateService,
  useUpdateServicePositions,
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
  const updatePositions = useUpdateServicePositions();

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('services_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        queryClient.invalidateQueries({ queryKey: ['services'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Only services with status 'proximo', sorted by position then scheduled_date
  const proximoServices = useMemo(() => {
    return services
      .filter(s => s.status === 'proximo')
      .sort((a, b) => {
        const posA = (a as any).position ?? 999999;
        const posB = (b as any).position ?? 999999;
        if (posA !== posB) return posA - posB;
        return new Date(a.scheduled_date + 'T12:00:00').getTime() -
               new Date(b.scheduled_date + 'T12:00:00').getTime();
      });
  }, [services]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = proximoServices.findIndex(s => s.id === active.id);
      const newIndex = proximoServices.findIndex(s => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(proximoServices, oldIndex, newIndex);
        updatePositions.mutate(reordered.map((s, idx) => ({ id: s.id, position: idx + 1 })));
      }
    }
  }, [proximoServices, updatePositions]);

  const isLoading = statsLoading || servicesLoading;

  const completionRate = stats?.totalServices
    ? Math.round(((stats.completedServices || 0) / stats.totalServices) * 100)
    : 0;

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do sistema" />

      {/* ── Stats row (4 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <div className="cursor-pointer" onClick={() => navigate('/services')}>
              <StatsCard title="Total de Atendimentos" value={stats?.totalServices || 0} icon={ClipboardList} variant="primary" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/services')}>
              <StatsCard title="Pendentes" value={stats?.pendingServices || 0} icon={Clock} variant="warning" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/services')}>
              <StatsCard title="Em Execução" value={stats?.inProgressServices || 0} icon={Loader2} variant="info" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/services?tab=archived')}>
              <StatsCard title="Finalizados" value={stats?.completedServices || 0} icon={CheckCircle2} variant="success" />
            </div>
          </>
        )}
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">

        {/* Próximos Atendimentos — apenas status 'proximo', drag-and-drop */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarCheck className="h-4 w-4 text-violet-600 shrink-0" />
                  <span className="truncate">Próximos Atendimentos</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isLoading && (
                    <span className="text-xs font-normal text-muted-foreground hidden md:inline">
                      (arraste para priorizar)
                    </span>
                  )}
                  <button
                    onClick={() => navigate('/services')}
                    className="text-sm text-primary hover:underline font-normal whitespace-nowrap"
                  >
                    Ver todos
                  </button>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : proximoServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <CalendarCheck className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  Nenhum atendimento marcado como <strong>Próximo</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Defina o status de um atendimento como "Próximo" em Atendimentos
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={proximoServices.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {proximoServices.map(service => (
                      <SortableServiceItem
                        key={service.id}
                        service={service}
                        producerName={(service as any).producers?.name || 'N/A'}
                        demandTypeName={(service as any).demand_types?.name || 'N/A'}
                        variant="proximos"
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Resumo */}
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

            <Separator />

            {/* Status breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Por status
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-warning/10 border border-warning/20 p-2.5 text-center">
                  <p className="text-lg font-bold text-warning">{stats?.pendingServices || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Pendentes</p>
                </div>
                <div className="rounded-lg bg-info/10 border border-info/20 p-2.5 text-center">
                  <p className="text-lg font-bold text-info">{stats?.inProgressServices || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Em Execução</p>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-2.5 text-center dark:bg-violet-950/30">
                  <p className="text-lg font-bold text-violet-600">{stats?.proximoServices || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Próximos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
