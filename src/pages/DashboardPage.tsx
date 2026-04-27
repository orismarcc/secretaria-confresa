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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  const updateService = useUpdateService();
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

  // Pending + in_progress, sorted by position then scheduled_date
  const pendingServices = useMemo(() => {
    return services
      .filter(s => s.status === 'pending' || s.status === 'in_progress')
      .sort((a, b) => {
        const posA = (a as any).position ?? 999999;
        const posB = (b as any).position ?? 999999;
        if (posA !== posB) return posA - posB;
        return new Date(a.scheduled_date + 'T12:00:00').getTime() -
               new Date(b.scheduled_date + 'T12:00:00').getTime();
      });
  }, [services]);

  // "Próximo" stat — nearest upcoming scheduled_date
  const proximoLabel = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First try: next service >= today
    const upcoming = pendingServices
      .map(s => ({ s, d: new Date(s.scheduled_date + 'T12:00:00') }))
      .filter(({ d }) => d >= today)
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    if (upcoming.length > 0) {
      const d = upcoming[0].d;
      const isToday = d.toDateString() === new Date().toDateString();
      return isToday ? 'Hoje' : format(d, 'dd/MM', { locale: ptBR });
    }

    // Fallback: nearest past service (overdue)
    if (pendingServices.length > 0) return 'Atrasado';
    return '—';
  }, [pendingServices]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = pendingServices.findIndex(s => s.id === active.id);
      const newIndex = pendingServices.findIndex(s => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(pendingServices, oldIndex, newIndex);
        updatePositions.mutate(reordered.map((s, idx) => ({ id: s.id, position: idx + 1 })));
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

      {/* ── Stats row (5 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <div className="cursor-pointer" onClick={() => navigate('/services')}>
              <StatsCard title="Total" value={stats?.totalServices || 0} icon={ClipboardList} variant="primary" />
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
            {/* NEW: Próximo */}
            <div
              className="cursor-pointer col-span-2 sm:col-span-1"
              onClick={() => navigate('/services')}
            >
              <StatsCard
                title="Próximo"
                value={proximoLabel}
                icon={CalendarCheck}
                variant="secondary"
                description={pendingServices.length > 0
                  ? `${pendingServices.length} agendado(s)`
                  : 'Nenhum pendente'}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">

        {/* Próximos Atendimentos — drag-and-drop */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <span>Próximos Atendimentos</span>
                <span className="text-xs text-muted-foreground font-normal hidden sm:inline">
                  (arraste para priorizar)
                </span>
              </div>
              <button
                onClick={() => navigate('/services')}
                className="text-sm text-primary hover:underline font-normal"
              >
                Ver todos
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : pendingServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <CheckCircle2 className="h-10 w-10 text-success/50" />
                <p className="text-muted-foreground text-sm">Nenhum atendimento pendente</p>
              </div>
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
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {pendingServices.map(service => (
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

            {/* Mini-summary of upcoming by status */}
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pendentes por status
              </p>
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg bg-warning/10 border border-warning/20 p-3 text-center">
                  <p className="text-xl font-bold text-warning">
                    {pendingServices.filter(s => s.status === 'pending').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
                <div className="flex-1 rounded-lg bg-info/10 border border-info/20 p-3 text-center">
                  <p className="text-xl font-bold text-info">
                    {pendingServices.filter(s => s.status === 'in_progress').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Em Execução</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
