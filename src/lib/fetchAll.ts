// Busca TODAS as linhas de uma consulta, em lotes.
//
// O Supabase (PostgREST) devolve no máximo 1000 linhas por requisição — acima
// disso as linhas simplesmente não vêm, sem erro. Toda consulta a tabela que
// cresce (atendimentos, produtores, entregas, SEFAZ…) deve passar por aqui.
//
// Regras para usar:
//   * `build` deve criar a consulta DO ZERO a cada chamada (os builders do
//     supabase-js não são reutilizáveis) e SEM .range()/.limit();
//   * a ordenação deve terminar numa coluna única (ex.: .order('id')), para os
//     lotes não pularem nem repetirem linhas;
//   * linhas repetidas entre lotes (inserção durante a busca) são descartadas
//     pelo `id`.
export const LOTE_SUPABASE = 1000; // = limite padrão de linhas do Supabase

export async function fetchAllRows<T = any>(
  build: () => any,
  lote: number = LOTE_SUPABASE,
): Promise<T[]> {
  const out: T[] = [];
  const vistos = new Set<unknown>();
  for (let from = 0; ; from += lote) {
    const { data, error } = await build().range(from, from + lote - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    for (const r of rows) {
      const id = (r as { id?: unknown } | null)?.id;
      if (id != null) {
        if (vistos.has(id)) continue;
        vistos.add(id);
      }
      out.push(r);
    }
    if (rows.length < lote) break;
  }
  return out;
}
