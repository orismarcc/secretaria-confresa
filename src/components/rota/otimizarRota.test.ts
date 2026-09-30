import { describe, it, expect, vi, afterEach } from 'vitest';
import { otimizarRota } from './otimizarRota';

// Nós: 0 = partida, 1..3 = paradas. Tempos (s) pela estrada — a melhor ordem é 1 → 2 → 3.
const DUR = [
  [0, 100, 200, 300],
  [100, 0, 100, 200],
  [200, 100, 0, 100],
  [300, 200, 100, 0],
];
const DIST = DUR.map((l) => l.map((v) => v * 10));

function mockOsrm(falhar = false) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (falhar) throw new Error('offline');
    const body = url.includes('/table/')
      ? { code: 'Ok', durations: DUR, distances: DIST, sources: DUR.map(() => ({ distance: 10 })) }
      : { code: 'Ok', routes: [{ geometry: { coordinates: [[-51.5, -10.6], [-51.6, -10.7]] } }] };
    return { ok: true, json: async () => body } as Response;
  }));
}

const P = { lat: -10.64, lng: -51.57 };
const PARADAS = [{ lat: -10.65, lng: -51.6 }, { lat: -10.66, lng: -51.7 }, { lat: -10.67, lng: -51.8 }];

afterEach(() => vi.unstubAllGlobals());

describe('otimizarRota', () => {
  it('sem ordem fixa: encontra a melhor ordem', async () => {
    mockOsrm();
    const r = await otimizarRota(P, PARADAS, false);
    expect(r.ordem).toEqual([0, 1, 2]);
    expect(r.trechos.map((t) => t.segundos)).toEqual([100, 100, 100]);
    expect(r.fonte).toBe('estradas');
  });

  it('com ordem fixa (arrastada): NÃO reordena e calcula os trechos nessa ordem', async () => {
    mockOsrm();
    const r = await otimizarRota(P, PARADAS, true, [2, 0, 1]);
    expect(r.ordem).toEqual([2, 0, 1]);
    // partida→3, 3→1, 1→2, 2→partida
    expect(r.trechos.map((t) => t.segundos)).toEqual([300, 200, 100, 200]);
    expect(r.trechos.map((t) => t.metros)).toEqual([3000, 2000, 1000, 2000]);
    expect(r.geometria).not.toBeNull();
  });

  it('ordem fixa inválida é ignorada (volta a otimizar)', async () => {
    mockOsrm();
    const r = await otimizarRota(P, PARADAS, false, [0, 0, 1]);
    expect(r.ordem).toEqual([0, 1, 2]);
  });

  it('sem o serviço de rotas: mantém a ordem fixa na estimativa', async () => {
    mockOsrm(true);
    const r = await otimizarRota(P, PARADAS, false, [1, 2, 0]);
    expect(r.fonte).toBe('estimativa');
    expect(r.ordem).toEqual([1, 2, 0]);
    expect(r.trechos).toHaveLength(3);
  });
});
