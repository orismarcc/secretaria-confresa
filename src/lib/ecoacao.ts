// EcoAção — DEMONSTRAÇÃO de denúncia ambiental (descarte irregular de lixo).
// Projeto idealizado por alunos da comunidade Bridão Brasileiro.
//
// IMPORTANTE: é só demonstrativo. As denúncias ficam salvas SOMENTE no próprio
// aparelho (localStorage) — nada vai para o banco do sistema da Secretaria.
// O aplicativo definitivo será feito à parte.

export const CHAVE_ECOACAO = 'ecoacao:denuncias:v1';
export const LIMITE_DENUNCIAS = 12;      // o navegador guarda pouco; mantém as mais recentes
export const LIMITE_DESCRICAO = 400;
export const MAX_FOTOS = 3;

export type TipoDenuncia = 'descarte_lixo';

export interface Denuncia {
  id: string;
  protocolo: string;
  tipo: TipoDenuncia;
  criadaEm: string;               // ISO
  fotos: string[];                // até MAX_FOTOS, JPEG reduzido (data URL)
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
export function pendencias(d: Pick<Denuncia, 'fotos' | 'latitude' | 'longitude' | 'endereco' | 'descricao'>): string[] {
  const falta: string[] = [];
  if (!d.fotos.length) falta.push('pelo menos uma foto do local');
  if (!coordenadaValida(d.latitude, d.longitude) && d.endereco.trim().length < 5) falta.push('a localização ou o endereço');
  if (d.descricao.trim().length < 10) falta.push('uma breve descrição (mín. 10 letras)');
  return falta;
}

// ── Armazenamento no aparelho ────────────────────────────────────────────────
type Armazem = Pick<Storage, 'getItem' | 'setItem'>;
const armazemPadrao = (): Armazem | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

/** Aceita também o formato antigo (uma foto em `fotoDataUrl`). */
function normalizar(d: Record<string, unknown>): Denuncia | null {
  if (!d || typeof d.protocolo !== 'string') return null;
  const fotos = Array.isArray(d.fotos)
    ? (d.fotos as unknown[]).filter((f): f is string => typeof f === 'string' && f.length > 0)
    : typeof d.fotoDataUrl === 'string' && d.fotoDataUrl ? [d.fotoDataUrl] : [];
  const { fotoDataUrl: _antigo, ...resto } = d;
  return { ...(resto as unknown as Denuncia), fotos: fotos.slice(0, MAX_FOTOS) };
}

export function listarDenuncias(armazem: Armazem | null = armazemPadrao()): Denuncia[] {
  if (!armazem) return [];
  try {
    const v = JSON.parse(armazem.getItem(CHAVE_ECOACAO) || '[]');
    return Array.isArray(v) ? v.map(normalizar).filter((d): d is Denuncia => d !== null) : [];
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
export async function reduzirFoto(arquivo: Blob, max = 1280, qualidade = 0.7): Promise<string> {
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

// ── GPS contínuo ─────────────────────────────────────────────────────────────
// No iPhone (Safari) a 1ª leitura pode demorar: há o pedido de permissão e o
// GPS precisa "firmar". Por isso o rastreio começa ANTES da foto (ao escolher
// o tipo de denúncia) e fica melhorando a posição até a pessoa fotografar.

export interface LeituraGps { latitude: number; longitude: number; precisaoM: number | null; em: number }
export type EstadoGps = 'parado' | 'buscando' | 'ok' | 'negado' | 'indisponivel';

export const PRECISAO_BOA_M = 50;
export const PRECISAO_ACEITAVEL_M = 500;
export const VALIDADE_LEITURA_MS = 2 * 60 * 1000;

/**
 * Fica com a melhor leitura: a mais precisa; uma mais nova substitui se for
 * quase tão boa (a pessoa pode ter andado).
 */
export function melhorLeitura(atual: LeituraGps | null, nova: LeituraGps): LeituraGps {
  if (!coordenadaValida(nova.latitude, nova.longitude)) return atual ?? nova;
  if (!atual) return nova;
  const pa = atual.precisaoM ?? 9999;
  const pn = nova.precisaoM ?? 9999;
  if (pn <= pa) return nova;
  if (nova.em - atual.em > 30_000 && pn <= Math.max(pa * 1.5, PRECISAO_BOA_M)) return nova;
  return atual;
}

/** A leitura serve para a denúncia? (recente e com precisão aceitável) */
export function leituraUtil(l: LeituraGps | null, agora = Date.now()): l is LeituraGps {
  return !!l && coordenadaValida(l.latitude, l.longitude)
    && (l.precisaoM ?? 9999) <= PRECISAO_ACEITAVEL_M
    && agora - l.em <= VALIDADE_LEITURA_MS;
}

export type Plataforma = 'iphone' | 'android' | 'outro';
export function detectarPlataforma(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Plataforma {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'outro';
}

/** Navegador embutido de app (WhatsApp, Instagram, Facebook…): costuma bloquear o GPS. */
export function navegadorDeApp(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|\bwv\b|GSA\//i.test(ua);
}

/** Passo a passo para liberar a localização, por aparelho. */
export function comoLiberarGps(p: Plataforma): string[] {
  if (p === 'iphone') {
    return [
      'Abra Ajustes › Privacidade e Segurança › Serviços de Localização e deixe ligado.',
      'Ali mesmo, toque em "Sites do Safari" e escolha "Ao Usar o App".',
      'Volte aqui, toque no "aA" da barra de endereço › Ajustes do Site › Localização › Permitir.',
      'Toque em "Tentar de novo".',
    ];
  }
  if (p === 'android') {
    return [
      'Ligue a "Localização" no menu rápido do celular (puxando a tela de cima para baixo).',
      'Toque no cadeado ao lado do endereço do site › Permissões › Localização › Permitir.',
      'Toque em "Tentar de novo".',
    ];
  }
  return [
    'Permita a localização para este site (ícone ao lado do endereço).',
    'Confira se a localização do aparelho está ligada.',
    'Toque em "Tentar de novo".',
  ];
}

/**
 * Rastreio contínuo do GPS. Chame `iniciar()` a partir de um toque da pessoa
 * (o iPhone mostra o pedido de permissão nessa hora).
 */
export function criarRastreioGps(aoMudar: (estado: EstadoGps, leitura: LeituraGps | null) => void) {
  let watchId: number | null = null;
  let melhor: LeituraGps | null = null;
  let estado: EstadoGps = 'parado';
  const avisar = (e: EstadoGps) => { estado = e; aoMudar(e, melhor); };

  return {
    iniciar() {
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
      if (!geo) { avisar('indisponivel'); return; }
      if (watchId !== null) return;            // já rodando
      if (estado !== 'ok') avisar('buscando');
      try {
        watchId = geo.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            if (!coordenadaValida(latitude, longitude)) return;
            melhor = melhorLeitura(melhor, { latitude, longitude, precisaoM: Number.isFinite(accuracy) ? accuracy : null, em: Date.now() });
            avisar(leituraUtil(melhor) ? 'ok' : 'buscando');
          },
          (erro) => {
            if (erro.code === erro.PERMISSION_DENIED) {
              if (watchId !== null) { try { geo.clearWatch(watchId); } catch { /* ok */ } }
              watchId = null;
              avisar('negado');
            } else if (erro.code === erro.POSITION_UNAVAILABLE && !melhor) {
              avisar('indisponivel');
            }
            // TIMEOUT: o watch continua tentando
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
        );
      } catch {
        avisar('indisponivel');
      }
    },
    parar() {
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
      if (watchId !== null && geo) { try { geo.clearWatch(watchId); } catch { /* ok */ } }
      watchId = null;
    },
    /** Recomeça do zero (botão "Tentar de novo"). */
    reiniciar() {
      this.parar();
      melhor = null;
      estado = 'parado';
      this.iniciar();
    },
    leitura: () => melhor,
    estado: () => estado,
  };
}
