import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, Phone, Calendar, Clock, GripVertical, Navigation, User, Users, ChevronDown, MessageCircle, RefreshCw, CheckCircle2, Banknote, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineIndicator } from '@/components/ConnectionStatus';
import { FinalizePhotosModal } from '@/components/FinalizePhotosModal';
import { SinglePhotoModal } from '@/components/SinglePhotoModal';
import { isLogisticsCategory } from '@/lib/logistica';
import { OperatorCompletedList } from '@/components/OperatorCompletedList';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  useOperatorGlebas,
  useGlebas,
  useOperatorOwnStats,
  useOperatorCompletedServices,
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
  dam_paid?: boolean | null;
  dam_issued?: boolean | null;
  /** Logística: momento em que o carregamento foi registrado ("Entrega"). */
  loaded_at?: string | null;
  producers?: { name: string; phone?: string | null; location_name?: string | null; latitude?: number | null; longitude?: number | null } | null;
  demand_types?: { name: string; category?: string | null } | null;
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
  /** Nome do colega em cujo nome o atendimento está (assentamento compartilhado). */
  sharedFrom?: string | null;
  /** Logística: registrar o carregamento ("Entrega"). */
  onLoad?: (service: DbService) => void;
  /** Texto de espera (ex.: obtendo localização) — bloqueia os botões. */
  busyLabel?: string | null;
}

