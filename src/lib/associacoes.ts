/**
 * associacoes.ts — regras da página Associações: tipos, CNPJ, situação do
 * checklist de regularização (com validade dos documentos), regularidade e
 * métricas de uso dos maquinários cedidos. Tudo puro (testável).
 */
import { statusVencimento, DIAS_PROXIMO } from '@/lib/vencimento';

export const BUCKET_ASSOCIACOES = 'associacoes';
export const TAMANHO_MAX = 20 * 1024 * 1024;

export type SituacaoAssociacao = 'ativa' | 'inativa' | 'em_regularizacao';
export const SITUACOES_ASSOCIACAO: { id: SituacaoAssociacao; rotulo: string; classe: string; ajuda: string }[] = [
  { id: 'ativa', rotulo: 'Ativa', classe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', ajuda: 'Funcionando normalmente.' },
  { id: 'em_regularizacao', rotulo: 'Em regularização', classe: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30', ajuda: 'Providenciando documentos ou acertando pendências.' },
  { id: 'inativa', rotulo: 'Inativa', classe: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30', ajuda: 'Sem atividade no momento.' },
];
export const situacaoAssociacao = (s: string) => SITUACOES_ASSOCIACAO.find((x) => x.id === s) ?? SITUACOES_ASSOCIACAO[1];

export type TipoAssociacao = 'rural' | 'trabalhadores_rurais' | 'rural_e_trabalhadores';
export const TIPOS_ASSOCIACAO: { id: TipoAssociacao; rotulo: string }[] = [
  { id: 'rural', rotulo: 'Associação rural (produtores)' },
  { id: 'trabalhadores_rurais', rotulo: 'Trabalhadores rurais' },
  { id: 'rural_e_trabalhadores', rotulo: 'Produtores e trabalhadores rurais' },
];
export const tipoAssociacao = (t: string) => TIPOS_ASSOCIACAO.find((x) => x.id === t)?.rotulo ?? t;

export type CategoriaChecklist = 'constituicao' | 'diretoria' | 'fiscal' | 'trabalhista' | 'funcionamento' | 'outros';
export const CATEGORIAS_CHECKLIST: { id: CategoriaChecklist; rotulo: string; ajuda: string }[] = [
  { id: 'constituicao', rotulo: 'Constituição', ajuda: 'Documentos que provam que a associação existe legalmente.' },
  { id: 'diretoria', rotulo: 'Diretoria e associados', ajuda: 'Quem representa a associação e quem faz parte dela.' },
  { id: 'fiscal', rotulo: 'Certidões fiscais', ajuda: 'Comprovam que não há dívidas com os governos federal, estadual e municipal.' },
  { id: 'trabalhista', rotulo: 'Certidões trabalhistas', ajuda: 'FGTS e Justiça do Trabalho em dia.' },
  { id: 'funcionamento', rotulo: 'Funcionamento', ajuda: 'Sede, alvará e prestação de contas.' },
  { id: 'outros', rotulo: 'Outros', ajuda: 'Cadastros que abrem portas para programas (PNAE, PAA etc.).' },
];
export const categoriaChecklist = (c: string) => CATEGORIAS_CHECKLIST.find((x) => x.id === c)?.rotulo ?? c;

export interface Associacao {
  id: string;
  nome: string;
  sigla: string | null;
  cnpj: string | null;
  situacao: SituacaoAssociacao;
  tipo: TipoAssociacao;
  data_fundacao: string | null;
  settlement_id: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  presidente_nome: string | null;
  presidente_telefone: string | null;
  mandato_inicio: string | null;
  mandato_fim: string | null;
  numero_associados: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemChecklist {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: CategoriaChecklist;
  descricao: string | null;
  como_obter: string | null;
  link_oficial: string | null;
  obrigatorio: boolean;
  tem_validade: boolean;
  ordem: number;
  ativo: boolean;
}

export interface DocumentoAssociacao {
  id: string;
  associacao_id: string;
  item_id: string | null;
  titulo: string;
  numero: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  observacao: string | null;
  enviado_por: string | null;
  created_at: string;
}

export interface Dispensa { associacao_id: string; item_id: string; motivo: string; created_at: string }

export interface Cessao {
  id: string;
  associacao_id: string;
  machinery_id: string;
  data_cessao: string;
  data_devolucao: string | null;
  termo_path: string | null;
  termo_nome: string | null;
  observacao: string | null;
}

export interface AtendimentoAssociacao {
  id: string;
  associacao_id: string;
  producer_id: string | null;
  produtor_nome: string | null;
  demand_type_id: string;
  machinery_id: string | null;
  settlement_id: string | null;
  data_atendimento: string;
  horas: number | string | null;
  area_ha: number | string | null;
  combustivel_litros: number | string | null;
  observacao: string | null;
  created_at: string;
}

// ─── CNPJ ────────────────────────────────────────────────────────────────────

export const soDigitos = (v: string | null | undefined) => (v || '').replace(/\D/g, '');

/** CNPJ com dígitos verificadores corretos. */
export function cnpjValido(v: string | null | undefined): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, p, i) => t + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** "11222333000181" → "11.222.333/0001-81" (parcial enquanto digita). */
export function formatarCnpj(v: string | null | undefined): string {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// ─── Checklist e regularidade ────────────────────────────────────────────────

export type StatusItem = 'ok' | 'vencendo' | 'vencido' | 'pendente' | 'dispensado' | 'sem_validade';
export const STATUS_ITEM: Record<StatusItem, { rotulo: string; classe: string; ordem: number }> = {
  vencido: { rotulo: 'Vencido', classe: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30', ordem: 0 },
  pendente: { rotulo: 'Pendente', classe: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30', ordem: 1 },
  sem_validade: { rotulo: 'Falta a validade', classe: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30', ordem: 2 },
  vencendo: { rotulo: 'Vence em breve', classe: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30', ordem: 3 },
  ok: { rotulo: 'Em dia', classe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', ordem: 4 },
  dispensado: { rotulo: 'Não se aplica', classe: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30', ordem: 5 },
};

export interface SituacaoItem {
  item: ItemChecklist;
  status: StatusItem;
  /** Documento mais recente do item (o que vale). */
  documento: DocumentoAssociacao | null;
  /** Todos os documentos do item (histórico), do mais recente ao mais antigo. */
  historico: DocumentoAssociacao[];
  dispensa: Dispensa | null;
  diasParaVencer: number | null;
}

export interface Regularidade {
  itens: SituacaoItem[];
  /** Itens obrigatórios que contam (não dispensados). */
  obrigatorios: number;
  obrigatoriosEmDia: number;
  /** % dos obrigatórios em dia (0–100). */
  percentual: number;
  regular: boolean;
  pendencias: SituacaoItem[];  // obrigatórios vencidos/pendentes/sem validade
  vencendo: SituacaoItem[];    // em dia, mas vencendo nos próximos dias
}

const ordemDoc = (a: DocumentoAssociacao, b: DocumentoAssociacao) =>
  (b.data_emissao ?? '').localeCompare(a.data_emissao ?? '') || b.created_at.localeCompare(a.created_at);

/** Situação de um item do checklist para uma associação. */
export function situacaoDoItem(item: ItemChecklist, docs: DocumentoAssociacao[], dispensa: Dispensa | null): SituacaoItem {
  const historico = docs.filter((d) => d.item_id === item.id).sort(ordemDoc);
  const documento = historico[0] ?? null;
  if (dispensa) return { item, status: 'dispensado', documento, historico, dispensa, diasParaVencer: null };
  if (!documento) return { item, status: 'pendente', documento, historico, dispensa, diasParaVencer: null };
  if (!item.tem_validade) return { item, status: 'ok', documento, historico, dispensa, diasParaVencer: null };
  if (!documento.data_validade) return { item, status: 'sem_validade', documento, historico, dispensa, diasParaVencer: null };
  const v = statusVencimento(documento.data_validade);
  const status: StatusItem = v.status === 'vencido' ? 'vencido' : v.status === 'proximo' ? 'vencendo' : 'ok';
  return { item, status, documento, historico, dispensa, diasParaVencer: v.dias };
}

/** Regularidade da associação: obrigatórios em dia (vencendo ainda conta como em dia). */
export function calcularRegularidade(
  associacaoId: string, itens: ItemChecklist[], docs: DocumentoAssociacao[], dispensas: Dispensa[],
): Regularidade {
  const meusDocs = docs.filter((d) => d.associacao_id === associacaoId);
  const minhasDisp = dispensas.filter((x) => x.associacao_id === associacaoId);
  const lista = itens.filter((i) => i.ativo).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    .map((i) => situacaoDoItem(i, meusDocs, minhasDisp.find((x) => x.item_id === i.id) ?? null));
  const contam = lista.filter((s) => s.item.obrigatorio && s.status !== 'dispensado');
  const emDia = contam.filter((s) => s.status === 'ok' || s.status === 'vencendo');
  const pendencias = contam.filter((s) => s.status === 'vencido' || s.status === 'pendente' || s.status === 'sem_validade')
    .sort((a, b) => STATUS_ITEM[a.status].ordem - STATUS_ITEM[b.status].ordem);
  return {
    itens: lista,
    obrigatorios: contam.length,
    obrigatoriosEmDia: emDia.length,
    percentual: contam.length ? Math.round((emDia.length / contam.length) * 100) : 100,
    regular: pendencias.length === 0,
    pendencias,
    vencendo: lista.filter((s) => s.status === 'vencendo'),
  };
}

/** Mandato da diretoria vencido / vencendo. */
export function situacaoMandato(fim: string | null | undefined): 'sem_data' | 'ok' | 'vencendo' | 'vencido' {
  if (!fim) return 'sem_data';
  const v = statusVencimento(fim);
  return v.status === 'vencido' ? 'vencido' : v.status === 'proximo' ? 'vencendo' : 'ok';
}
export { DIAS_PROXIMO };

// ─── Métricas dos atendimentos das associações ───────────────────────────────

const num = (v: unknown) => Number(v) || 0;

export interface Totais { atendimentos: number; horas: number; area: number; combustivel: number; produtores: number }
function totais(lista: AtendimentoAssociacao[]): Totais {
  const prod = new Set(lista.map((a) => a.producer_id ?? `nome:${(a.produtor_nome || '').trim().toLowerCase()}`));
  return {
    atendimentos: lista.length,
    horas: lista.reduce((s, a) => s + num(a.horas), 0),
    area: lista.reduce((s, a) => s + num(a.area_ha), 0),
    combustivel: lista.reduce((s, a) => s + num(a.combustivel_litros), 0),
    produtores: lista.length ? prod.size : 0,
  };
}

export interface MetricasAtendimentos {
  total: Totais;
  porMes: (Totais & { mes: string })[];          // yyyy-MM, crescente
  porMaquina: (Totais & { chave: string })[];    // machinery_id ('' = sem máquina)
  porTipo: (Totais & { chave: string })[];       // demand_type_id
  porAssociacao: (Totais & { chave: string })[]; // associacao_id
}

function agrupar(lista: AtendimentoAssociacao[], chave: (a: AtendimentoAssociacao) => string) {
  const m = new Map<string, AtendimentoAssociacao[]>();
  lista.forEach((a) => { const k = chave(a); m.set(k, [...(m.get(k) ?? []), a]); });
  return Array.from(m.entries()).map(([k, l]) => ({ chave: k, ...totais(l) })).sort((a, b) => b.horas - a.horas || b.atendimentos - a.atendimentos);
}

export function calcularMetricas(lista: AtendimentoAssociacao[]): MetricasAtendimentos {
  return {
    total: totais(lista),
    porMes: agrupar(lista, (a) => a.data_atendimento.slice(0, 7)).map(({ chave, ...t }) => ({ mes: chave, ...t })).sort((a, b) => a.mes.localeCompare(b.mes)),
    porMaquina: agrupar(lista, (a) => a.machinery_id ?? ''),
    porTipo: agrupar(lista, (a) => a.demand_type_id),
    porAssociacao: agrupar(lista, (a) => a.associacao_id),
  };
}

/** Máquinas cedidas no momento (sem devolução). */
export const cessoesAtivas = (cessoes: Cessao[]) => cessoes.filter((c) => !c.data_devolucao);

export function nomeSeguroArquivo(nome: string): string {
  const base = (nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return base.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'arquivo';
}

export function problemaArquivo(f: File): string | null {
  const ok = /\.(pdf|jpe?g|png|webp|docx)$/i.test(f.name);
  if (!ok) return 'Envie PDF, foto (JPG/PNG) ou Word (.docx).';
  if (f.size > TAMANHO_MAX) return 'Arquivo acima de 20 MB.';
  if (f.size === 0) return 'Arquivo vazio.';
  return null;
}

export function tipoMime(nome: string): string {
  if (/\.pdf$/i.test(nome)) return 'application/pdf';
  if (/\.png$/i.test(nome)) return 'image/png';
  if (/\.webp$/i.test(nome)) return 'image/webp';
  if (/\.jpe?g$/i.test(nome)) return 'image/jpeg';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}
