// Rota de visitas técnicas. Ordem de preferência:
//   1. Google (função de servidor rota-google): mesma base de estradas do Google
//      Maps, ordem otimizada pelo Google;
//   2. OSRM/OpenStreetMap: matriz de tempos pela estrada + ordem ótima nossa;
//   3. estimativa em linha reta.
// Só COORDENADAS são enviadas (nenhum nome ou dado do produtor).
import { supabase } from '@/integrations/supabase/client';

export interface PontoRota { lat: number; lng: number }

export interface ResultadoRota {
  /** Índices das paradas (0-based, na lista recebida) na ordem de visita. */
  ordem: number[];
  /** Trechos: partida→1ª parada, …, (e última→partida se ida e volta). */
  trechos: { segundos: number; metros: number }[];
  /** Linha da rota pelas estradas ([lat, lng]); null na estimativa em linha reta. */
  geometria: [number, number][] | null;
  fonte: 'google' | 'estradas' | 'estimativa';
  /** Paradas cujo ponto está longe da estrada mapeada mais próxima (metros). */
  longeDaEstrada: { indice: number; metros: number }[];
}

const OSRM = 'https://router.project-osrm.org';
const VEL_ESTIMADA_KMH = 35;      // estradas vicinais
const FATOR_SINUOSIDADE = 1.35;   // linha reta → estrada
const LIMITE_EXATO = 12;          // até 12 paradas: ordem ótima exata

function haversineM(a: PontoRota, b: PontoRota) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const coordsParam = (pts: PontoRota[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

async function getJson(url: string, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.code !== 'Ok') throw new Error(j.code);
    return j;
  } finally {
    clearTimeout(t);
  }
}

/** Custo total de uma ordem (índices de nó: 0 = partida, 1..n = paradas). */
function custo(ordem: number[], D: number[][], voltar: boolean) {
  let c = D[0][ordem[0]];
  for (let i = 1; i < ordem.length; i++) c += D[ordem[i - 1]][ordem[i]];
  if (voltar) c += D[ordem[ordem.length - 1]][0];
  return c;
}

/** Ordem ótima exata (Held–Karp) — n pequeno. Retorna nós 1..n. */
function exata(D: number[][], n: number, voltar: boolean): number[] {
  const FULL = 1 << n;
  const dp = new Float64Array(FULL * n).fill(Infinity);
  const pai = new Int8Array(FULL * n).fill(-1);
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = D[0][j + 1];
  for (let mask = 1; mask < FULL; mask++) {
    for (let j = 0; j < n; j++) {
      const v = dp[mask * n + j];
      if (!(mask & (1 << j)) || v === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const nm = mask | (1 << k);
        const nv = v + D[j + 1][k + 1];
        if (nv < dp[nm * n + k]) { dp[nm * n + k] = nv; pai[nm * n + k] = j; }
      }
    }
  }
  let melhor = Infinity, fim = 0;
  for (let j = 0; j < n; j++) {
    const v = dp[(FULL - 1) * n + j] + (voltar ? D[j + 1][0] : 0);
    if (v < melhor) { melhor = v; fim = j; }
  }
  const ordem: number[] = [];
  let mask = FULL - 1, j = fim;
  while (j >= 0) { ordem.push(j + 1); const p = pai[mask * n + j]; mask &= ~(1 << j); j = p; }
  return ordem.reverse();
}

/** Heurística: vizinho mais próximo (várias partidas) + 2-opt + realocação. */
function heuristica(D: number[][], n: number, voltar: boolean): number[] {
  let melhor: number[] = [];
  let melhorC = Infinity;
  const inicios = Array.from({ length: n }, (_, i) => i + 1);
  for (const primeiro of inicios) {
    const livre = new Set(inicios.filter((x) => x !== primeiro));
    const ordem = [primeiro];
    while (livre.size) {
      const u = ordem[ordem.length - 1];
      let prox = -1, pc = Infinity;
      livre.forEach((v) => { if (D[u][v] < pc) { pc = D[u][v]; prox = v; } });
      ordem.push(prox); livre.delete(prox);
    }
    let rota = ordem;
    let c = custo(rota, D, voltar);
    let melhorou = true;
    while (melhorou) {
      melhorou = false;
      // 2-opt (inverte trecho)
      for (let i = 0; i < n - 1; i++) {
        for (let k = i + 1; k < n; k++) {
          const cand = rota.slice(0, i).concat(rota.slice(i, k + 1).reverse(), rota.slice(k + 1));
          const cc = custo(cand, D, voltar);
          if (cc + 1e-6 < c) { rota = cand; c = cc; melhorou = true; }
        }
      }
      // realocação de uma parada
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < n; k++) {
          if (i === k) continue;
          const cand = rota.slice();
          const [x] = cand.splice(i, 1);
          cand.splice(k, 0, x);
          const cc = custo(cand, D, voltar);
          if (cc + 1e-6 < c) { rota = cand; c = cc; melhorou = true; }
        }
      }
    }
    if (c < melhorC) { melhorC = c; melhor = rota; }
  }
  return melhor;
}

function resolver(D: number[][], n: number, voltar: boolean) {
  if (n === 1) return [1];
  return n <= LIMITE_EXATO ? exata(D, n, voltar) : heuristica(D, n, voltar);
}

