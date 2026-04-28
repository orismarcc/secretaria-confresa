import { useEffect, useMemo, useCallback, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import {
  ClipboardList, Clock, Loader2, CheckCircle2, Users, CalendarCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceDetailView } from '@/components/ServiceDetailView';
import { format } from 'date-fns';
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
  const updateService = useUpdateService();

  // Detail sheet
  const [detailService, setDetailService] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Finalization dialog
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [serviceToFinalize, setServiceToFinalize] = useState<any | null>(null);
  const [finalizeDate, setFinalizeDate] = useState('');

  const openDetail = useCallback((service: any) => {
    setDetailService(service);
    setDetailOpen(true);
  }, []);

  const openFinalizeDialog = useCallback((service: any) => {
    setDetailOpen(false);
    setServiceToFinalize(service);
    setFinalizeDate(format(new Date(), 'yyyy-MM-dd'));
    setFinalizeDialogOpen(true);
  }, []);

  const handleFinalize = useCallback(() => {
    if (!serviceToFinalize) return;
    const completedAt = finalizeDate
      ? `${finalizeDate}T12:00:00.000Z`
      : new Date().toISOString();
    updateService.mutate({
      id: serviceToFinalize.id,
      status: 'completed',
      completed_at: completedAt,
    });
    setServiceToFinalize(null);
    setFinalizeDialogOpen(false);
  }, [serviceToFinalize, finalizeDate, updateService]);

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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">

        {/* Próximos Atendimentos — apenas status 'proximo', drag-and-drop */}
        <Card>
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-base">
              <div className="flex items-start justify-between gap-1 sm:gap-2 flex-wrap">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <CalendarCheck className="h-3 w-3 sm:h-4 sm:w-4 text-violet-600 shrink-0" />
                  <span className="truncate">Próximos</span>
                  <span className="hidden sm:inline truncate">Atendimentos</span>
                </div>
                <button
                  onClick={() => navigate('/services')}
                  className="text-[10px] sm:text-sm text-primary hover:underline font-normal whitespace-nowrap shrink-0"
                >
                  Ver todos
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {isLoading ? (
              <div className="space-y-2 sm:space-y-3">
                <Skeleton className="h-10 sm:h-14" />
                <Skeleton className="h-10 sm:h-14" />
                <Skeleton className="h-10 sm:h-14" />
              </div>
            ) : proximoServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-center gap-1 sm:gap-2">
                <CalendarCheck className="h-7 w-7 sm:h-10 sm:w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground text-[10px] sm:text-sm leading-tight">
                  <span className="hidden sm:inline">Nenhum atendimento marcado como </span>
                  <span className="sm:hidden">Sem </span>
                  <strong>Próximos</strong>
                </p>
                <p className="text-[9px] sm:text-xs text-muted-foreground hidden sm:block">
                  Defina o status como "Próximo" em Atendimentos
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
                  <div className="space-y-1.5 sm:space-y-2 max-h-[260px] sm:max-h-[420px] overflow-y-auto pr-0.5 sm:pr-1">
                    {proximoServices.map(service => (
                      <SortableServiceItem
                        key={service.id}
                        service={service}
                        producerName={(service as any).producers?.name || 'N/A'}
                        demandTypeName={(service as any).demand_types?.name || 'N/A'}
                        variant="proximos"
                        onView={() => openDetail(service)}
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
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-2xl">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 space-y-3 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-4 rounded-xl bg-primary/10 shrink-0">
                <Users className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <p className="text-2xl sm:text-4xl font-bold leading-none">{stats?.totalProducers || 0}</p>
                <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight mt-0.5">
                  produtores<span className="hidden sm:inline"> cadastrados</span>
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between text-[10px] sm:text-sm">
                <span className="text-muted-foreground">
                  <span className="hidden sm:inline">Taxa de c</span><span className="sm:hidden">C</span>onclusão
                </span>
                <span className="font-semibold">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-1.5 sm:h-2" />
              <p className="text-[9px] sm:text-xs text-muted-foreground">
                {stats?.completedServices || 0}/{stats?.totalServices || 0}
                <span className="hidden sm:inline"> atendimentos finalizados</span>
              </p>
            </div>

            <Separator />

            {/* Status breakdown */}
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-[9px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Por status
              </p>
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                <div className="rounded-lg bg-warning/10 border border-warning/20 p-1 sm:p-2.5 text-center">
                  <p className="text-sm sm:text-lg font-bold text-warning leading-none">{stats?.pendingServices || 0}</p>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">
                    <span className="sm:hidden">Pend.</span>
                    <span className="hidden sm:inline">Pendentes</span>
                  </p>
                </div>
                <div className="rounded-lg bg-info/10 border border-info/20 p-1 sm:p-2.5 text-center">
                  <p className="text-sm sm:text-lg font-bold text-info leading-none">{stats?.inProgressServices || 0}</p>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">
                    <span className="sm:hidden">Em Ex.</span>
                    <span className="hidden sm:inline">Em Execução</span>
                  </p>
                </div>
                <div className="rounded-lg bg-violet-50 border border-violet-200 p-1 sm:p-2.5 text-center dark:bg-violet-950/30">
                  <p className="text-sm sm:text-lg font-bold text-violet-600 leading-none">{stats?.proximoServices || 0}</p>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">
                    <span className="sm:hidden">Próx.</span>
                    <span className="hidden sm:inline">Próximos</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* ── Detail Sheet ─────────────────────────────────────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {detailService?.producers?.name || 'Detalhes do Atendimento'}
            </SheetTitle>
          </SheetHeader>
          {detailService && (
            <ServiceDetailView
              service={detailService}
              onFinalize={() => openFinalizeDialog(detailService)}
              onEdit={() => { setDetailOpen(false); navigate('/services'); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Finalization Dialog ───────────────────────────────────── */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Produtor: <strong>{serviceToFinalize?.producers?.name}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dash-finalize-date">Data de finalização</Label>
              <Input
                id="dash-finalize-date"
                type="date"
                value={finalizeDate}
                onChange={(e) => setFinalizeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-success hover:bg-success/90"
              onClick={handleFinalize}
              disabled={updateService.isPending}
            >
              Confirmar Finalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
