import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCombinedServicePhotos } from '@/hooks/useServicePhotos';
import {
  Pencil,
  Trash2,
  XCircle,
  CheckCircle,
  FileText,
  Calendar,
  CalendarClock,
  Navigation,
  Image,
  ExternalLink,
  MessageCircle,
  HardHat,
  Fuel,
  Clock,
  Layers,
  Package,
  Banknote,
  Receipt,
} from 'lucide-react';
import { isDamOverdue } from '@/lib/damUtils';
import { getUserColorClass } from '@/lib/userColors';

function buildWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
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

interface ServiceDetailViewProps {
  service: {
    id: string;
    producer_id: string;
    demand_type_id: string;
    settlement_id?: string | null;
    location_id?: string | null;
    status: string;
    scheduled_date: string;
    appointment_date?: string | null;
    created_at?: string | null;
    completed_at?: string | null;
    cancellation_reason?: string | null;
    notes?: string | null;
    completion_notes?: string | null;
    priority: string;
    operator_id?: string | null;
    machinery_id?: string | null;
    responsible_technician_id?: string | null;
    worked_area?: number | null;
    fuel_liters?: number | null;
    worked_hours?: number | null;
    limestone_quantity?: number | null;
    input_quantity?: number | null;
    dam_issued?: boolean | null;
    dam_issued_at?: string | null;
    dam_paid?: boolean | null;
    dam_paid_at?: string | null;
    dam_receipt_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    producers?: { name: string; cpf?: string; phone?: string | null } | null;
    demand_types?: { name: string } | null;
    settlements?: { name: string } | null;
    locations?: { name: string } | null;
    machinery?: { name: string; patrimony_number: string } | null;
    profiles?: { name: string } | null;
    responsible_technicians?: { name: string } | null;
  };
  producer?: { name: string; cpf: string; phone?: string; location_name?: string; latitude?: number | null; longitude?: number | null } | null;
  demandType?: { name: string } | null;
  settlement?: { name: string } | null;
  location?: { name: string } | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onFinalize?: () => void;
  onCancel?: () => void;
  onComunicado?: () => void;
}

