import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, Phone, Calendar, Clock, GripVertical, Navigation, User, MessageCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineIndicator } from '@/components/ConnectionStatus';
import { FinalizePhotosModal } from '@/components/FinalizePhotosModal';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePendingServices,
  useSettlements,
  useLocations,
  useUpdateServicePositions,
  useOperatorDemandTypes,
  useOperatorSettlements,
} from '@/hooks/useSupabaseData';
import { enqueueOperatorAction, getPendingActions } from '@/lib/operatorQueue';
import { useSyncOperatorActions, usePendingActionsCount } from '@/hooks/useOperatorQueue';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface DbService {
  id: string;
  producer_id: string;
  demand_type_id: string;
  settlement_id?: string | null;
  location_id?: string | null;
  status: string;
  scheduled_date: string;
  completed_at?: string | null;
  notes?: string | null;
  priority: string;
  operator_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  position?: number | null;
  worked_hours?: number | null;
  producers?: { name: string; phone?: string | null; location_name?: string | null; latitude?: number | null; longitude?: number | null } | null;
  demand_types?: { name: string } | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
  profiles?: { name: string } | null;
}

// ─── Shared card body ────────────────────────────────────────────────────────

interface OperatorCardBodyProps {
  service: DbService;
  settlementName: string;
  locationName: string;
  onStart: (service: DbService) => void;
  onFinalize: (service: DbService) => void;
  isStarting?: boolean;
}

