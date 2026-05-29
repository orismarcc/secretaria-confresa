import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin, User, Calendar, Hash, DollarSign, AlertTriangle,
  Pencil, ArrowRightLeft, MessageCircle, Clock, ChevronRight,
  Building2, X, Navigation, ExternalLink,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { openWhatsApp } from '@/lib/phone';
import { usePatrimonyTransfers } from '@/hooks/useSupabaseData';

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition = 'otimo' | 'bom' | 'ruim' | 'pessimo';

export interface PatrimonyDetailItem {
  id: string;
  name: string;
  patrimony_number: string;
  patrimony_number_state?: string | null;
  description: string | null;
  value: number | null;
  category: string | null;
  acquisition_date: string | null;
  written_off: boolean;
  condition: Condition | null;
  location: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  image_url: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string | null;
}

interface PatrimonyTransferRecord {
  id: string;
  transferred_at: string;
  location: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  condition: Condition | null;
  notes: string | null;
  created_at: string | null;
}

interface PatrimonyDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PatrimonyDetailItem | null;
  onEdit: (item: PatrimonyDetailItem) => void;
  onTransfer: (item: PatrimonyDetailItem) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function openInMaps(lat: number, lng: number) {
  const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
    setTimeout(() => window.open(googleUrl, '_blank', 'noopener,noreferrer'), 500);
  } else {
    window.open(googleUrl, '_blank', 'noopener,noreferrer');
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_CONFIG: Record<Condition, { label: string; bg: string; text: string; border: string; icon: string }> = {
  otimo:   { label: 'Ótimo',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300',  icon: '✓' },
  bom:     { label: 'Bom',     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',   icon: '◎' },
  ruim:    { label: 'Ruim',    bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', icon: '⚠' },
  pessimo: { label: 'Péssimo', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',    icon: '✕' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy'); }
  catch { return '—'; }
}

function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); }
  catch { return '—'; }
}

// ─── Transfer timeline item ───────────────────────────────────────────────────

function TransferRow({ transfer, isFirst }: { transfer: PatrimonyTransferRecord; isFirst: boolean }) {
  const condCfg = transfer.condition ? CONDITION_CONFIG[transfer.condition] : null;
  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${isFirst ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      {/* Content */}
      <div className="pb-4 min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground mb-1">
          {formatDateLong(transfer.transferred_at)}
        </p>
        <div className="space-y-1">
          {transfer.location && (
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{transfer.location}</span>
            </div>
          )}
          {transfer.responsible_name && (
            <div className="flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{transfer.responsible_name}</span>
              {transfer.responsible_phone && (
                <button
                  onClick={() => openWhatsApp(transfer.responsible_phone!)}
                  className="flex items-center gap-0.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium ml-1"
                >
                  <MessageCircle className="h-3 w-3" />
                  WA
                </button>
              )}
            </div>
          )}
          {condCfg && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${condCfg.bg} ${condCfg.text} ${condCfg.border}`}>
              {condCfg.icon} {condCfg.label}
            </span>
          )}
          {transfer.notes && (
            <p className="text-xs text-muted-foreground italic mt-1">"{transfer.notes}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PhotoGallery ─────────────────────────────────────────────────────────────

function PhotoGallery({ urls }: { urls: (string | null | undefined)[] }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const validUrls = urls.filter(Boolean) as string[];

  if (validUrls.length === 0) {
    return (
      <div className="w-full h-36 rounded-xl bg-muted flex items-center justify-center">
        <Building2 className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <>
      <div className={`grid gap-2 ${validUrls.length === 1 ? 'grid-cols-1' : validUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {validUrls.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightboxSrc(url)}
            className="relative overflow-hidden rounded-xl bg-muted aspect-square hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={url}
              alt={`Foto ${i + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {validUrls.length > 1 && (
              <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                {i + 1}/{validUrls.length}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={() => setLightboxSrc(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          {lightboxSrc && (
            <img
              src={lightboxSrc}
              alt="Foto ampliada"
              className="w-full max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── PatrimonyDetailSheet ─────────────────────────────────────────────────────

export function PatrimonyDetailSheet({
  open,
  onOpenChange,
  item,
  onEdit,
  onTransfer,
}: PatrimonyDetailSheetProps) {
  const { data: transfers = [], isLoading: transfersLoading } = usePatrimonyTransfers(
    open && item ? item.id : null,
  );

  if (!item) return null;

  const condCfg = item.condition ? CONDITION_CONFIG[item.condition] : null;
  const photoUrls = [item.image_url, item.image_url_2, item.image_url_3];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-left leading-snug">{item.name}</SheetTitle>
            <div className="flex gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => onEdit(item)}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => onTransfer(item)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Movimentação</span>
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Photos */}
          <div className="px-5 pt-5">
            <PhotoGallery urls={photoUrls} />
          </div>

          {/* Badges */}
          <div className="px-5 pt-3 flex flex-wrap gap-2">
            {item.category && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-muted/50">
                {item.category}
              </span>
            )}
            {condCfg && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${condCfg.bg} ${condCfg.text} ${condCfg.border}`}>
                {condCfg.icon} {condCfg.label}
              </span>
            )}
            {item.written_off && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border bg-red-100 text-red-800 border-red-300">
                <AlertTriangle className="h-3 w-3" /> Baixa
              </span>
            )}
          </div>

          {/* Details */}
          <div className="px-5 pt-4 pb-5 space-y-3">
            {/* Numbers */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 border">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">Nº Municipal</p>
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold text-sm">{item.patrimony_number}</span>
                </div>
              </div>
              {item.patrimony_number_state && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">Nº Estadual</p>
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-sm">{item.patrimony_number_state}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Value & Date */}
            <div className="grid grid-cols-2 gap-3">
              {item.value != null && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-semibold text-sm text-emerald-700">{formatBRL(item.value)}</p>
                  </div>
                </div>
              )}
              {item.acquisition_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Aquisição</p>
                    <p className="font-semibold text-sm">{formatDate(item.acquisition_date)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* GPS */}
            {item.latitude != null && item.longitude != null && (
              <div className="flex items-start gap-2">
                <Navigation className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Coordenadas GPS</p>
                  <button
                    type="button"
                    onClick={() => openInMaps(item.latitude!, item.longitude!)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 font-mono"
                  >
                    {Number(item.latitude).toFixed(6)}, {Number(item.longitude).toFixed(6)}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Description */}
            {item.description && (
              <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-muted pl-3">
                {item.description}
              </p>
            )}

            {/* Current location & responsible */}
            {(item.location || item.responsible_name) && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Estado Atual</p>
                {item.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{item.location}</span>
                  </div>
                )}
                {item.responsible_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">{item.responsible_name}</span>
                    {item.responsible_phone && (
                      <button
                        onClick={() => openWhatsApp(item.responsible_phone!)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transfer history */}
          <div className="border-t px-5 pt-5 pb-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Histórico de Movimentações</h3>
            </div>

            {transfersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : transfers.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center">
                <ChevronRight className="h-4 w-4" />
                Nenhuma movimentação registrada
              </div>
            ) : (
              <div className="space-y-0">
                {(transfers as PatrimonyTransferRecord[]).map((t, i) => (
                  <TransferRow key={t.id} transfer={t} isFirst={i === 0} />
                ))}
                {/* Creation marker */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 mt-1 shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground pb-2">
                    Cadastro do bem — {formatDate(item.created_at)}
                  </p>
                </div>
              </div>
            )}

            {/* CTA */}
            <Button
              variant="outline"
              className="w-full mt-4 gap-2"
              onClick={() => onTransfer(item)}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Registrar nova movimentação
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
