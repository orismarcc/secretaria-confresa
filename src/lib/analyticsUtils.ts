/**
 * analyticsUtils.ts
 * Shared helpers for analytics/stats computations across DashboardPage,
 * AnalyticsPage, ServicesPage, and SettlementsPage.
 *
 * Each function is pure and side-effect free so it can be safely used inside
 * useMemo without additional memoization of the utility itself.
 */

// ─── Category ID helpers ──────────────────────────────────────────────────────

/** Returns a Set of demand_type IDs whose category === 'patrulha_mecanizada'. */
export function getPatrulhaIds(demandTypes: any[]): Set<string> {
  return new Set(
    demandTypes
      .filter(d => d.category === 'patrulha_mecanizada')
      .map(d => d.id as string),
  );
}

/** Returns a Set of demand_type IDs matching any of the given categories. */
export function getDemandIdsByCategory(
  demandTypes: any[],
  categories: string[],
): Set<string> {
  return new Set(
    demandTypes
      .filter(d => categories.includes(d.category))
      .map(d => d.id as string),
  );
}

/** Returns a Set of demand_type IDs whose name includes the given substring (case-insensitive). */
export function getDemandIdsByNameSubstring(
  demandTypes: any[],
  substring: string,
): Set<string> {
  const lower = substring.toLowerCase();
  return new Set(
    demandTypes
      .filter(d => d.name?.toLowerCase().includes(lower))
      .map(d => d.id as string),
  );
}

// ─── Settlement stats ─────────────────────────────────────────────────────────

export interface SettlementStat {
  pmCount: number;
  producersCount: number;
}

/**
 * Computes per-settlement stats:
 *  - pmCount: number of completed Patrulha Mecanizada services
 *  - producersCount: total registered producers
 */
export function computeSettlementStats(
  services: any[],
  producers: any[],
  patrulhaIds: Set<string>,
): Record<string, SettlementStat> {
  const stats: Record<string, SettlementStat> = {};

  services
    .filter(s => s.status === 'completed' && patrulhaIds.has(s.demand_type_id) && s.settlement_id)
    .forEach(s => {
      if (!stats[s.settlement_id]) stats[s.settlement_id] = { pmCount: 0, producersCount: 0 };
      stats[s.settlement_id].pmCount++;
    });

  producers
    .filter(p => p.settlement_id)
    .forEach(p => {
      if (!stats[p.settlement_id]) stats[p.settlement_id] = { pmCount: 0, producersCount: 0 };
      stats[p.settlement_id].producersCount++;
    });

  return stats;
}

// ─── Completion rate ──────────────────────────────────────────────────────────

/** Returns the percentage of services with status === 'completed' (0–100, rounded). */
export function completionRate(services: any[]): number {
  if (services.length === 0) return 0;
  const completed = services.filter(s => s.status === 'completed').length;
  return Math.round((completed / services.length) * 100);
}
