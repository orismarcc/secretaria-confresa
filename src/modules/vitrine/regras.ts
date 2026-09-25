// Conecta Confresa — regras de apoio à seleção (avisos, não bloqueios).
import { statusVencimento } from '@/lib/vencimento';
import { statusInfo, tipoDocLabel } from './constants';
import type { Documento } from './hooks';

/**
 * Avisos sobre o fornecedor de uma oferta: não validado ou com documento
 * vencido. Servem para a equipe decidir com a informação na frente.
 */
export function avisosDoFornecedor(status: string | null | undefined, docs: Documento[]): string[] {
  const out: string[] = [];
  if (status && status !== 'validado') out.push(`Fornecedor ainda não validado (situação: ${statusInfo(status).label}).`);
  docs
    .filter((d) => d.validade && statusVencimento(d.validade).status === 'vencido')
    .forEach((d) => out.push(`Documento vencido: ${tipoDocLabel(d.tipo)}.`));
  return out;
}
