/** Vínculo do maquinário/veículo com a Secretaria. */
export type Vinculo = 'proprio' | 'cedido' | 'locado' | 'consorcio';

export const VINCULOS: { value: Vinculo; label: string; origemLabel: string }[] = [
  { value: 'proprio',   label: 'Próprio',   origemLabel: '' },
  { value: 'cedido',    label: 'Cedido',    origemLabel: 'Cedente (secretaria ou instituição)' },
  { value: 'locado',    label: 'Locado',    origemLabel: 'Locadora' },
  { value: 'consorcio', label: 'Consórcio', origemLabel: 'Consórcio' },
];

export const vinculoLabel = (v?: string | null) =>
  VINCULOS.find((x) => x.value === v)?.label || 'Próprio';

export const vinculoOrigemLabel = (v?: string | null) =>
  VINCULOS.find((x) => x.value === v)?.origemLabel || 'Origem';

export const vinculoBadgeClass = (v?: string | null) => ({
  proprio:   'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  cedido:    'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  locado:    'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  consorcio: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30',
}[v || 'proprio'] || '');
