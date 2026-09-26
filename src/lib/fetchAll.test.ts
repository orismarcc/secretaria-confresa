import { describe, it, expect } from 'vitest';
import { fetchAllRows } from './fetchAll';

/** Simula o Supabase: devolve fatias de `rows`, nunca mais que `maxRows`. */
function fakeTable(rows: { id: number }[], opts: { maxRows?: number; erroNaChamada?: number; mutar?: (n: number) => void } = {}) {
  const chamadas: [number, number][] = [];
  const build = () => ({
    range: async (from: number, to: number) => {
      chamadas.push([from, to]);
      opts.mutar?.(chamadas.length);
      if (opts.erroNaChamada === chamadas.length) return { data: null, error: new Error('falhou') };
      const fim = Math.min(to + 1, from + (opts.maxRows ?? 1000));
      return { data: rows.slice(from, fim), error: null };
    },
  });
  return { build, chamadas };
}
const gerar = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('fetchAllRows', () => {
  it('tabela pequena: uma única chamada, tudo igual', async () => {
    const t = fakeTable(gerar(831));
    const out = await fetchAllRows(t.build);
    expect(out).toHaveLength(831);
    expect(t.chamadas).toEqual([[0, 999]]);
  });

  it('acima de 1000: busca em lotes e traz TODAS as linhas, na ordem', async () => {
    const t = fakeTable(gerar(2503));
    const out = await fetchAllRows<{ id: number }>(t.build);
    expect(out).toHaveLength(2503);
    expect(out.map((r) => r.id)).toEqual(gerar(2503).map((r) => r.id));
    expect(t.chamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('exatamente 1000: faz a chamada extra e para (sem perder nem repetir)', async () => {
    const t = fakeTable(gerar(1000));
    const out = await fetchAllRows(t.build);
    expect(out).toHaveLength(1000);
    expect(t.chamadas).toHaveLength(2);
  });

  it('tabela vazia', async () => {
    const out = await fetchAllRows(fakeTable([]).build);
    expect(out).toEqual([]);
  });

  it('linha inserida durante a busca não aparece duplicada', async () => {
    const rows = gerar(1500);
    // Antes do 2º lote, entra uma linha no topo: tudo desloca uma posição.
    const t = fakeTable(rows, { mutar: (n) => { if (n === 2) rows.unshift({ id: 9999 }); } });
    const out = await fetchAllRows<{ id: number }>(t.build);
    const ids = out.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('erro em qualquer lote é repassado (não devolve dados pela metade)', async () => {
    const t = fakeTable(gerar(2500), { erroNaChamada: 2 });
    await expect(fetchAllRows(t.build)).rejects.toThrow('falhou');
  });
});