function OperatorCardBody({
  service,
  settlementName,
  locationName,
  onStart,
  onFinalize,
  isStarting,
}: OperatorCardBodyProps) {
  const canStart = service.status === 'pending' || service.status === 'proximo';
  // Só finaliza depois de iniciar (passa por "em execução").
  const canFinalize = service.status === 'in_progress';
  const horas = Number(service.worked_hours) || 0;

  return (
    <div className="flex-1">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-lg">{service.producers?.name || 'N/A'}</p>
          <p className="text-sm text-primary">
            {service.demand_types?.name}
            {horas > 0 && (
              <span className="inline-flex items-center gap-1 ml-2 text-xs font-semibold text-foreground bg-muted rounded-full px-2 py-0.5 align-middle">
                <Clock className="h-3 w-3" />
                {horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h a realizar
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed'} />
          {service.status === 'in_progress' && service.profiles?.name && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {service.profiles.name}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-2 text-sm mb-4">
        {(() => {
          const isOverdue = (service.status === 'pending' || service.status === 'proximo') &&
            new Date(service.scheduled_date + 'T12:00:00') < new Date(new Date().toDateString());
          return (
            <div className={cn('flex items-center gap-2', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
              <Calendar className="h-4 w-4" />
              <span className={isOverdue ? 'font-medium' : ''}>
                {isOverdue && '⚠ '}
                {format(new Date(service.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          );
        })()}
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {settlementName} - {locationName}
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          {service.producers?.phone ? (
            <a
              href={`https://wa.me/${service.producers.phone.replace(/\D/g, '').replace(/^(?!55)/, '55')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#25D366] hover:text-[#25D366]/80 font-medium text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {service.producers.phone}
            </a>
          ) : (
            <span className="text-muted-foreground text-sm">N/A</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {service.producers?.latitude && service.producers?.longitude && (
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a
              href={`geo:${service.producers.latitude},${service.producers.longitude}?q=${service.producers.latitude},${service.producers.longitude}`}
              onClick={(e) => {
                if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                  e.preventDefault();
                  window.open(`https://www.google.com/maps?q=${service.producers!.latitude},${service.producers!.longitude}`, '_blank');
                }
              }}
            >
              <Navigation className="h-4 w-4" />
              Maps
            </a>
          </Button>
        )}
        {canStart && (
          <Button className="flex-1" onClick={() => onStart(service)} disabled={isStarting}>
            {isStarting ? 'Iniciando…' : 'Iniciar'}
          </Button>
        )}
        {canFinalize && (
          <Button
            className="flex-1 bg-success hover:bg-success/90"
            onClick={() => onFinalize(service)}
          >
            Finalizar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Sortable card (pending / proximo) ───────────────────────────────────────

function SortableOperatorCard(props: OperatorCardBodyProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden transition-all",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none mt-1"
            aria-label="Arrastar para reordenar"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>
          <OperatorCardBody {...props} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Static card (in_progress — no drag) ─────────────────────────────────────

function StaticOperatorCard(props: OperatorCardBodyProps) {
  return (
    <Card className="overflow-hidden transition-all border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          {/* spacer matching drag-handle width */}
          <div className="w-7 shrink-0" />
          <OperatorCardBody {...props} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperatorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: pendingServicesRaw = [], isLoading: servicesLoading } = usePendingServices();
  const { data: allowedDemandTypeIds = [], isLoading: dtLoading } = useOperatorDemandTypes(user?.id);
  const { data: allowedSettlementIds = [], isLoading: stLoading } = useOperatorSettlements(user?.id);
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();

  const isLoading = servicesLoading || dtLoading || stLoading;

  // Mostra apenas os atendimentos atribuídos a este operador (operator_id).
  // Ainda respeita as restrições por tipo de serviço e por assentamento, se
  // houver (lista vazia em qualquer uma = sem restrição naquela dimensão).
  const visibleServices = useMemo(() => {
    let mine = (pendingServicesRaw as DbService[]).filter((s) => s.operator_id === user?.id);
    if (allowedDemandTypeIds.length > 0) {
      const allowedDt = new Set(allowedDemandTypeIds);
      mine = mine.filter((s) => allowedDt.has(s.demand_type_id));
    }
    if (allowedSettlementIds.length > 0) {
      const allowedSt = new Set(allowedSettlementIds);
      mine = mine.filter((s) => !s.settlement_id || allowedSt.has(s.settlement_id));
    }
    return mine;
  }, [pendingServicesRaw, allowedDemandTypeIds, allowedSettlementIds, user?.id]);

  // Ações ainda não sincronizadas (fila local). Sobrepostas à lista para que,
  // mesmo reabrindo o app OFFLINE no meio do fluxo, os já iniciados apareçam
  // "em execução" e os já finalizados sumam — evitando duplicar iniciar/finalizar.
  const { data: pendingActions = [] } = useQuery({
    queryKey: ['operator_queue_actions'],
    queryFn: getPendingActions,
    refetchInterval: 15000,
  });
  const overlaidServices = useMemo(() => {
    const startIds = new Set(pendingActions.filter((a) => a.type === 'start').map((a) => a.serviceId));
    const finishIds = new Set(pendingActions.filter((a) => a.type === 'finish').map((a) => a.serviceId));
    return visibleServices
      .filter((s) => !finishIds.has(s.id))
      .map((s) => (startIds.has(s.id)
        ? { ...s, status: 'in_progress', operator_id: user?.id ?? s.operator_id, profiles: s.profiles ?? { name: '' } }
        : s));
  }, [visibleServices, pendingActions, user?.id]);

  const updatePositions = useUpdateServicePositions();
  const syncActions = useSyncOperatorActions();
  const { data: pendingCount = 0 } = usePendingActionsCount();
  const isOnline = useOnlineStatus();

  // Iniciar: captura só GPS (sem modal). Finalizar: modal com duas fotos.
  const { getCurrentPosition } = useGeolocation();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [finalize, setFinalize] = useState<{ open: boolean; service: DbService | null }>({
    open: false, service: null,
  });

  // Sincroniza a fila offline ao (re)conectar e ao montar.
  useEffect(() => {
    if (isOnline) syncActions.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Drag and drop sensors with touch support for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Sort all non-completed services by position
  const sortedServices = useMemo(() => {
    return [...overlaidServices].sort((a, b) => {
      const posA = (a as DbService).position ?? 999999;
      const posB = (b as DbService).position ?? 999999;
      if (posA !== posB) return posA - posB;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });
  }, [overlaidServices]);

  const inProgressServices = useMemo(
    () => sortedServices.filter((s) => s.status === 'in_progress'),
    [sortedServices],
  );
  const nextServices = useMemo(
    () =>
      sortedServices
        .filter((s) => s.status !== 'in_progress')
        .sort((a, b) => {
          const rank = (s: DbService) => (s.status === 'proximo' ? 0 : 1);
          return rank(a) - rank(b);
        }),
    [sortedServices],
  );

  // Realtime (só relevante online; offline a fila local cuida do fluxo)
  useEffect(() => {
    const channel = supabase
      .channel('operator_services_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['services', 'pending'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const openFinalize = (service: DbService) => setFinalize({ open: true, service });

  // Iniciar: tenta captar o GPS automaticamente (não trava se falhar) e enfileira
  // a ação de início. Sem foto. O GPS captado alimenta o mapa "em execução".
  const handleStart = async (service: DbService) => {
    if (startingId) return;
    setStartingId(service.id);
    let coords: { latitude: number; longitude: number } | null = null;
    try { coords = await getCurrentPosition(); } catch { /* sem GPS: inicia mesmo assim */ }

    await enqueueOperatorAction({
      serviceId: service.id,
      operatorId: user?.id ?? null,
      type: 'start',
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });

    queryClient.setQueryData<DbService[]>(['services', 'pending'], (old = []) =>
      old.map((s) =>
        s.id === service.id
          ? { ...s, status: 'in_progress', operator_id: user?.id ?? null,
              latitude: coords?.latitude ?? s.latitude, longitude: coords?.longitude ?? s.longitude,
              profiles: s.profiles ?? { name: '' } }
          : s,
      ),
    );
    queryClient.invalidateQueries({ queryKey: ['operator_queue_count'] });
    queryClient.invalidateQueries({ queryKey: ['operator_queue_actions'] });

    toast({
      title: 'Atendimento iniciado',
      description: !coords
        ? 'Iniciado sem localização (GPS indisponível).'
        : (isOnline ? undefined : 'Salvo no aparelho — sincroniza quando o sinal voltar.'),
    });

    setStartingId(null);
    syncActions.mutate();
  };

  // Finalizar: recebe as duas fotos (opcionais) do modal, enfileira e sincroniza.
  const handleFinalizeConfirm = async (data: { startPhotoBlob: Blob | null; finishPhotoBlob: Blob | null }) => {
    const service = finalize.service;
    if (!service) return;

    await enqueueOperatorAction({
      serviceId: service.id,
      operatorId: user?.id ?? null,
      type: 'finish',
      photoBlob: data.finishPhotoBlob,
      startPhotoBlob: data.startPhotoBlob,
      latitude: null,
      longitude: null,
    });

    queryClient.setQueryData<DbService[]>(['services', 'pending'], (old = []) =>
      old.filter((s) => s.id !== service.id),
    );
    queryClient.invalidateQueries({ queryKey: ['operator_queue_count'] });
    queryClient.invalidateQueries({ queryKey: ['operator_queue_actions'] });

    toast({
      title: 'Atendimento finalizado',
      description: isOnline ? undefined : 'Salvo no aparelho — sincroniza quando o sinal voltar.',
    });

    syncActions.mutate();
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = nextServices.findIndex((s) => s.id === active.id);
      const newIndex = nextServices.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(nextServices, oldIndex, newIndex);
        const updates = reordered.map((service, index) => ({ id: service.id, position: index + 1 }));
        updatePositions.mutate(updates);
        toast({ title: 'Ordem atualizada!' });
      }
    }
  }, [nextServices, updatePositions, toast]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Meus Atendimentos" description="Serviços programados">
          <OnlineIndicator />
        </PageHeader>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </AppLayout>
    );
  }

  const totalServices = sortedServices.length;

  return (
    <AppLayout>
      <PageHeader title="Meus Atendimentos" description="Serviços programados">
        <OnlineIndicator />
      </PageHeader>

      {/* Aviso de itens aguardando sincronização (offline) */}
      {pendingCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <RefreshCw className={cn('h-4 w-4 shrink-0', isOnline && 'animate-spin')} />
          <span>
            {pendingCount} registro{pendingCount > 1 ? 's' : ''} aguardando sincronização
            {isOnline ? ' — enviando…' : ' — será enviado quando o sinal voltar.'}
          </span>
        </div>
      )}

      {totalServices === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum atendimento pendente
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ── Em Execução ─────────────────────────────────────────── */}
          {inProgressServices.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Em Execução
                  <span className="ml-2 font-bold text-amber-600">{inProgressServices.length}</span>
                </h2>
              </div>
              <div className="space-y-4">
                {inProgressServices.map((service: DbService) => {
                  const settlement = settlements.find(s => s.id === service.settlement_id);
                  const location = locations.find(l => l.id === service.location_id);
                  return (
                    <StaticOperatorCard
                      key={service.id}
                      service={service}
                      settlementName={settlement?.name || service.settlements?.name || 'N/A'}
                      locationName={service.producers?.location_name || location?.name || service.locations?.name || 'N/A'}
                      onStart={handleStart}
                      onFinalize={openFinalize}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Próximos Atendimentos ────────────────────────────────── */}
          {nextServices.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Próximos Atendimentos
                  <span className="ml-2 font-bold text-primary">{nextServices.length}</span>
                </h2>
                <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                  arraste para reordenar
                </span>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={nextServices.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {nextServices.map((service: DbService) => {
                      const settlement = settlements.find(s => s.id === service.settlement_id);
                      const location = locations.find(l => l.id === service.location_id);
                      return (
                        <SortableOperatorCard
                          key={service.id}
                          service={service}
                          settlementName={settlement?.name || service.settlements?.name || 'N/A'}
                          locationName={service.producers?.location_name || location?.name || service.locations?.name || 'N/A'}
                          onStart={handleStart}
                          onFinalize={openFinalize}
                          isStarting={startingId === service.id}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      )}

      <FinalizePhotosModal
        open={finalize.open}
        onOpenChange={(o) => setFinalize((f) => ({ ...f, open: o }))}
        producerName={finalize.service?.producers?.name}
        demandName={finalize.service?.demand_types?.name}
        onConfirm={handleFinalizeConfirm}
      />
    </AppLayout>
  );
}