function OperatorCardBody({
  service,
  settlementName,
  locationName,
  onStart,
  onFinalize,
  isStarting,
  sharedFrom,
  onLoad,
  busyLabel,
}: OperatorCardBodyProps) {
  const canStart = service.status === 'pending' || service.status === 'proximo';
  // Só finaliza depois de iniciar (passa por "em execução") e só o que é seu.
  const isMineInProgress = service.status === 'in_progress' && !sharedFrom;
  // Logística (calcário/insumos): antes de finalizar, registra o carregamento.
  const isLogistics = isLogisticsCategory(service.demand_types?.category);
  const needsLoad = isLogistics && isMineInProgress && !service.loaded_at;
  const canFinalize = isMineInProgress && !needsLoad;
  const loadedAt = service.loaded_at ? new Date(String(service.loaded_at).replace(' ', 'T')) : null;
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
          {!sharedFrom && service.status === 'in_progress' && service.profiles?.name && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {service.profiles.name}
            </span>
          )}
        </div>
      </div>

      {/* Atendimento do colega (assentamento compartilhado): quem está e o que acontece ao agir */}
      {sharedFrom && service.status !== 'in_progress' && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-violet-300/60 bg-violet-500/10 px-2.5 py-1.5 text-xs text-violet-800 dark:text-violet-300">
          <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Cadastrado para <strong>{sharedFrom}</strong> — se você iniciar, o atendimento passa para você.</span>
        </div>
      )}

      {/* Logística em execução: diz ao operador qual é o próximo passo */}
      {isLogistics && isMineInProgress && (
        needsLoad ? (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            <Truck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>No local de carregamento, toque em <strong>Entrega</strong> e tire a foto do caminhão sendo carregado.</span>
          </div>
        ) : (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-emerald-300/70 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Carregado{loadedAt && !Number.isNaN(loadedAt.getTime()) ? ` às ${format(loadedAt, 'HH:mm')}` : ''}.
              {' '}Na propriedade do produtor, toque em <strong>Finalizar</strong> e tire a foto da entrega.
            </span>
          </div>
        )
      )}

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
        {/* Status da DAM (paga ou não) */}
        {(() => {
          const damPaid = (service as any).dam_paid === true;
          return (
            <div className="flex items-center gap-2">
              <Banknote className={cn('h-4 w-4 shrink-0', damPaid ? 'text-success' : 'text-amber-600')} />
              <span className={cn(
                'text-xs font-semibold rounded-full px-2 py-0.5',
                damPaid ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
              )}>
                {damPaid ? 'DAM paga' : 'DAM não paga'}
              </span>
            </div>
          );
        })()}
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
        {busyLabel ? (
          <Button className="flex-1" disabled>{busyLabel}</Button>
        ) : (
          <>
            {canStart && (
              <Button className="flex-1" onClick={() => onStart(service)} disabled={isStarting}>
                {isStarting ? 'Iniciando…' : 'Iniciar'}
              </Button>
            )}
            {needsLoad && onLoad && (
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-600/90 text-white"
                onClick={() => onLoad(service)}
              >
                <Truck className="h-4 w-4 mr-2" /> Entrega
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Em execução por colegas (recolhido, sem ações) ──────────────────────────
// Atendimentos que OUTRO operador do mesmo assentamento está executando. Ficam
// recolhidos e sem botões para não confundir: só quem iniciou pode finalizar.

function ColleagueInProgressSection({ items }: {
  items: { service: DbService; local: string; who: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-dashed bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Em execução por outros operadores
          <span className="ml-2 font-bold">{items.length}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {!open && (
        <p className="px-3 pb-2.5 -mt-1 text-[11px] text-muted-foreground">
          Apenas para consulta — só quem iniciou pode finalizar.
        </p>
      )}
      {open && (
        <div className="border-t divide-y">
          {items.map(({ service, local, who }) => (
            <div key={service.id} className="px-3 py-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground/80 truncate">{service.producers?.name || 'Produtor'}</p>
              <p className="text-xs truncate">{service.demand_types?.name || 'Serviço'} · {local}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-violet-700 dark:text-violet-400">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">Em execução por <strong>{who}</strong></span>
              </p>
            </div>
          ))}
        </div>
      )}
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
  const { data: allowedGlebaIds = [], isLoading: gLoading } = useOperatorGlebas(user?.id);
  const { data: glebas = [] } = useGlebas();
  const { data: ownStats } = useOperatorOwnStats(user?.id);
  const [view, setView] = useState<'abertos' | 'finalizados'>('abertos');
  const { data: completedServices = [], isLoading: completedLoading } = useOperatorCompletedServices(user?.id);
  // Métricas por período — padrão no ano atual; seletor (com "Todos os
  // períodos") só aparece se houver atendimentos de outros anos.
  const currentYear = new Date().getFullYear();
  const [statsPeriod, setStatsPeriod] = useState<'all' | number>(currentYear);
  const statYearOptions = useMemo(() => {
    const set = new Set<number>([currentYear, ...((ownStats?.years) ?? [])]);
    return Array.from(set).sort((a, b) => b - a);
  }, [ownStats, currentYear]);
  const showYearSelect = ((ownStats?.years) ?? []).some((y) => y !== currentYear);
  const yearStats = statsPeriod === 'all'
    ? (ownStats?.all ?? { total: 0, hours: 0, assentamentos: 0 })
    : (ownStats?.byYear?.[statsPeriod] ?? { total: 0, hours: 0, assentamentos: 0 });
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();

  const isLoading = servicesLoading || dtLoading || stLoading || gLoading;

  // Assentamentos com restrição de gleba: onde o operador tem glebas selecionadas.
  const glebaRestriction = useMemo(() => {
    const allowedGleba = new Set(allowedGlebaIds as string[]);
    const glebaSettlement = new Map<string, string>((glebas as any[]).map((g) => [g.id, g.settlement_id]));
    const restrictedSettlements = new Set<string>();
    (allowedGlebaIds as string[]).forEach((gid) => {
      const sid = glebaSettlement.get(gid);
      if (sid) restrictedSettlements.add(sid);
    });
    return { allowedGleba, restrictedSettlements };
  }, [allowedGlebaIds, glebas]);

  // Mostra os atendimentos atribuídos a este operador (operator_id) e também os
  // de COLEGAS nos assentamentos em que ele está cadastrado explicitamente
  // (operadores que dividem o assentamento). Ao iniciar/finalizar um desses, o
  // atendimento passa para quem executou — regra espelhada no banco
  // (operator_shares_service). Respeita restrições por tipo de serviço,
  // assentamento e gleba (lista vazia = sem restrição naquela dimensão).
  const visibleServices = useMemo(() => {
    const mySettlements = new Set(allowedSettlementIds as string[]);
    let mine = (pendingServicesRaw as DbService[]).filter((s) =>
      s.operator_id === user?.id ||
      (!!s.operator_id && !!s.settlement_id && mySettlements.has(s.settlement_id)));
    if (allowedDemandTypeIds.length > 0) {
      const allowedDt = new Set(allowedDemandTypeIds);
      mine = mine.filter((s) => allowedDt.has(s.demand_type_id));
    }
    if (allowedSettlementIds.length > 0) {
      const allowedSt = new Set(allowedSettlementIds);
      mine = mine.filter((s) => !s.settlement_id || allowedSt.has(s.settlement_id));
    }
    if (glebaRestriction.restrictedSettlements.size > 0) {
      mine = mine.filter((s) => {
        if (!s.settlement_id || !glebaRestriction.restrictedSettlements.has(s.settlement_id)) return true;
        const gid = (s.producers as any)?.gleba_id;
        return gid && glebaRestriction.allowedGleba.has(gid);
      });
    }
    return mine;
  }, [pendingServicesRaw, allowedDemandTypeIds, allowedSettlementIds, glebaRestriction, user?.id]);

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
    // Carregamento registrado offline: libera o Finalizar mesmo sem sinal.
    const loadedAt = new Map(pendingActions.filter((a) => a.type === 'load').map((a) => [a.serviceId, a.capturedAt]));
    return visibleServices
      .filter((s) => !finishIds.has(s.id))
      .map((s) => (startIds.has(s.id)
        ? { ...s, status: 'in_progress', operator_id: user?.id ?? s.operator_id, profiles: s.profiles ?? { name: '' } }
        : s))
      .map((s) => (loadedAt.has(s.id) && !s.loaded_at ? { ...s, loaded_at: loadedAt.get(s.id) } : s));
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
  // Logística: modal de UMA foto — 'load' (Entrega = carregamento) ou 'finish'.
  const [photoStep, setPhotoStep] = useState<{ open: boolean; mode: 'load' | 'finish'; service: DbService | null }>({
    open: false, mode: 'load', service: null,
  });
  // Card aguardando GPS depois da foto (bloqueia botões e mostra o motivo).
  const [busy, setBusy] = useState<{ id: string; label: string } | null>(null);

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

  // Em execução: os MEUS (ou sem operador) primeiro, com ações. Os de colegas
  // ficam à parte, recolhidos e sem ações — só quem iniciou pode finalizar
  // (regra também garantida no banco).
  const inProgressServices = useMemo(
    () => sortedServices.filter((s) => s.status === 'in_progress' && (!s.operator_id || s.operator_id === user?.id)),
    [sortedServices, user?.id],
  );
  const colleagueInProgress = useMemo(
    () => sortedServices.filter((s) => s.status === 'in_progress' && !!s.operator_id && s.operator_id !== user?.id),
    [sortedServices, user?.id],
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

  const openFinalize = (service: DbService) => {
    if (isLogisticsCategory(service.demand_types?.category)) {
      setPhotoStep({ open: true, mode: 'finish', service });
    } else {
      setFinalize({ open: true, service });
    }
  };
  const openLoad = (service: DbService) => setPhotoStep({ open: true, mode: 'load', service });

  // Atendimento em nome de um colega (assentamento compartilhado): nome dele.
  const sharedFromOf = (service: DbService) =>
    service.operator_id && service.operator_id !== user?.id ? (service.profiles?.name || 'outro operador') : null;

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

  // Logística: foto obrigatória + GPS automático. 'load' registra o carregamento
  // (o atendimento segue em execução); 'finish' finaliza com o GPS da entrega.
  const handlePhotoStepConfirm = async (photo: Blob) => {
    const { mode, service } = photoStep;
    if (!service) return;
    setBusy({ id: service.id, label: 'Obtendo localização…' });
    let coords: { latitude: number; longitude: number } | null = null;
    try { coords = await getCurrentPosition(); } catch { /* sem GPS: registra mesmo assim */ }

    try {
      await enqueueOperatorAction({
        serviceId: service.id,
        operatorId: user?.id ?? null,
        type: mode === 'load' ? 'load' : 'finish',
        photoBlob: photo,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
    } finally {
      setBusy(null);
    }

    if (mode === 'load') {
      const now = new Date().toISOString();
      queryClient.setQueryData<DbService[]>(['services', 'pending'], (old = []) =>
        old.map((s) => (s.id === service.id ? { ...s, loaded_at: now } : s)),
      );
    } else {
      queryClient.setQueryData<DbService[]>(['services', 'pending'], (old = []) =>
        old.filter((s) => s.id !== service.id),
      );
    }
    queryClient.invalidateQueries({ queryKey: ['operator_queue_count'] });
    queryClient.invalidateQueries({ queryKey: ['operator_queue_actions'] });

    toast({
      title: mode === 'load' ? 'Carregamento registrado' : 'Entrega finalizada',
      description: !coords
        ? 'Registrado sem localização (GPS indisponível).'
        : (isOnline ? undefined : 'Salvo no aparelho — sincroniza quando o sinal voltar.'),
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

  // Só o que o operador pode agir (não conta os em execução por colegas).
  const totalServices = sortedServices.length - colleagueInProgress.length;
  const localOf = (service: DbService) => {
    const settlement = settlements.find((st) => st.id === service.settlement_id);
    const location = locations.find((l) => l.id === service.location_id);
    return `${settlement?.name || service.settlements?.name || 'N/A'} - ${service.producers?.location_name || location?.name || service.locations?.name || 'N/A'}`;
  };

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

      {/* Minhas métricas por ano — padrão no ano atual */}
      {ownStats && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Minhas métricas
            </p>
            {showYearSelect ? (
              <Select value={String(statsPeriod)} onValueChange={(v) => setStatsPeriod(v === 'all' ? 'all' : Number(v))}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statYearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  <SelectItem value="all">Todos os períodos</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">{currentYear}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <CheckCircle2 className="h-4 w-4 mx-auto text-success mb-1" />
              <p className="text-2xl font-bold leading-none">{yearStats.total}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-1">atendimentos finalizados</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold leading-none">{yearStats.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-1">horas realizadas</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <MapPin className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold leading-none">{yearStats.assentamentos}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-1">assentamentos atendidos</p>
            </div>
          </div>
        </div>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as 'abertos' | 'finalizados')} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="abertos" className="gap-2">
            A realizar
            <span className="bg-muted px-1.5 py-0.5 rounded-full text-xs">{totalServices}</span>
          </TabsTrigger>
          <TabsTrigger value="finalizados" className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Finalizados
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'finalizados' ? (
        <OperatorCompletedList services={completedServices} isLoading={completedLoading} />
      ) : (
        <div className="space-y-6">
          {totalServices === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum atendimento pendente
              </CardContent>
            </Card>
          )}

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
                      sharedFrom={sharedFromOf(service)}
                      onLoad={openLoad}
                      busyLabel={busy?.id === service.id ? busy.label : null}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Em execução por colegas: recolhido, depois dos meus ──── */}
          {colleagueInProgress.length > 0 && (
            <ColleagueInProgressSection
              items={colleagueInProgress.map((service) => ({
                service,
                local: localOf(service),
                who: service.profiles?.name || 'outro operador',
              }))}
            />
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
                          sharedFrom={sharedFromOf(service)}
                          onLoad={openLoad}
                          busyLabel={busy?.id === service.id ? busy.label : null}
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

      <SinglePhotoModal
        open={photoStep.open}
        onOpenChange={(o) => setPhotoStep((st) => ({ ...st, open: o }))}
        title={photoStep.mode === 'load' ? 'Entrega — carregamento' : 'Finalizar entrega'}
        subtitle={[photoStep.service?.producers?.name, photoStep.service?.demand_types?.name].filter(Boolean).join(' — ')}
        photoLabel={photoStep.mode === 'load' ? 'Foto do caminhão sendo carregado' : 'Foto da entrega na propriedade'}
        hint={photoStep.mode === 'load'
          ? 'Ao confirmar, a localização do local de carregamento é registrada automaticamente.'
          : 'Ao confirmar, a localização da entrega (propriedade do produtor) é registrada automaticamente e o atendimento é finalizado.'}
        confirmLabel={photoStep.mode === 'load' ? 'Registrar carregamento' : 'Finalizar'}
        confirmClassName={photoStep.mode === 'load'
          ? 'flex-1 bg-amber-600 hover:bg-amber-600/90 text-white'
          : 'flex-1 bg-success hover:bg-success/90'}
        onConfirm={handlePhotoStepConfirm}
      />
    </AppLayout>
  );
}
