/**
 * oficios.ts — regras da página Ofícios: tipos, categorias/situações,
 * pesquisa, filtros, ordenação, paginação, indicadores e preenchimento de
 * modelos (.docx). Tudo puro (sem banco) para ser testável.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export const BUCKET_OFICIOS = 'oficios';
/** Modelo padrão (timbrado oficial) — sempre disponível, não fica no banco. */
export const MODELO_PADRAO_URL = '/templates/oficio-padrao.docx';
export const TAMANHO_MAX_ARQUIVO = 20 * 1024 * 1024;
export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const CATEGORIAS_OFICIO = [
  'Solicitação',
  'Resposta',
  'Encaminhamento',
  'Comunicado',
  'Convite',
  'Restituição de DAM',
  'Prestação de contas',
  'Outros',
] as const;

export type SituacaoOficio = 'rascunho' | 'emitido' | 'enviado' | 'respondido' | 'arquivado' | 'cancelado';

export const SITUACOES_OFICIO: { id: SituacaoOficio; rotulo: string; classe: string; cor: string }[] = [
  { id: 'rascunho', rotulo: 'Rascunho', classe: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30', cor: '#64748b' },
  { id: 'emitido', rotulo: 'Emitido', classe: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30', cor: '#2563eb' },
  { id: 'enviado', rotulo: 'Enviado', classe: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30', cor: '#7c3aed' },
  { id: 'respondido', rotulo: 'Respondido', classe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', cor: '#059669' },
  { id: 'arquivado', rotulo: 'Arquivado', classe: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30', cor: '#d97706' },
  { id: 'cancelado', rotulo: 'Cancelado', classe: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30', cor: '#dc2626' },
];
export const situacaoInfo = (s: string) => SITUACOES_OFICIO.find((x) => x.id === s) ?? SITUACOES_OFICIO[0];

export interface Oficio {
  id: string;
  ano: number;
  numero: number;
  data_oficio: string; // yyyy-MM-dd
  destinatario: string;
  assunto: string;
  categoria: string;
  situacao: SituacaoOficio;
  descricao: string | null;
  modelo_id: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  arquivo_versao: number;
  /** Texto escrito no editor do sistema (HTML normalizado pelo editor). */
  conteudo_html?: string | null;
  conteudo_atualizado_em?: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OficioArquivo {
  id: string;
  oficio_id: string;
  versao: number;
  arquivo_path: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  acao: 'envio' | 'substituicao';
  motivo: string | null;
  enviado_por: string | null;
  enviado_em: string;
}

export interface OficioModelo {
  id: string;
  nome: string;
  categoria: string;
  finalidade: string | null;
  descricao: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  /** Modelo de texto (escrito no editor). Sem arquivo = modelo do editor. */
  conteudo_html?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** 473 / 2026 → "473/2026" */
export const numeroCompleto = (o: Pick<Oficio, 'numero' | 'ano'>) => `${o.numero}/${o.ano}`;

/** "2026-11-06" → "06/11/2026" */
export function dataBR(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-11-06" → "06 de novembro de 2026" */
export function dataExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : '';
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Sem acento e minúsculo, para pesquisa. */
export function normalizar(t: string | null | undefined): string {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ─── Pesquisa e filtros ──────────────────────────────────────────────────────

export interface FiltrosOficio {
  busca: string;
  categoria: string; // '' = todas
  situacao: string;  // '' = todas
  ano: string;       // '' = todos
  de: string;        // yyyy-MM-dd ('' = sem início)
  ate: string;       // yyyy-MM-dd ('' = sem fim)
}
export const FILTROS_VAZIOS: FiltrosOficio = { busca: '', categoria: '', situacao: '', ano: '', de: '', ate: '' };

/**
 * Pesquisa por número ("473", "473/2026"), ano, assunto ou destinatário,
 * mais filtros de período, categoria, situação e ano.
 */
export function filtrarOficios(lista: Oficio[], f: FiltrosOficio): Oficio[] {
  const termo = normalizar(f.busca);
  const numBusca = /^(\d+)(?:\s*\/\s*(\d{4}))?$/.exec(termo);
  return lista.filter((o) => {
    if (f.categoria && o.categoria !== f.categoria) return false;
    if (f.situacao && o.situacao !== f.situacao) return false;
    if (f.ano && String(o.ano) !== f.ano) return false;
    if (f.de && o.data_oficio < f.de) return false;
    if (f.ate && o.data_oficio > f.ate) return false;
    if (!termo) return true;
    if (numBusca) {
      const [, n, a] = numBusca;
      if (a) return String(o.numero) === String(Number(n)) && String(o.ano) === a;
      // só dígitos: número do ofício OU ano
      if (String(o.numero) === String(Number(n)) || String(o.ano) === n) return true;
    }
    return [o.assunto, o.destinatario, numeroCompleto(o), o.categoria, o.descricao]
      .some((c) => normalizar(c).includes(termo));
  });
}

export type CampoOrdem = 'numero' | 'data' | 'assunto' | 'destinatario' | 'situacao';
export function ordenarOficios(lista: Oficio[], campo: CampoOrdem, dir: 'asc' | 'desc'): Oficio[] {
  const s = dir === 'asc' ? 1 : -1;
  const cmp = (a: Oficio, b: Oficio): number => {
    switch (campo) {
      case 'numero': return a.ano - b.ano || a.numero - b.numero;
      case 'data': return a.data_oficio.localeCompare(b.data_oficio) || a.numero - b.numero;
      case 'assunto': return a.assunto.localeCompare(b.assunto, 'pt-BR');
      case 'destinatario': return a.destinatario.localeCompare(b.destinatario, 'pt-BR');
      case 'situacao': return situacaoInfo(a.situacao).rotulo.localeCompare(situacaoInfo(b.situacao).rotulo, 'pt-BR');
    }
  };
  return [...lista].sort((a, b) => s * cmp(a, b));
}

export function paginar<T>(lista: T[], pagina: number, porPagina: number): { itens: T[]; total: number; paginas: number; pagina: number } {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const p = Math.min(Math.max(1, pagina), paginas);
  return { itens: lista.slice((p - 1) * porPagina, p * porPagina), total: lista.length, paginas, pagina: p };
}

// ─── Indicadores ─────────────────────────────────────────────────────────────

export interface GrupoIndicador { chave: string; rotulo: string; oficios: Oficio[] }
export interface Indicadores {
  total: number;
  comArquivo: number;
  semArquivo: number;
  porAno: GrupoIndicador[];
  porSituacao: GrupoIndicador[];
  porCategoria: GrupoIndicador[];
}

function agrupar(lista: Oficio[], chave: (o: Oficio) => string, rotulo: (k: string) => string): GrupoIndicador[] {
  const m = new Map<string, Oficio[]>();
  lista.forEach((o) => { const k = chave(o); m.set(k, [...(m.get(k) ?? []), o]); });
  return Array.from(m.entries()).map(([k, os]) => ({
    chave: k, rotulo: rotulo(k), oficios: ordenarOficios(os, 'numero', 'desc'),
  }));
}

export function calcularIndicadores(lista: Oficio[]): Indicadores {
  const comArquivo = lista.filter((o) => !!o.arquivo_path).length;
  return {
    total: lista.length,
    comArquivo,
    semArquivo: lista.length - comArquivo,
    porAno: agrupar(lista, (o) => String(o.ano), (k) => k).sort((a, b) => Number(b.chave) - Number(a.chave)),
    porSituacao: agrupar(lista, (o) => o.situacao, (k) => situacaoInfo(k).rotulo)
      .sort((a, b) => SITUACOES_OFICIO.findIndex((x) => x.id === a.chave) - SITUACOES_OFICIO.findIndex((x) => x.id === b.chave)),
    porCategoria: agrupar(lista, (o) => o.categoria, (k) => k).sort((a, b) => b.oficios.length - a.oficios.length),
  };
}

/** Próximo número do ano com base na lista carregada (sugestão; o banco confirma). */
export function proximoNumeroLocal(lista: Oficio[], ano: number): number {
  return lista.filter((o) => o.ano === ano).reduce((m, o) => Math.max(m, o.numero), 0) + 1;
}

// ─── Arquivos ────────────────────────────────────────────────────────────────

/** Nome seguro para o caminho no armazenamento. */
export function nomeSeguro(nome: string): string {
  const base = (nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return base.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'arquivo';
}

/** Problema com o PDF assinado (ou null se ok). */
export function problemaPdf(f: File): string | null {
  if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) return 'O arquivo final assinado deve ser PDF.';
  if (f.size > TAMANHO_MAX_ARQUIVO) return 'Arquivo acima de 20 MB.';
  if (f.size === 0) return 'Arquivo vazio.';
  return null;
}

/** Problema com o arquivo do modelo (ou null se ok). */
export function problemaModelo(f: File): string | null {
  const docx = f.type === MIME_DOCX || /\.docx$/i.test(f.name);
  const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  if (!docx && !pdf) return 'O modelo deve ser Word (.docx) ou PDF.';
  if (f.size > TAMANHO_MAX_ARQUIVO) return 'Arquivo acima de 20 MB.';
  if (f.size === 0) return 'Arquivo vazio.';
  return null;
}

export const ehDocx = (nome: string | null | undefined) => /\.docx$/i.test(nome || '');

// ─── Preenchimento de modelo (.docx) ─────────────────────────────────────────

export interface DadosModelo {
  numero: string;       // "473/2026"
  data: string;         // yyyy-MM-dd
  destinatario: string;
  assunto: string;
  categoria: string;
  descricao: string;
}

/** Campos que podem ser usados nos modelos, entre chaves. */
export const CAMPOS_MODELO: { tag: string; descricao: string }[] = [
  { tag: '{numero}', descricao: 'Número completo (ex.: 473/2026)' },
  { tag: '{data}', descricao: 'Data por extenso (ex.: 06 de novembro de 2026)' },
  { tag: '{data_curta}', descricao: 'Data (ex.: 06/11/2026)' },
  { tag: '{destinatario}', descricao: 'Destinatário' },
  { tag: '{assunto}', descricao: 'Assunto' },
  { tag: '{categoria}', descricao: 'Categoria' },
  { tag: '{descricao}', descricao: 'Descrição / texto do ofício' },
];

/**
 * Preenche um modelo .docx com os dados do ofício, preservando toda a
 * formatação. Campos desconhecidos continuam visíveis (ex.: {outro}), para
 * a pessoa completar no Word. Modelo sem campos sai idêntico.
 */
export function preencherModeloDocx(conteudo: ArrayBuffer, d: DadosModelo): Blob {
  const zip = new PizZip(conteudo);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part: { module?: string; value?: string }) => (part.module ? '' : `{${part.value ?? ''}}`),
  });
  doc.render({
    numero: d.numero,
    data: dataExtenso(d.data),
    data_curta: dataBR(d.data),
    destinatario: d.destinatario,
    assunto: d.assunto,
    categoria: d.categoria,
    descricao: d.descricao,
  });
  return doc.getZip().generate({ type: 'blob', mimeType: MIME_DOCX, compression: 'DEFLATE' });
}

/** Modelo escrito no editor (sem arquivo Word/PDF). */
export const ehModeloDeTexto = (m: Pick<OficioModelo, 'arquivo_path' | 'conteudo_html'> | null | undefined) =>
  !!m && !m.arquivo_path;
