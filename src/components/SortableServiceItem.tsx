import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { StatusBadge } from '@/components/StatusBadge';
import { GripVertical, CheckCircle2, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ServiceData {
  id: string;
  producer_id: string;
  demand_type_id: string;
  status: string;
  scheduled_date: string;
  appointment_date?: string | null;
  producers?: { name: string } | null;
  demand_types?: { name: string } | null;
}

interface SortableServiceItemProps {
  service: ServiceData;
  producerName: string;
  demandTypeName: string;
  onFinalize?: (id: string) => void;
  isFinalizePending?: boolean;
  variant?: 'dashboard' | 'operator' | 'proximos';
}

export function SortableServiceItem({
  service,
  producerName,
  demandTypeName,
  onFinalize,
  isFinalizePending,
  variant = 'dashboard',
}: SortableServiceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const registrationDate = new Date(service.scheduled_date + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // For overdue/today logic: only applies when appointment_date is set
  const hasAppointment = !!service.appointment_date;
  const displayDate = hasAppointment
    ? new Date(service.appointment_date! + 'T12:00:00')
    : registrationDate;
  const isToday = hasAppointment && displayDate.toDateString() === new Date().toDateString();
  const isPast  = hasAppointment && displayDate < today;

  if (variant === 'proximos') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center gap-2 p-3 rounded-xl border bg-card transition-all',
          isDragging && 'opacity-50 shadow-lg scale-[1.02] z-50 ring-2 ring-primary/30',
          isToday && 'border-primary/40 bg-primary/5',
          isPast && !isToday && 'border-destructive/30 bg-destructive/5',
        )}
      >
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none shrink-0"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Date badge */}
        <div className={cn(
          'flex flex-col items-center justify-center w-12 h-12 rounded-lg shrink-0 text-center',
          isToday ? 'bg-primary text-primary-foreground' :
          isPast  ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground',
        )}>
          <span className="text-xs font-semibold leading-none">
            {format(displayDate, 'dd', { locale: ptBR })}
          </span>
          <span className="text-[10px] uppercase leading-none mt-0.5">
            {format(displayDate, 'MMM', { locale: ptBR })}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{producerName}</p>
          <p className="text-xs text-muted-foreground truncate">{demandTypeName}</p>
          {hasAppointment && isToday && (
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Hoje</span>
          )}
          {hasAppointment && isPast && !isToday && (
            <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Atrasado</span>
          )}
          {!hasAppointment && (
            <span className="text-[10px] text-muted-foreground">Cadastro: {format(registrationDate, 'dd/MM/yyyy', { locale: ptBR })}</span>
          )}
        </div>

        {/* Status */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed' | 'proximo'} />
        </div>
      </div>
    );
  }

  // Default / operator variant
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg bg-muted/50 transition-all',
        isDragging && 'opacity-50 shadow-lg scale-[1.02] z-50',
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{producerName}</p>
        <p className="text-sm text-muted-foreground truncate">{demandTypeName}</p>
        <p className="text-xs text-muted-foreground">
          {format(registrationDate, 'dd/MM/yyyy', { locale: ptBR })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed'} />
        {onFinalize && (
          <Button
            size="sm"
            variant="outline"
            className="text-success border-success hover:bg-success/10 text-xs sm:text-sm"
            onClick={() => onFinalize(service.id)}
            disabled={isFinalizePending}
          >
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Finalizar</span>
            <span className="sm:hidden">OK</span>
          </Button>
        )}
      </div>
    </div>
  );
}
