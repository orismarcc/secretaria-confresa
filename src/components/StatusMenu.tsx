/**
 * StatusMenu — badge de status clicável que abre um menu para alterar o status
 * do atendimento diretamente (sem abrir os detalhes).
 *
 * Regras:
 *  - Status simples (pendente, em execução, próximo): chama onChange(status).
 *  - "Finalizado": chama onFinalize() (para escolher a data de finalização).
 *  - "Cancelado": chama onCancel() (motivo é obrigatório no fluxo de cancelamento).
 * Se onFinalize/onCancel não forem fornecidos, cai no onChange como alternativa.
 */
import { StatusBadge } from '@/components/StatusBadge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Clock, Loader2, CalendarCheck, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'pending',     label: 'Pendente',    icon: Clock },
  { value: 'in_progress', label: 'Em Execução', icon: Loader2 },
  { value: 'proximo',     label: 'Próximo',     icon: CalendarCheck },
  { value: 'completed',   label: 'Finalizado',  icon: CheckCircle2 },
  { value: 'cancelled',   label: 'Cancelado',   icon: XCircle },
] as const;

interface StatusMenuProps {
  status: string;
  onChange: (status: string) => void;
  onFinalize?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}

export function StatusMenu({ status, onChange, onFinalize, onCancel, disabled, className }: StatusMenuProps) {
  const handleSelect = (value: string) => {
    if (value === status) return;
    if (value === 'completed') return onFinalize ? onFinalize() : onChange('completed');
    if (value === 'cancelled') return onCancel ? onCancel() : onChange('cancelled');
    onChange(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex items-center gap-1 rounded-md outline-none transition-opacity hover:opacity-80',
          'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-default',
          className,
        )}
        aria-label="Alterar status"
        title="Clique para alterar o status"
      >
        <StatusBadge status={status} />
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Alterar status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const isCurrent = o.value === status;
          return (
            <DropdownMenuItem
              key={o.value}
              onSelect={() => handleSelect(o.value)}
              className={cn('gap-2 text-sm cursor-pointer', isCurrent && 'font-semibold')}
            >
              <Icon className="h-4 w-4" />
              {o.label}
              {isCurrent && <span className="ml-auto text-[10px] text-muted-foreground">atual</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
