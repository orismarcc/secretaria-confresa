import { Producer, Settlement, Location, DemandType } from '@/types';
import { documentLabel } from '@/lib/documents';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pencil, Trash2, MapPin, Phone, User, FileText, Home, Navigation,
  ExternalLink, ClipboardList, AlertTriangle, MessageCircle, Eye,
  Tractor, Layers, Truck, Package,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openWhatsApp } from '@/lib/phone';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServicesByProducer, useDeliveriesByProducer } from '@/hooks/useSupabaseData';
import { StatusBadge } from '@/components/StatusBadge';

function isDamOverdue(s: any): boolean {
  if (!s.dam_issued || s.dam_paid) return false;
  if (!s.dam_issued_at) return false;
  const issued = new Date(s.dam_issued_at + 'T12:00:00');
  return (Date.now() - issued.getTime()) / (1000 * 60 * 60 * 24) > 30;
}

function openInMaps(lat: number, lng: number) {
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
    setTimeout(() => window.open(googleMapsUrl, '_blank', 'noopener,noreferrer'), 500);
  } else {
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  }
}

/** Format a number with pt-BR locale, stripping trailing zeros */
function fmtNum(n: number, decimals = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

interface ProducerDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producer: Producer | null;
  settlement?: Settlement;
  location?: Location;
  demandTypes: DemandType[];
  onEdit: (producer: Producer) => void;
  onDelete: (producer: Producer) => void;
}

