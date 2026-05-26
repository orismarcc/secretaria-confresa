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
