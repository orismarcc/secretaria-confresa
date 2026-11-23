// EcoAção — DEMONSTRAÇÃO de denúncia ambiental (descarte irregular de lixo).
// Projeto idealizado por alunos da comunidade Bridão Brasileiro.
//
// IMPORTANTE: é só demonstrativo. As denúncias ficam salvas SOMENTE no próprio
// aparelho (localStorage) — nada vai para o banco do sistema da Secretaria.
// O aplicativo definitivo será feito à parte.

export const CHAVE_ECOACAO = 'ecoacao:denuncias:v1';
export const LIMITE_DENUNCIAS = 12;      // o navegador guarda pouco; mantém as mais recentes
export const LIMITE_DESCRICAO = 400;

export type TipoDenuncia = 'descarte_lixo';

export interface Denuncia {
  id: string;
  protocolo: string;
  tipo: TipoDenuncia;
  criadaEm: string;               // ISO
  fotoDataUrl: string;            // JPEG reduzido
  latitude: number | null;
  longitude: number | null;
  precisaoM: number | null;
  origemLocal: 'gps' | 'foto' | 'mapa' | null;
  endereco: string;               // referência digitada (rua, ponto de referência…)
  descricao: string;
}

export const ROTULO_TIPO: Record<TipoDenuncia, string> = {
  descarte_lixo: 'Descarte irregular de lixo',
};

export const ROTULO_ORIGEM: Record<NonNullable<Denuncia['origemLocal']>, string> = {
  gps: 'Pelo GPS do celular',
  foto: 'Gravada na foto',
  mapa: 'Marcada no mapa',
};

/** Protocolo legível: ECO-AAAAMMDD-XXXX (XXXX sem letras ambíguas). */
export function gerarProtocolo(agora: Date = new Date(), aleatorio: () => number = Math.random): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sufixo = '';
  for (let i = 0; i < 4; i++) sufixo += letras[Math.floor(aleatorio() * letras.length) % letras.length];
  return `ECO-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${sufixo}`;
}

/** Coordenada válida (descarta 0,0 e valores fora do planeta). */
export const coordenadaValida = (lat: number | null | undefined, lng: number | null | undefined) =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
  && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** O que falta para poder enviar (vazio = pronto). */
export function pendencias(d: Pick<Denuncia, 'fotoDataUrl' | 'latitude' | 'longitude' | 'endereco' | 'descricao'>): string[] {
  const falta: string[] = [];
  if (!d.fotoDataUrl) falta.push('a foto do local');
  if (!coordenadaValida(d.latitude, d.longitude) && d.endereco.trim().length < 5) falta.push('a localização ou o endereço');
  if (d.descricao.trim().length < 10) falta.push('uma breve descrição (mín. 10 letras)');
  return falta;
}

// ── Armazenamento no aparelho ────────────────────────────────────────────────
type Armazem = Pick<Storage, 'getItem' | 'setItem'>;
const armazemPadrao = (): Armazem | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

