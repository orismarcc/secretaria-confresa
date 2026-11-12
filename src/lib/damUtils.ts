/**
 * Utilitários centralizados para regras de negócio de DAM (Documento de Arrecadação Municipal).
 * Fonte única da verdade para o threshold de atraso — nunca reimplemente inline.
 */

/** Número de dias após a emissão em que uma DAM não paga é considerada em atraso. */
export const DAM_OVERDUE_DAYS = 30;

/**
 * Retorna `true` se a DAM está em atraso:
 * - Não foi paga
 * - Tem data de emissão registrada
 * - A data de emissão passou há mais de `DAM_OVERDUE_DAYS` dias
 *
 * @param dam_issued_at - String YYYY-MM-DD vinda do banco de dados
 * @param dam_paid      - Indica se a DAM já foi paga
 */
export function isDamOverdue(
  dam_issued_at: string | null | undefined,
  dam_paid: boolean | null | undefined,
): boolean {
  if (dam_paid) return false;
  if (!dam_issued_at) return false;
  const issued = new Date(dam_issued_at + 'T12:00:00');
  const diffDays = Math.floor((Date.now() - issued.getTime()) / 86_400_000);
  return diffDays > DAM_OVERDUE_DAYS;
}

/**
 * Valor de uma DAM que conta na arrecadação (e no total de DAMs do produtor).
 * - Só DAM paga conta.
 * - Restituição CONFIRMADA: o valor restituído é descontado.
 * - Cancelado com restituição PENDENTE: continua contando (o dinheiro ainda
 *   não foi devolvido) até a confirmação.
 * - Cancelado sem pedido de restituição: não conta (regra que já existia).
 */
export function valorDamArrecadado(s: {
  dam_paid?: boolean | null;
  dam_value?: number | string | null;
  status?: string | null;
  restituicao_status?: string | null;
  restituicao_valor?: number | string | null;
}): number {
  if (!s?.dam_paid) return 0;
  const valor = Number(s.dam_value) || 0;
  if (s.restituicao_status === 'confirmada') {
    return Math.max(0, valor - (Number(s.restituicao_valor) || 0));
  }
  if (s.status === 'cancelled' && s.restituicao_status !== 'pendente') return 0;
  return valor;
}

/** Valor restituído (confirmado) de um atendimento. */
export function valorRestituido(s: { restituicao_status?: string | null; restituicao_valor?: number | string | null }): number {
  return s?.restituicao_status === 'confirmada' ? Number(s.restituicao_valor) || 0 : 0;
}
