// Status de vencimento por proximidade da data — usado nos alertas da frota/CNH.
export type VencStatus = 'ok' | 'proximo' | 'vencido';

// Janela (dias) para considerar "próximo do vencimento" (amarelo).
export const DIAS_PROXIMO = 30;

export function statusVencimento(validade: string | null | undefined): { status: VencStatus; dias: number | null } {
  if (!validade) return { status: 'ok', dias: null };
  const d = new Date(String(validade).slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return { status: 'ok', dias: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dias = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (dias < 0) return { status: 'vencido', dias };
  if (dias <= DIAS_PROXIMO) return { status: 'proximo', dias };
  return { status: 'ok', dias };
}

// Classes Tailwind por status (fundo + texto), tema claro/escuro.
export function vencClasses(status: VencStatus): string {
  switch (status) {
    case 'vencido': return 'bg-red-500/12 text-red-700 dark:text-red-400 border border-red-500/30';
    case 'proximo': return 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/30';
    default: return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
  }
}

export function vencLabel(validade: string | null | undefined): string {
  const { status, dias } = statusVencimento(validade);
  if (dias == null) return 'sem validade';
  if (status === 'vencido') return `vencido há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return 'vence hoje';
  return `vence em ${dias} dia(s)`;
}

// Rótulos dos tipos de documento da frota.
export const FLEET_DOC_TYPES: { value: string; label: string }[] = [
  { value: 'CRLV', label: 'CRLV' },
  { value: 'RENAVAM', label: 'RENAVAM' },
  { value: 'LICENCIAMENTO', label: 'Licenciamento' },
  { value: 'SEGURO', label: 'Seguro' },
  { value: 'REVISAO', label: 'Revisão' },
  { value: 'LAUDO', label: 'Laudo' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'NOTA_FISCAL', label: 'Nota Fiscal' },
  { value: 'OUTRO', label: 'Outro' },
];
export const fleetDocLabel = (v: string) => FLEET_DOC_TYPES.find((t) => t.value === v)?.label || v;
