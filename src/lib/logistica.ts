/**
 * Serviços de LOGÍSTICA (calcário e insumos) têm fluxo próprio no app do
 * operador: Iniciar (GPS de partida) → "Entrega" (foto do carregamento + GPS do
 * local de carregamento) → Finalizar (foto + GPS da entrega na propriedade).
 * A regra é pela CATEGORIA do tipo de serviço — vale para todos os tipos
 * cadastrados nessas categorias.
 */
export const LOGISTICS_CATEGORIES = ['calcario', 'logistica_insumos'] as const;

export function isLogisticsCategory(category?: string | null): boolean {
  return !!category && (LOGISTICS_CATEGORIES as readonly string[]).includes(category);
}
