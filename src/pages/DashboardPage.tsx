import { useEffect, useMemo, useCallback, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import {
  ClipboardList, Clock, Loader2, CheckCircle2, Users, CalendarCheck, PlayCircle, Wrench,
  ChevronDown, ChevronRight, User, CalendarClock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { serviceExerciseYear } from '@/lib/analyticsUtils';
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
import { StatusMenu } from '@/components/StatusMenu';
import { Textarea } from '@/components/ui/textarea';
import { XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isDamOverdue } from '@/lib/damUtils';
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
import { useMaintenances } from '@/hooks/useMaintenanceData';
import { useOperators } from '@/hooks/useOperatorData';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: producerStats, isLoading: statsLoading } = useDashboardStats();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: maintenances = [] } = useMaintenances();
  const { data: operators = [] } = useOperators();

  // Próximos atendimentos expandidos por operador (clique para expandir)
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());
  const toggleOp = useCallback((key: string) => {
    setExpandedOps((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  const opNameById = useMemo(
    () => new Map((operators as any[]).map((o) => [o.id, o.name] as const)),
    [operators],
  );

  // Maquinários atualmente em manutenção (sem data de fim)
  const ongoingMaintenances = useMemo(
    () => (maintenances as any[]).filter((m) => !m.ended_at),
    [maintenances],
  );

  // ── Exercício (ano) — os cards refletem o ano vigente por padrão ─────────────
  const CURRENT_YEAR = new Date().getFullYear();
  const [exercicio, setExercicio] = useState<string>(String(CURRENT_YEAR)); // 'all' ou ano

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    (services as any[]).forEach((s) => { const y = serviceExerciseYear(s); if (y) set.add(y); });
    set.add(CURRENT_YEAR);
    return Array.from(set).sort((a, b) => b - a);
  }, [services, CURRENT_YEAR]);

  /** Atendimentos do exercício selecionado (base dos cards e da taxa de conclusão). */
  const scopedServices = useMemo(
    () => (exercicio === 'all'
      ? (services as any[])
      : (services as any[]).filter((s: any) => serviceExerciseYear(s) === Number(exercicio))),
    [services, exercicio],
  );

  // Estatísticas de atendimentos derivadas do cache de useServices (sem refetch).
  // Contagens de atendimentos seguem o exercício; produtores continua somando tudo.
  const stats = useMemo(() => ({
    totalServices: scopedServices.length,
    pendingServices: scopedServices.filter((s: any) => s.status === 'pending').length,
    inProgressServices: scopedServices.filter((s: any) => s.status === 'in_progress').length,
    completedServices: scopedServices.filter((s: any) => s.status === 'completed').length,
    proximoServices: scopedServices.filter((s: any) => s.status === 'proximo').length,
    totalProducers: producerStats?.totalProducers ?? 0,
  }), [scopedServices, producerStats]);

  const updatePositions = useUpdateServicePositions();
  const updateService = useUpdateService();

  // Detail sheet
  const [detailService, setDetailService] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Finalization dialog
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [serviceToFinalize, setServiceToFinalize] = useState<any | null>(null);
  const [finalizeDate, setFinalizeDate] = useState('');

  // Cancellation dialog (motivo obrigatório)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [serviceToCancel, setServiceToCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Mudança rápida de status pelo badge (pendente/em execução/próximo).
  const quickChangeStatus = useCallback((id: string, newStatus: string) => {
    updateService.mutate({
      id,
      status: newStatus,
      completed_at: null,
      cancellation_reason: null,
    });
  }, [updateService]);

  const openCancelDialog = useCallback((service: any) => {
    setDetailOpen(false);
    setServiceToCancel(service);
    setCancelReason('');
    setCancelDialogOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    if (!serviceToCancel) return;
    updateService.mutate({
      id: serviceToCancel.id,
      status: 'cancelled',
      cancellation_reason: cancelReason.trim() || null,
    });
    setServiceToCancel(null);
    setCancelDialogOpen(false);
  }, [serviceToCancel, cancelReason, updateService]);

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

  // Agrupa os "próximos" por operador. Dentro de cada operador, atendimentos com
  // agendamento (appointment_date) têm prioridade por data; os demais seguem a
  // ordem manual (posição).
  const proximoGroups = useMemo(() => {
    const opName = new Map((operators as any[]).map((o) => [o.id, o.name] as const));
    const groups = new Map<string, { key: string; name: string; items: any[]; agendados: number }>();
    for (const s of proximoServices as any[]) {
      const key = s.operator_id || '__none__';
      const name = s.operator_id ? (opName.get(s.operator_id) || 'Operador') : 'Sem operador';
      if (!groups.has(key)) groups.set(key, { key, name, items: [], agendados: 0 });
      const g = groups.get(key)!;
      g.items.push(s);
      if (s.appointment_date) g.agendados++;
    }
    const apptTime = (s: any) => (s.appointment_date ? new Date(String(s.appointment_date).replace(' ', 'T')).getTime() : null);
    for (const g of groups.values()) {
      g.items.sort((a, b) => {
        const ta = apptTime(a), tb = apptTime(b);
        if (ta != null && tb != null && ta !== tb) return ta - tb; // agendados: por data (prioridade)
        if (ta != null && tb == null) return -1;                   // agendado antes do não-agendado
        if (ta == null && tb != null) return 1;
        const pa = a.position ?? 999999, pb = b.position ?? 999999; // demais: ordem manual
        if (pa !== pb) return pa - pb;
        return new Date(a.scheduled_date + 'T12:00:00').getTime() - new Date(b.scheduled_date + 'T12:00:00').getTime();
      });
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === '__none__') return 1;
      if (b.key === '__none__') return -1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [proximoServices, operators]);

  // Services currently in_progress, sorted by most recent update
  const inProgressServices = useMemo(() => {
    return services
      .filter(s => s.status === 'in_progress')
      .sort((a, b) => {
        const aDate = (a as any).updated_at || a.scheduled_date;
        const bDate = (b as any).updated_at || b.scheduled_date;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [services]);

  // Drag-and-drop dentro de um operador: reordena e persiste as posições do grupo.
  const handleGroupDragEnd = useCallback((items: any[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((s) => s.id === active.id);
      const newIndex = items.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(items, oldIndex, newIndex);
        updatePositions.mutate(reordered.map((s, idx) => ({ id: s.id, position: idx + 1 })));
      }
    }
  }, [updatePositions]);

  const isLoading = statsLoading || servicesLoading;

  const completionRate = stats?.totalServices
    ? Math.round(((stats.completedServices || 0) / stats.totalServices) * 100)
    : 0;

  // M-02: usar isDamOverdue centralizado em damUtils (mesma regra de 30 dias)
  const damOverdueCount = useMemo(() => {
    return services.filter((s: any) =>
      s.dam_issued && s.status !== 'cancelled' && isDamOverdue(s.dam_issued_at, s.dam_paid)
    ).length;
  }, [services]);

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Visão geral do sistema" />

      {/* ── Seletor de Exercício (ano) ──────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <Label className="text-xs text-muted-foreground shrink-0">
          Atendimentos do exercício
        </Label>
        <Select value={exercicio} onValueChange={setExercicio}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
            <SelectItem value="all">Todos os anos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Stats row (4 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <div className="cursor-pointer" onClick={() => navigate('/services')}>
              <StatsCard title="Total de Atendimentos" value={stats?.totalServices || 0} icon={ClipboardList} variant="primary" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/services?status=pending')}>
              <StatsCard title="Pendentes" value={stats?.pendingServices || 0} icon={Clock} variant="warning" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/services?status=in_progress')}>
              <StatsCard title="Em Execução" value={stats?.inProgressServices || 0} icon={Loader2} variant="info" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate('/services?tab=archived')}>
              <StatsCard title="Finalizados" value={stats?.completedServices || 0} icon={CheckCircle2} variant="success" />
            </div>
          </>
        )}
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">

        {/* Próximos Atendimentos — apenas status 'proximo', drag-and-drop */}
        <Card>
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-base">
              <div className="flex items-start justify-between gap-1 sm:gap-2 flex-wrap">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <CalendarCheck className="h-3 w-3 sm:h-4 sm:w-4 text-violet-600 shrink-0" />
                  <span className="truncate">Próximos</span>
                  <span className="hidden sm:inline truncate">Atendimentos</span>
                  {proximoServices.length > 0 && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950/50 px-1.5 py-0.5 rounded-full font-normal">
                      {proximoServices.length}
                    </span>
                  )}
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
              <div className="space-y-2 max-h-[280px] sm:max-h-[440px] overflow-y-auto pr-0.5 sm:pr-1">
                {proximoGroups.map((g) => {
                  const isOpen = expandedOps.has(g.key);
                  return (
                    <div key={g.key} className="rounded-lg border bg-card">
                      <button
                        type="button"
                        onClick={() => toggleOp(g.key)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40 rounded-lg"
                      >
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <User className="h-4 w-4 shrink-0 text-violet-600" />
                        <span className="font-medium text-sm truncate flex-1">{g.name}</span>
                        {g.agendados > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-500/10 rounded-full px-1.5 py-0.5">
                            <CalendarClock className="h-3 w-3" /> {g.agendados}
                          </span>
                        )}
                        <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950/50 px-1.5 py-0.5 rounded-full">
                          {g.items.length}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-2 pb-2 pt-0.5">
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleGroupDragEnd(g.items)}
                          >
                            <SortableContext
                              items={g.items.map((s) => s.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-1.5">
                                {g.items.map((service) => (
                                  <SortableServiceItem
                                    key={service.id}
                                    service={service}
                                    producerName={(service as any).producers?.name || 'N/A'}
                                    demandTypeName={(service as any).demand_types?.name || 'N/A'}
                                    variant="proximos"
                                    onView={() => openDetail(service)}
                                    onChangeStatus={quickChangeStatus}
                                    onFinalize={() => openFinalizeDialog(service)}
                                    onCancelStatus={() => openCancelDialog(service)}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Em Execução */}
        <Card>
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-base">
              <div className="flex items-start justify-between gap-1 sm:gap-2 flex-wrap">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <PlayCircle className="h-3 w-3 sm:h-4 sm:w-4 text-info shrink-0" />
                  <span className="truncate">Em Execução</span>
                  {inProgressServices.length > 0 && (
                    <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 rounded-full font-normal">
                      {inProgressServices.length}
                    </span>
                  )}
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
              </div>
            ) : (inProgressServices.length === 0 && ongoingMaintenances.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-center gap-1 sm:gap-2">
                <PlayCircle className="h-7 w-7 sm:h-10 sm:w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground text-[10px] sm:text-sm leading-tight">
                  Nenhum atendimento em execução
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2 max-h-[260px] sm:max-h-[380px] overflow-y-auto pr-0.5 sm:pr-1">
                {/* Maquinários em manutenção */}
                {ongoingMaintenances.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => navigate('/maintenance')}
                    className="w-full text-left rounded-lg border border-amber-300 bg-amber-50/60 p-2 sm:p-3 hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium truncate">{m.machinery?.name || 'Maquinário'}</p>
                          <p className="text-[10px] sm:text-xs text-amber-700 truncate">{m.description}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-amber-700 bg-amber-500/15 border border-amber-300 rounded-full px-1.5 py-0.5 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Em manutenção
                      </span>
                    </div>
                    {m.started_at && (
                      <p className="text-[10px] text-amber-700/70 mt-1">
                        Desde {format(new Date(m.started_at.replace(' ', 'T')), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </button>
                ))}
                {/* Atendimentos em execução */}
                {inProgressServices.map((service: any) => (
                  <div
                    key={service.id}
                    className="w-full rounded-lg border bg-info/5 border-info/20 p-2 sm:p-3 hover:bg-info/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button
                        onClick={() => openDetail(service)}
                        className="min-w-0 text-left flex-1"
                      >
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {service.producers?.name || 'N/A'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {service.demand_types?.name || 'N/A'}
                          {(Number((service as any).worked_hours) || 0) > 0 && (
                            <span className="ml-1 text-blue-600 font-medium">· {Number((service as any).worked_hours).toLocaleString('pt-BR')}h</span>
                          )}
                        </p>
                        <p className="text-[10px] sm:text-xs text-violet-600 font-medium mt-0.5 flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0" />
                          {service.operator_id ? (opNameById.get(service.operator_id) || 'Operador') : 'Sem operador'}
                        </p>
                        {service.scheduled_date && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(service.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        )}
                      </button>
                      <StatusMenu
                        status={service.status}
                        onChange={(st) => quickChangeStatus(service.id, st)}
                        onFinalize={() => openFinalizeDialog(service)}
                        onCancel={() => openCancelDialog(service)}
                        className="shrink-0"
                      />
                    </div>
                  </div>
                ))}
              </div>
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

            {/* Status breakdown — clickable */}
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-[9px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Por status
              </p>
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                <button
                  onClick={() => navigate('/services?status=pending')}
                  className="rounded-lg bg-warning/10 border border-warning/20 p-1 sm:p-2.5 text-center hover:bg-warning/20 transition-colors"
                >
                  <p className="text-sm sm:text-lg font-bold text-warning leading-none">{stats?.pendingServices || 0}</p>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">
                    <span className="sm:hidden">Pend.</span>
                    <span className="hidden sm:inline">Pendentes</span>
                  </p>
                </button>
                <button
                  onClick={() => navigate('/services?status=in_progress')}
                  className="rounded-lg bg-info/10 border border-info/20 p-1 sm:p-2.5 text-center hover:bg-info/20 transition-colors"
                >
                  <p className="text-sm sm:text-lg font-bold text-info leading-none">{stats?.inProgressServices || 0}</p>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">
                    <span className="sm:hidden">Em Ex.</span>
                    <span className="hidden sm:inline">Em Execução</span>
                  </p>
                </button>
                <button
                  onClick={() => navigate('/services')}
                  className="rounded-lg bg-violet-50 border border-violet-200 p-1 sm:p-2.5 text-center hover:bg-violet-100 transition-colors dark:bg-violet-950/30"
                >
                  <p className="text-sm sm:text-lg font-bold text-violet-600 leading-none">{stats?.proximoServices || 0}</p>
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">
                    <span className="sm:hidden">Próx.</span>
                    <span className="hidden sm:inline">Próximos</span>
                  </p>
                </button>
              </div>
            </div>

            {/* DAM overdue alert */}
            {!isLoading && damOverdueCount > 0 && (
              <>
                <Separator />
                <button
                  onClick={() => navigate('/services')}
                  className="w-full flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 sm:p-3 text-left hover:bg-destructive/20 transition-colors"
                >
                  <span className="text-destructive text-sm sm:text-base shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-destructive leading-tight">
                      {damOverdueCount} DAM{damOverdueCount > 1 ? 's' : ''} em atraso
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-destructive/70 leading-tight mt-0.5">
                      Emitida{damOverdueCount > 1 ? 's' : ''} há mais de 30 dias sem pagamento
                    </p>
                  </div>
                </button>
              </>
            )}
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

      {/* ── Cancel Dialog — motivo obrigatório ───────────────────── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo do cancelamento. Ele ficará registrado no histórico do produtor.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dash-cancel-reason">Motivo *</Label>
              <Textarea
                id="dash-cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: produtor desistiu, duplicidade, erro de cadastro..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || updateService.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