export function ProducerDetailSheet({
  open,
  onOpenChange,
  producer,
  settlement,
  location,
  demandTypes,
  onEdit,
  onDelete,
}: ProducerDetailSheetProps) {
  const navigate = useNavigate();

  const { data: services = [], isLoading: servicesLoading } = useServicesByProducer(
    open ? producer?.id : undefined
  );
  const { data: deliveries = [], isLoading: deliveriesLoading } = useDeliveriesByProducer(
    open ? producer?.id : undefined
  );

  if (!producer) return null;

  const producerDemandTypes = demandTypes.filter(d =>
    producer.demandTypeIds.includes(d.id)
  );

  const handleEdit = () => {
    onOpenChange(false);
    onEdit(producer);
  };

  const handleDelete = () => {
    onOpenChange(false);
    onDelete(producer);
  };

  // ── Build unified history ────────────────────────────────────────────────────
  type HistoryItem = {
    id: string;
    type: 'service' | 'delivery';
    sortDate: string;
    raw: any;
  };

  const history: HistoryItem[] = [
    ...(services as any[]).map(s => ({
      id: s.id,
      type: 'service' as const,
      sortDate: s.completed_at || s.scheduled_date,
      raw: s,
    })),
    ...(deliveries as any[]).map(d => ({
      id: d.id,
      type: 'delivery' as const,
      sortDate: d.completed_at || d.created_at,
      raw: d,
    })),
  ].sort((a, b) => {
    // Supabase returns timestamps with a space separator ("2026-05-01 14:00:00+00"),
    // which is invalid in Safari. Normalise to ISO before parsing.
    const parse = (d: string) => new Date(d.replace(' ', 'T')).getTime();
    return parse(b.sortDate) - parse(a.sortDate);
  });

  const isHistoryLoading = servicesLoading || deliveriesLoading;

  // ── Navigate to detail ───────────────────────────────────────────────────────
  const handleViewService = (serviceId: string) => {
    onOpenChange(false);
    navigate(`/services?detail=${serviceId}`);
  };

  const handleViewDelivery = (deliveryId: string) => {
    onOpenChange(false);
    navigate(`/deliveries?detail=${deliveryId}`);
  };

  // ── Service card metadata ────────────────────────────────────────────────────
  function ServiceMeta({ s }: { s: any }) {
    const category = s.demand_types?.category as string | undefined;
    const bits: React.ReactNode[] = [];

    if (s.worked_area) {
      bits.push(
        <span key="area" className="inline-flex items-center gap-0.5 text-[11px] bg-amber-500/10 text-amber-700 rounded px-1.5 py-0.5 font-medium">
          {fmtNum(Number(s.worked_area))} ha
        </span>
      );
    }

    if ((category === 'patrulha_mecanizada' || category === 'logistica_insumos') && s.worked_hours) {
      bits.push(
        <span key="hours" className="inline-flex items-center gap-0.5 text-[11px] bg-blue-500/10 text-blue-700 rounded px-1.5 py-0.5 font-medium">
          <Tractor className="h-3 w-3" />
          {fmtNum(Number(s.worked_hours))} h
        </span>
      );
    }

    if ((category === 'patrulha_mecanizada' || category === 'logistica_insumos') && s.fuel_liters) {
      bits.push(
        <span key="fuel" className="inline-flex items-center gap-0.5 text-[11px] bg-red-500/10 text-red-700 rounded px-1.5 py-0.5 font-medium">
          {fmtNum(Number(s.fuel_liters))} L
        </span>
      );
    }

    if (category === 'calcario' && s.limestone_quantity) {
      bits.push(
        <span key="calc" className="inline-flex items-center gap-0.5 text-[11px] bg-stone-500/10 text-stone-700 rounded px-1.5 py-0.5 font-medium">
          <Layers className="h-3 w-3" />
          {fmtNum(Number(s.limestone_quantity))} ton
        </span>
      );
    }

    if (category === 'logistica_insumos' && s.input_quantity) {
      bits.push(
        <span key="input" className="inline-flex items-center gap-0.5 text-[11px] bg-purple-500/10 text-purple-700 rounded px-1.5 py-0.5 font-medium">
          <Truck className="h-3 w-3" />
          {fmtNum(Number(s.input_quantity))} ton
        </span>
      );
    }

    if (bits.length === 0) return null;
    return <div className="flex flex-wrap gap-1 mt-1">{bits}</div>;
  }

  // ── Delivery card metadata ───────────────────────────────────────────────────
  function DeliveryMeta({ d }: { d: any }) {
    const items = (d.delivery_items ?? []) as any[];
    const hasItems = items.length > 0;
    const directQty = d.quantity != null ? Number(d.quantity) : null;

    if (!hasItems && directQty == null) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {hasItems ? (
          items.map((item: any, idx: number) => (
            <span key={idx} className="inline-flex items-center gap-0.5 text-[11px] bg-blue-500/10 text-blue-700 rounded px-1.5 py-0.5 font-medium">
              <Package className="h-3 w-3" />
              {fmtNum(Number(item.quantity))} {item.delivery_lots?.unit || 'un'} — {item.delivery_lots?.name || 'Lote'}
            </span>
          ))
        ) : (
          directQty != null && (
            <span className="inline-flex items-center gap-0.5 text-[11px] bg-blue-500/10 text-blue-700 rounded px-1.5 py-0.5 font-medium">
              <Package className="h-3 w-3" />
              {fmtNum(directQty)} un entregues
            </span>
          )
        )}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">Detalhes do Produtor</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Info principal */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{producer.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{documentLabel(producer.cpf)}</p>
                <p className="font-medium">{producer.cpf}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                {producer.phone ? (
                  <button
                    onClick={() => openWhatsApp(producer.phone!)}
                    className="flex items-center gap-1.5 mt-0.5 text-sm text-success hover:text-success/80 font-medium"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {producer.phone}
                  </button>
                ) : (
                  <p className="font-medium text-muted-foreground">Não informado</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Assentamento</p>
                <p className="font-medium">{settlement?.name || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Localidade</p>
                <p className="font-medium">{producer.locationName || 'Não informada'}</p>
              </div>
            </div>

            {producer.latitude && producer.longitude && (
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Coordenadas GPS</p>
                  <button
                    onClick={() => openInMaps(producer.latitude!, producer.longitude!)}
                    className="flex items-center gap-1.5 mt-0.5 text-sm text-blue-600 hover:text-blue-500 font-mono"
                  >
                    {producer.latitude.toFixed(6)}, {producer.longitude.toFixed(6)}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Tipos de demanda */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tipos de Demanda</p>
            <div className="flex flex-wrap gap-2">
              {producerDemandTypes.length > 0 ? (
                producerDemandTypes.map(d => (
                  <span
                    key={d.id}
                    className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-md"
                  >
                    {d.name}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">Nenhum tipo vinculado</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Histórico de atendimentos + entregas */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Histórico</p>
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs">{history.length}</Badge>
              )}
            </div>

            {/* DAM overdue alert */}
            {(() => {
              const overdueServices = (services as any[]).filter(isDamOverdue);
              if (overdueServices.length === 0) return null;
              return (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">DAM em atraso</p>
                    <p className="text-xs text-destructive/80 mt-0.5">
                      {overdueServices.length === 1
                        ? 'Este produtor possui 1 DAM emitida há mais de 30 dias sem pagamento.'
                        : `Este produtor possui ${overdueServices.length} DAMs emitidas há mais de 30 dias sem pagamento.`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {isHistoryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
                Nenhum atendimento ou entrega registrado
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {history.map((item) => {
                  if (item.type === 'service') {
                    const s = item.raw;
                    const isCompleted = s.status === 'completed';
                    const isCancelled = s.status === 'cancelled';
                    const completedAt = s.completed_at
                      ? format(new Date(s.completed_at.replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR })
                      : null;
                    const scheduledDate = s.scheduled_date
                      ? format(new Date(s.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                      : null;

                    return (
                      <button
                        key={`svc-${s.id}`}
                        type="button"
                        onClick={() => handleViewService(s.id)}
                        className={`w-full text-left flex items-start justify-between gap-2 p-3 rounded-lg border transition-all hover:shadow-sm hover:-translate-y-0.5 ${
                          isCompleted
                            ? 'bg-success/5 border-success/20 hover:border-success/40'
                            : isCancelled
                            ? 'bg-destructive/5 border-destructive/20 hover:border-destructive/40'
                            : 'bg-muted/30 border-border/50 hover:border-border'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium truncate ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>
                              {s.demand_types?.name || 'N/A'}
                            </p>
                          </div>
                          {isCompleted && completedAt ? (
                            <p className="text-xs font-semibold text-success mt-0.5">
                              ✓ Finalizado em {completedAt}
                            </p>
                          ) : isCancelled ? (
                            <p className="text-xs font-semibold text-destructive mt-0.5">
                              ✕ Cancelado{s.cancellation_reason ? `: ${s.cancellation_reason}` : ''}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Cadastro: {scheduledDate}
                            </p>
                          )}
                          {!isCancelled && <ServiceMeta s={s} />}
                          {isDamOverdue(s) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 rounded px-1.5 py-0.5 mt-1">
                              ⚠ DAM em atraso
                            </span>
                          )}
                          {s.dam_issued && !s.dam_paid && !isDamOverdue(s) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 rounded px-1.5 py-0.5 mt-1">
                              DAM pendente
                            </span>
                          )}
                          {s.dam_issued && s.dam_paid && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 rounded px-1.5 py-0.5 mt-1">
                              DAM paga
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <StatusBadge status={s.status as 'pending' | 'in_progress' | 'completed'} />
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  }

                  // Delivery card
                  const d = item.raw;
                  const isCompleted = d.status === 'completed';
                  const completedAt = d.completed_at
                    ? format(new Date(d.completed_at.replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR })
                    : null;
                  const createdAt = d.created_at
                    ? format(new Date(d.created_at.replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR })
                    : null;

                  return (
                    <button
                      key={`del-${d.id}`}
                      type="button"
                      onClick={() => handleViewDelivery(d.id)}
                      className={`w-full text-left flex items-start justify-between gap-2 p-3 rounded-lg border transition-all hover:shadow-sm hover:-translate-y-0.5 ${
                        isCompleted
                          ? 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40'
                          : 'bg-muted/30 border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <p className="text-sm font-medium truncate">
                            {d.demand_types?.name || 'Entrega'}
                          </p>
                        </div>
                        {isCompleted && completedAt ? (
                          <p className="text-xs font-semibold text-blue-600 mt-0.5">
                            ✓ Realizada em {completedAt}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cadastro: {createdAt}
                          </p>
                        )}
                        <DeliveryMeta d={d} />
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0.5 ${
                            isCompleted
                              ? 'border-blue-500/40 text-blue-600 bg-blue-500/10'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {isCompleted ? 'Realizada' : 'Pendente'}
                        </Badge>
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex flex-col gap-2">
            <Button onClick={handleEdit} className="w-full">
              <Pencil className="h-4 w-4 mr-2" />
              Editar Produtor
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Produtor
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
