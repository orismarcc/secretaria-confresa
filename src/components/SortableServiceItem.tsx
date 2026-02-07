import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { GripVertical, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ServiceData {
  id: string;
  producer_id: string;
  demand_type_id: string;
  status: string;
  scheduled_date: string;
  producers?: { name: string } | null;
  demand_types?: { name: string } | null;
}

interface SortableServiceItemProps {
  service: ServiceData;
  producerName: string;
  demandTypeName: string;
  onFinalize?: (id: string) => void;
  isFinalizePending?: boolean;
  variant?: 'dashboard' | 'operator';
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-muted/50 transition-all",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50"
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
          {format(new Date(service.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed'} />
        {onFinalize && (
          <Button 
            size="sm" 
            variant="outline"
            className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
            onClick={() => onFinalize(service.id)}
            disabled={isFinalizePending}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Finalizar
          </Button>
        )}
      </div>
    </div>
  );
}