export function ServiceDetailView({
  service,
  producer,
  demandType,
  settlement,
  location,
  onEdit,
  onDelete,
  onFinalize,
  onCancel,
  onComunicado,
}: ServiceDetailViewProps) {
  const { photos, isLoading: photosLoading } = useCombinedServicePhotos(service.id);
  const isCompleted = service.status === 'completed';
  const isCancelled = service.status === 'cancelled';

  // Métricas operacionais (planejadas no cadastro ou efetivadas na finalização)
  const hasMetrics =
    (service.fuel_liters ?? 0) > 0 || (service.worked_hours ?? 0) > 0 ||
    (service.limestone_quantity ?? 0) > 0 || (service.input_quantity ?? 0) > 0;

  const metricsGrid = (
    <div className="grid grid-cols-2 gap-3">
      {(service.fuel_liters ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-red-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Combustível</p>
            <p className="font-medium text-sm">
              {Number(service.fuel_liters).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L
            </p>
          </div>
        </div>
      )}
      {(service.worked_hours ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Horas Trabalhadas</p>
            <p className="font-medium text-sm">
              {Number(service.worked_hours).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h
            </p>
          </div>
        </div>
      )}
      {(service.limestone_quantity ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-stone-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Calcário</p>
            <p className="font-medium text-sm">
              {Number(service.limestone_quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t
            </p>
          </div>
        </div>
      )}
      {(service.input_quantity ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-purple-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Insumos</p>
            <p className="font-medium text-sm">
              {Number(service.input_quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t
            </p>
          </div>
        </div>
      )}
    </div>
  );


  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <StatusBadge status={service.status} />
      </div>

      {/* Motivo do cancelamento — destacado */}
      {isCancelled && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <Trash2 className="h-4 w-4" /> Atendimento cancelado
          </p>
          {service.cancellation_reason ? (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">Motivo:</span> {service.cancellation_reason}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Sem motivo informado.</p>
          )}
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Produtor</p>
          <p className="font-medium">{producer?.name || service.producers?.name || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">{producer?.cpf}</p>
          {(() => {
            const phone = producer?.phone || service.producers?.phone;
            if (!phone) return null;
            return (
              <a
                href={buildWhatsAppUrl(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-sm text-[#25D366] hover:text-[#25D366]/80 font-medium"
              >
                <MessageCircle className="h-4 w-4" />
                {phone}
              </a>
            );
          })()}
        </div>

        {(() => {
          const lat = producer?.latitude ?? null;
          const lng = producer?.longitude ?? null;
          if (!lat || !lng) return null;
          return (
            <div>
              <p className="text-sm text-muted-foreground">Localização do Produtor</p>
              <button
                onClick={() => openInMaps(lat, lng)}
                className="flex items-center gap-1.5 mt-0.5 text-sm text-blue-600 hover:text-blue-500 font-mono"
              >
                <Navigation className="h-3.5 w-3.5 shrink-0" />
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </button>
            </div>
          );
        })()}

        <div>
          <p className="text-sm text-muted-foreground">Tipo de Demanda</p>
          <p className="font-medium">{demandType?.name || service.demand_types?.name || 'N/A'}</p>
        </div>

        <div className="flex gap-4">
          {service.worked_area != null && service.worked_area > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Área Trabalhada</p>
              <p className="font-medium">{service.worked_area} ha</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Prioridade</p>
            <p className="font-medium">
              {service.priority === 'high' ? '🔴 Alta' : service.priority === 'medium' ? '🟡 Média' : '🟢 Baixa'}
            </p>
          </div>
        </div>

        {service.machinery && (
          <div>
            <p className="text-sm text-muted-foreground">Maquinário</p>
            <p className="font-medium">{service.machinery.name}</p>
            <p className="text-sm text-muted-foreground">Patrimônio: {service.machinery.patrimony_number}</p>
          </div>
        )}

        {service.responsible_technicians?.name && (
          <div className="flex items-center gap-2">
            <HardHat className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Responsável Técnico</p>
              <p className="font-medium">{service.responsible_technicians.name}</p>
            </div>
          </div>
        )}

        {service.appointment_date && (
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Data de Agendamento</p>
              <p className="font-medium">
                {format(new Date(service.appointment_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground">Localização</p>
          <p className="font-medium">{settlement?.name || service.settlements?.name || 'N/A'}</p>
          <p className="text-sm">{producer?.location_name || location?.name || service.locations?.name || 'N/A'}</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Data de Cadastro</p>
            <p className="font-medium">
              {service.created_at
                ? format(new Date(service.created_at.replace(' ', 'T')), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : format(new Date(service.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>

        {service.profiles?.name && (
          <div>
            <p className="text-sm text-muted-foreground">Cadastrado por</p>
            <p className={`font-medium ${getUserColorClass(service.profiles.name)}`}>{service.profiles.name}</p>
          </div>
        )}

        {service.notes && (
          <div>
            <p className="text-sm text-muted-foreground">Observações</p>
            <p className="font-medium">{service.notes}</p>
          </div>
        )}

        {/* Dados operacionais planejados — exibidos quando ainda não finalizado
            (no completed os valores efetivados aparecem no bloco de finalização) */}
        {hasMetrics && !isCompleted && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Dados do Atendimento</p>
            {metricsGrid}
          </div>
        )}
      </div>

      {/* DAM Section — shown whenever a DAM has been issued */}
      {service.dam_issued && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              DAM – Documento de Arrecadação Municipal
            </h3>

            {service.dam_issued_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Emitido em</p>
                  <p className="font-medium">
                    {format(new Date(service.dam_issued_at + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            {service.dam_paid ? (
              <div className="rounded-lg bg-success/10 border border-success/30 p-3 space-y-1">
                <p className="text-sm font-semibold text-success flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" /> Pago
                </p>
                {service.dam_paid_at && (
                  <p className="text-sm text-muted-foreground">
                    Em {format(new Date(service.dam_paid_at + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                )}
                {service.dam_receipt_url && (
                  <a
                    href={service.dam_receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Ver comprovante
                  </a>
                )}
              </div>
            ) : isDamOverdue(service.dam_issued_at, service.dam_paid) ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-sm font-semibold text-destructive">⚠ Pagamento em atraso</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prazo de 30 dias expirado</p>
              </div>
            ) : (
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                <p className="text-sm font-semibold text-warning-foreground">Aguardando pagamento</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Completion Info - Only for archived services */}
      {isCompleted && (
        <>
          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-primary">Informações da Finalização</h3>

            {service.completed_at && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Finalizado em</p>
                  <p className="font-medium">
                    {format(new Date(service.completed_at!.replace(' ', 'T')), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            {service.completion_notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas de Finalização</p>
                <p className="font-medium">{service.completion_notes}</p>
              </div>
            )}

            {/* Operational metrics — shown only when present */}
            {hasMetrics && metricsGrid}

            {service.latitude && service.longitude ? (
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Coordenadas GPS</p>
                  <p className="font-mono text-sm">
                    {service.latitude.toFixed(6)}, {service.longitude.toFixed(6)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openInMaps(service.latitude!, service.longitude!)}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Mapa
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="h-4 w-4" />
                <p className="text-sm">GPS não capturado</p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Fotos do Atendimento</p>
              </div>

              {photosLoading ? (
                <Skeleton className="h-48 w-32 rounded-lg" />
              ) : photos.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="aspect-[9/16] h-48 flex-shrink-0 rounded-lg overflow-hidden border">
                      <img
                        src={photo.url}
                        alt="Foto do atendimento"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(photo.url, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">
                  Nenhuma foto registrada
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="flex flex-col gap-2">
        {!isCompleted && !isCancelled && onFinalize && (
          <Button
            onClick={onFinalize}
            className="w-full bg-success hover:bg-success/90"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizar Atendimento
          </Button>
        )}
        {onComunicado && (
          <Button variant="outline" onClick={onComunicado} className="w-full">
            <FileText className="h-4 w-4 mr-2" />
            Emitir Comunicado (DAM)
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" onClick={onEdit} className="w-full">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
        {!isCompleted && !isCancelled && onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar Atendimento
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} className="w-full">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
}
