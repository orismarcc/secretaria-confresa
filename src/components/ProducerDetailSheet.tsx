import { Producer, Settlement, Location, DemandType } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, MapPin, Phone, User, FileText, Home, Navigation, ExternalLink, ClipboardList, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServicesByProducer } from '@/hooks/useSupabaseData';
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
  const { data: services = [], isLoading: servicesLoading } = useServicesByProducer(
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
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium">{producer.cpf}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{producer.phone || 'Não informado'}</p>
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

          {/* Histórico de atendimentos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Histórico de Atendimentos</p>
              {services.length > 0 && (
                <Badge variant="secondary" className="text-xs">{services.length}</Badge>
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

            {servicesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
                Nenhum atendimento registrado
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(services as any[])
                  .slice()
                  .sort((a: any, b: any) => {
                    // Most recent first: prefer completed_at, fallback to scheduled_date
                    const aDate = a.completed_at || a.scheduled_date;
                    const bDate = b.completed_at || b.scheduled_date;
                    return new Date(bDate).getTime() - new Date(aDate).getTime();
                  })
                  .map((s: any) => {
                    const isCompleted = s.status === 'completed';
                    const completedAt = s.completed_at
                      ? format(new Date(s.completed_at.replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR })
                      : null;
                    const scheduledDate = s.scheduled_date
                      ? format(new Date(s.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                      : null;

                    return (
                      <div
                        key={s.id}
                        className={`flex items-start justify-between gap-2 p-3 rounded-lg border ${
                          isCompleted
                            ? 'bg-success/5 border-success/20'
                            : 'bg-muted/30 border-border/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{s.demand_types?.name || 'N/A'}</p>
                          {isCompleted && completedAt ? (
                            <p className="text-xs font-semibold text-success mt-0.5">
                              ✓ Finalizado em {completedAt}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Cadastro: {scheduledDate}
                            </p>
                          )}
                          {s.settlements?.name && (
                            <p className="text-xs text-muted-foreground truncate">{s.settlements.name}</p>
                          )}
                          {/* DAM status */}
                          {isDamOverdue(s) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 rounded px-1.5 py-0.5 mt-0.5">
                              ⚠ DAM em atraso
                            </span>
                          )}
                          {s.dam_issued && !s.dam_paid && !isDamOverdue(s) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 rounded px-1.5 py-0.5 mt-0.5">
                              DAM pendente
                            </span>
                          )}
                          {s.dam_issued && s.dam_paid && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 rounded px-1.5 py-0.5 mt-0.5">
                              DAM paga
                            </span>
                          )}
                        </div>
                        <StatusBadge status={s.status as 'pending' | 'in_progress' | 'completed'} />
                      </div>
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