/** Decodifica a polyline do Google em [lat, lng]. */
function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const eixo of [0, 1]) {
      let b, shift = 0, result = 0;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (eixo === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

// Sem chave do Google configurada: não tenta de novo nesta sessão.
let googleNaoConfigurado = false;

async function viaGoogle(partida: PontoRota, paradas: PontoRota[], voltar: boolean, destinoIndice: number | null): Promise<ResultadoRota | null> {
  if (googleNaoConfigurado) return null;
  try {
    const { data, error } = await supabase.functions.invoke('rota-google', {
      body: { origem: partida, paradas, voltar, destinoIndice },
    });
    if (error) {
      const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
      if (corpo?.error === 'nao_configurado') googleNaoConfigurado = true;
      return null;
    }
    const ordem: number[] = data?.ordem;
    const trechos = data?.trechos;
    if (!Array.isArray(ordem) || ordem.length !== paradas.length || new Set(ordem).size !== paradas.length
      || !Array.isArray(trechos) || trechos.length !== paradas.length + (voltar ? 1 : 0)) return null;
    return {
      ordem,
      trechos,
      geometria: data.polyline ? decodePolyline(data.polyline) : null,
      fonte: 'google',
      longeDaEstrada: [],
    };
  } catch {
    return null;
  }
}

/**
 * Calcula a rota de menor tempo saindo de `partida`, passando por todas as
 * `paradas` (e voltando, se `voltar`).
 */
export async function otimizarRota(partida: PontoRota, paradas: PontoRota[], voltar: boolean): Promise<ResultadoRota> {
  // Ida e volta: o Google escolhe a ordem de todas as paradas.
  if (voltar) {
    const g = await viaGoogle(partida, paradas, true, null);
    if (g) return g;
    return otimizarRotaOsm(partida, paradas, true);
  }
  // Só ida: a última parada vem do nosso cálculo; o Google ordena as demais.
  const base = await otimizarRotaOsm(partida, paradas, false);
  const g = await viaGoogle(partida, paradas, false, base.ordem[base.ordem.length - 1]);
  return g ?? base;
}

async function otimizarRotaOsm(partida: PontoRota, paradas: PontoRota[], voltar: boolean): Promise<ResultadoRota> {
  const nos = [partida, ...paradas];
  const n = paradas.length;
  const estimativaM = (a: number, b: number) => haversineM(nos[a], nos[b]) * FATOR_SINUOSIDADE;
  const estimativaS = (a: number, b: number) => estimativaM(a, b) / (VEL_ESTIMADA_KMH / 3.6);

  try {
    const tab = await getJson(`${OSRM}/table/v1/driving/${coordsParam(nos)}?annotations=duration,distance`);
    const D: number[][] = tab.durations.map((row: (number | null)[], i: number) =>
      row.map((v, j) => (v == null ? estimativaS(i, j) * 1.5 : v)));
    const M: number[][] = tab.distances.map((row: (number | null)[], i: number) =>
      row.map((v, j) => (v == null ? estimativaM(i, j) : v)));
    const ordemNos = resolver(D, n, voltar);
    const seq = [0, ...ordemNos, ...(voltar ? [0] : [])];
    const trechos = seq.slice(1).map((b, i) => ({ segundos: D[seq[i]][b], metros: M[seq[i]][b] }));

    let geometria: [number, number][] | null = null;
    try {
      const rota = await getJson(`${OSRM}/route/v1/driving/${coordsParam(seq.map((i) => nos[i]))}?overview=full&geometries=geojson`);
      geometria = (rota.routes?.[0]?.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]] as [number, number]);
    } catch { /* sem desenho pela estrada: a ordem e os tempos continuam valendo */ }

    const longeDaEstrada = (tab.sources as { distance: number }[])
      .map((s, i) => ({ indice: i - 1, metros: s.distance }))
      .filter((x) => x.indice >= 0 && x.metros > 1500);

    return { ordem: ordemNos.map((x) => x - 1), trechos, geometria, fonte: 'estradas', longeDaEstrada };
  } catch {
    const D = nos.map((_, i) => nos.map((__, j) => (i === j ? 0 : estimativaS(i, j))));
    const ordemNos = resolver(D, n, voltar);
    const seq = [0, ...ordemNos, ...(voltar ? [0] : [])];
    const trechos = seq.slice(1).map((b, i) => ({ segundos: D[seq[i]][b], metros: estimativaM(seq[i], b) }));
    return { ordem: ordemNos.map((x) => x - 1), trechos, geometria: null, fonte: 'estimativa', longeDaEstrada: [] };
  }
}

/** Links do Google Maps para navegar (máx. 9 paradas intermediárias por link). */
export function linksGoogleMaps(partida: PontoRota, paradasOrdenadas: PontoRota[], voltar: boolean): string[] {
  const pts = [partida, ...paradasOrdenadas, ...(voltar ? [partida] : [])];
  const f = (p: PontoRota) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const links: string[] = [];
  for (let i = 0; i < pts.length - 1; i += 10) {
    const trecho = pts.slice(i, Math.min(i + 11, pts.length));
    const meio = trecho.slice(1, -1);
    const u = new URL('https://www.google.com/maps/dir/');
    u.searchParams.set('api', '1');
    u.searchParams.set('origin', f(trecho[0]));
    u.searchParams.set('destination', f(trecho[trecho.length - 1]));
    if (meio.length) u.searchParams.set('waypoints', meio.map(f).join('|'));
    u.searchParams.set('travelmode', 'driving');
    links.push(u.toString());
  }
  return links;
}
