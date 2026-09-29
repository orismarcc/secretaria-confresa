import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lerPosicaoPrecisa, dentroDaRegiao } from './gpsPreciso';

type Leitura = { lat: number; lng: number; acc: number; aposMs: number };

/** GPS simulado: entrega as leituras nos tempos indicados. */
function simularGps(leituras: Leitura[], opts: { negar?: boolean } = {}) {
  let limpo = false;
  const geo = {
    watchPosition: (ok: PositionCallback, erro?: PositionErrorCallback) => {
      if (opts.negar) {
        setTimeout(() => erro?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError), 10);
      }
      leituras.forEach((l) => setTimeout(() => {
        if (!limpo) ok({ coords: { latitude: l.lat, longitude: l.lng, accuracy: l.acc } } as GeolocationPosition);
      }, l.aposMs));
      return 1;
    },
    clearWatch: () => { limpo = true; },
  };
  Object.defineProperty(globalThis.navigator, 'geolocation', { value: geo, configurable: true });
}

describe('lerPosicaoPrecisa', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('aceita na hora a primeira leitura precisa (não espera o tempo todo)', async () => {
    simularGps([{ lat: -10.6, lng: -51.6, acc: 12, aposMs: 1500 }]);
    const p = lerPosicaoPrecisa();
    await vi.advanceTimersByTimeAsync(1600);
    await expect(p).resolves.toEqual({ latitude: -10.6, longitude: -51.6, precisaoM: 12 });
  });

  it('CASO REAL: ignora o ponto aproximado de Rio Branco-AC e fica com o GPS bom', async () => {
    simularGps([
      { lat: -9.9756602, lng: -67.2104895, acc: 25000, aposMs: 300 },  // estimativa pela rede
      { lat: -10.62, lng: -51.62, acc: 20, aposMs: 3000 },             // GPS de verdade
    ]);
    const p = lerPosicaoPrecisa();
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toMatchObject({ latitude: -10.62, longitude: -51.62 });
  });

  it('só leituras imprecisas: devolve null em 8 s (inicia sem localização)', async () => {
    simularGps([{ lat: -10.6, lng: -51.6, acc: 900, aposMs: 500 }, { lat: -10.6, lng: -51.6, acc: 600, aposMs: 4000 }]);
    const p = lerPosicaoPrecisa();
    await vi.advanceTimersByTimeAsync(8000);
    await expect(p).resolves.toBeNull();
  });

  it('ponto preciso mas FORA da região de Confresa é recusado', async () => {
    simularGps([{ lat: -9.9756602, lng: -67.2104895, acc: 10, aposMs: 500 }]);
    const p = lerPosicaoPrecisa();
    await vi.advanceTimersByTimeAsync(8000);
    await expect(p).resolves.toBeNull();
  });

  it('permissão negada: devolve null na hora (não trava o operador)', async () => {
    simularGps([], { negar: true });
    const p = lerPosicaoPrecisa();
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBeNull();
  });

  it('região: Confresa dentro, Rio Branco fora', () => {
    expect(dentroDaRegiao(-10.6436, -51.5689)).toBe(true);
    expect(dentroDaRegiao(-9.9756602, -67.2104895)).toBe(false);
    expect(dentroDaRegiao(0, 0)).toBe(false);
  });
});
