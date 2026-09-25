import { cn } from '@/lib/utils';
import { MESES } from './constants';

/** Seleção dos meses de safra/disponibilidade (toque para marcar/desmarcar). */
export function MesesPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const set = new Set(value);
  const toggle = (m: number) => {
    const next = new Set(set);
    if (next.has(m)) next.delete(m); else next.add(m);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-6 gap-1.5">
        {MESES.map((label, i) => {
          const m = i + 1;
          const on = set.has(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              aria-pressed={on}
              className={cn(
                'rounded-md border py-1.5 text-xs font-medium transition-colors',
                on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 text-[11px]">
        <button type="button" className="text-primary hover:underline" onClick={() => onChange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}>Ano todo</button>
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>Limpar</button>
      </div>
    </div>
  );
}

/** Faixa compacta dos 12 meses (preenchido = disponível). */
export function MesesBar({ meses }: { meses: number[] }) {
  const set = new Set(meses ?? []);
  return (
    <div className="flex gap-0.5" aria-label="Meses disponíveis">
      {MESES.map((label, i) => (
        <span
          key={label}
          title={label}
          className={cn('h-3 w-2.5 rounded-sm', set.has(i + 1) ? 'bg-primary' : 'bg-muted')}
        />
      ))}
    </div>
  );
}
