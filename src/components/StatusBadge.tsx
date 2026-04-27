import { ServiceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle2, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ServiceStatus | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'status-pending',
  },
  in_progress: {
    label: 'Em Execução',
    icon: Loader2,
    className: 'status-in-progress',
  },
  completed: {
    label: 'Finalizado',
    icon: CheckCircle2,
    className: 'status-completed',
  },
  proximo: {
    label: 'Próximo',
    icon: CalendarCheck,
    className: 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1.5 font-medium border',
        config.className,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'in_progress' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

export function getStatusLabel(status: ServiceStatus | string): string {
  return (statusConfig[status] ?? statusConfig.pending).label;
}
