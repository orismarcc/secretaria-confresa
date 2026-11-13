// Peças compartilhadas da página Associações: selos, anel de regularidade e
// ajudas "?" (explicações curtas para a tela ensinar enquanto se usa).
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_ITEM, situacaoAssociacao, type StatusItem } from '@/lib/associacoes';

export function SituacaoBadge({ situacao, className }: { situacao: string; className?: string }) {
  const s = situacaoAssociacao(situacao);
  return <Badge variant="outline" className={cn('whitespace-nowrap font-medium', s.classe, className)}>{s.rotulo}</Badge>;
}

export function StatusItemBadge({ status, className }: { status: StatusItem; className?: string }) {
  const s = STATUS_ITEM[status];
  return <Badge variant="outline" className={cn('whitespace-nowrap font-medium', s.classe, className)}>{s.rotulo}</Badge>;
}

/** Anel com o % do checklist obrigatório em dia. */
export function AnelRegularidade({ percentual, regular, tamanho = 64, rotulo = true }: {
  percentual: number; regular: boolean; tamanho?: number; rotulo?: boolean;
}) {
  const r = 26, c = 2 * Math.PI * r;
  const cor = regular ? '#16a34a' : percentual >= 70 ? '#d97706' : '#dc2626';
  return (
    <div className="inline-flex flex-col items-center" title={`${percentual}% dos itens obrigatórios em dia`}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label={`${percentual}% em dia`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={cor} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - percentual / 100)} transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset .8s ease' }} />
        <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{percentual}%</text>
      </svg>
      {rotulo && <span className="text-[11px] font-medium mt-0.5" style={{ color: cor }}>{regular ? 'Regular' : 'Com pendências'}</span>}
    </div>
  );
}

/** Ícone "?" que abre uma explicação curta. */
export function Ajuda({ titulo, children, className }: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn('inline-flex text-muted-foreground hover:text-primary align-middle', className)} aria-label={titulo ? `Ajuda: ${titulo}` : 'Ajuda'}>
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm space-y-1.5" align="start">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className="text-muted-foreground space-y-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export const fmtNum = (v: number, casas = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
export const dataBR = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};
export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const selectCls = 'w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
