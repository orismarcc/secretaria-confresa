import { ServiceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ServiceStatus;
  className?: string;
}

const statusConfig = {
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
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
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

export function getStatusLabel(status: ServiceStatus): string {
  return statusConfig[status].label;
}