export function listarDenuncias(armazem: Armazem | null = armazemPadrao()): Denuncia[] {
  if (!armazem) return [];
  try {
    const v = JSON.parse(armazem.getItem(CHAVE_ECOACAO) || '[]');
    return Array.isArray(v) ? v.filter((d) => d && typeof d.protocolo === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Salva no aparelho (a mais recente primeiro). Se o espaço do navegador
 * acabar, descarta as mais antigas até caber. Devolve false se não deu.
 */
export function salvarDenuncia(d: Denuncia, armazem: Armazem | null = armazemPadrao()): boolean {
  if (!armazem) return false;
  let lista = [d, ...listarDenuncias(armazem).filter((x) => x.id !== d.id)].slice(0, LIMITE_DENUNCIAS);
  while (lista.length > 0) {
    try {
      armazem.setItem(CHAVE_ECOACAO, JSON.stringify(lista));
      return true;
    } catch {
      if (lista.length === 1) return false;
      lista = lista.slice(0, -1);
    }
  }
  return false;
}

export function apagarDenuncia(id: string, armazem: Armazem | null = armazemPadrao()): void {
  if (!armazem) return;
  try {
    armazem.setItem(CHAVE_ECOACAO, JSON.stringify(listarDenuncias(armazem).filter((d) => d.id !== id)));
  } catch { /* ok */ }
}

/**
 * Toque numa sugestão da descrição: acrescenta ao texto (ou retira, se já
 * estiver lá). A frase começa com maiúscula.
 */
export function alternarSugestao(texto: string, sugestao: string): string {
  const t = texto.trim();
  const esc = sugestao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|,\\s*)${esc}(?=\\s*(,|$))`, 'i');
  if (re.test(t)) {
    const sem = t.replace(re, '').replace(/^\s*,\s*/, '').replace(/,\s*,/g, ',').trim();
    return sem ? sem.charAt(0).toUpperCase() + sem.slice(1) : '';
  }
  if (!t) return sugestao.charAt(0).toUpperCase() + sugestao.slice(1).toLowerCase();
  if (/[.!?]$/.test(t)) return `${t} ${sugestao.charAt(0).toUpperCase()}${sugestao.slice(1).toLowerCase()}`;
  return `${t}${/[,;]$/.test(t) ? '' : ','} ${sugestao.toLowerCase()}`;
}

/** Medidas para reduzir a foto mantendo a proporção. */
export function medidasReduzidas(largura: number, altura: number, max = 1280): { largura: number; altura: number } {
  if (largura <= 0 || altura <= 0) return { largura: 0, altura: 0 };
  const escala = Math.min(1, max / Math.max(largura, altura));
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

/**
 * Reduz a foto para caber no aparelho (≈1280 px, JPEG). O canvas não leva os
 * metadados da foto original (inclusive o GPS) — a localização é guardada à parte.
 */
export async function reduzirFoto(arquivo: Blob, max = 1280, qualidade = 0.72): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('Não foi possível abrir a foto.'));
      i.src = url;
    });
    const { largura, altura } = medidasReduzidas(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto.');
    ctx.drawImage(img, 0, 0, largura, altura);
    return canvas.toDataURL('image/jpeg', qualidade);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * GPS para a denúncia: a primeira leitura com boa precisão (≤ 100 m), em até
 * `esperaMs`. Sem filtro de região (a demonstração pode ser feita em qualquer
 * lugar). Nunca falha: sem permissão / sem sinal → null.
 */
export function lerGpsDenuncia(esperaMs = 10000, precisaoMaxM = 100): Promise<{ latitude: number; longitude: number; precisaoM: number | null } | null> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) { resolve(null); return; }
    let fim = false;
    let watchId: number | null = null;
    let melhor: { latitude: number; longitude: number; precisaoM: number | null } | null = null;
    const terminar = (r: typeof melhor) => {
      if (fim) return;
      fim = true;
      clearTimeout(timer);
      if (watchId !== null) { try { geo.clearWatch(watchId); } catch { /* ok */ } }
      resolve(r);
    };
    // No fim do tempo, aceita a melhor leitura razoável (≤ 500 m) que tiver vindo.
    const timer = setTimeout(() => terminar(melhor && (melhor.precisaoM ?? 9999) <= 500 ? melhor : null), esperaMs);
    try {
      watchId = geo.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (!coordenadaValida(latitude, longitude)) return;
          const precisaoM = Number.isFinite(accuracy) ? accuracy : null;
          const leitura = { latitude, longitude, precisaoM };
          if (!melhor || (precisaoM ?? 9999) < (melhor.precisaoM ?? 9999)) melhor = leitura;
          if (precisaoM !== null && precisaoM <= precisaoMaxM) terminar(leitura);
        },
        (erro) => { if (erro.code === erro.PERMISSION_DENIED) terminar(null); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: esperaMs },
      );
    } catch {
      terminar(null);
    }
  });
}
