// Vitrine da Agricultura Familiar — rótulos e listas (espelham os CHECKs do banco).

type Opt = { value: string; label: string };
const labelOf = (list: Opt[], v?: string | null) => list.find((o) => o.value === v)?.label ?? v ?? '—';

export const CATEGORIAS: Opt[] = [
  { value: 'hortalica', label: 'Hortaliças' },
  { value: 'fruta', label: 'Frutas' },
  { value: 'raiz_tuberculo', label: 'Raízes e tubérculos' },
  { value: 'grao', label: 'Grãos' },
  { value: 'origem_animal', label: 'Origem animal' },
  { value: 'processado', label: 'Processados' },
  { value: 'outro', label: 'Outros' },
];

export const UNIDADES: Opt[] = [
  { value: 'kg', label: 'kg' },
  { value: 'unidade', label: 'unidade' },
  { value: 'caixa', label: 'caixa' },
  { value: 'duzia', label: 'dúzia' },
  { value: 'maco', label: 'maço' },
  { value: 'saco', label: 'saco' },
  { value: 'litro', label: 'litro' },
  { value: 'bandeja', label: 'bandeja' },
  { value: 'pacote', label: 'pacote' },
  { value: 'pote', label: 'pote' },
  { value: 'outra', label: 'outra' },
];

export const PERFIS: Opt[] = [
  { value: 'agricultor_familiar', label: 'Agricultor familiar' },
  { value: 'assentado', label: 'Assentado' },
  { value: 'pequeno_produtor', label: 'Pequeno produtor' },
  { value: 'cooperado', label: 'Cooperado' },
  { value: 'associacao', label: 'Associação' },
  { value: 'quilombola', label: 'Quilombola' },
  { value: 'indigena', label: 'Indígena' },
  { value: 'outro', label: 'Outro' },
];

export const PROGRAMAS: Opt[] = [
  { value: 'pnae', label: 'PNAE' },
  { value: 'paa', label: 'PAA' },
  { value: 'feiras', label: 'Feiras municipais' },
  { value: 'hospitais', label: 'Hospitais' },
  { value: 'assistencia_social', label: 'Assistência social' },
  { value: 'outros_programas', label: 'Outros programas públicos' },
  { value: 'venda_institucional', label: 'Venda institucional em geral' },
];

export const STATUS: (Opt & { cls: string })[] = [
  { value: 'recebido',   label: 'Recebido',   cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400' },
  { value: 'em_analise', label: 'Em análise', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400' },
  { value: 'pendencia',  label: 'Pendência',  cls: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400' },
  { value: 'validado',   label: 'Validado',   cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' },
  { value: 'inativo',    label: 'Inativo',    cls: 'bg-muted text-muted-foreground' },
];

export const GENEROS: Opt[] = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'outro', label: 'Outro' },
  { value: 'nao_informado', label: 'Prefere não informar' },
];

export const FORMAS: Opt[] = [
  { value: 'in_natura', label: 'In natura' },
  { value: 'beneficiado', label: 'Beneficiado' },
  { value: 'processado', label: 'Processado' },
  { value: 'congelado', label: 'Congelado' },
  { value: 'resfriado', label: 'Resfriado' },
];

export const FREQUENCIAS: Opt[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'sob_demanda', label: 'Sob demanda' },
];

export const PRECO_INCLUI: Opt[] = [
  { value: 'embalagem', label: 'Embalagem' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'higienizacao', label: 'Higienização' },
  { value: 'processamento', label: 'Processamento' },
];

export const TIPOS_DOC: Opt[] = [
  { value: 'caf', label: 'CAF' },
  { value: 'dap', label: 'DAP (histórico)' },
  { value: 'rg', label: 'RG' },
  { value: 'comprovante_endereco', label: 'Comprovante de endereço' },
  { value: 'documento_propriedade', label: 'Documento da propriedade/posse' },
  { value: 'inscricao_estadual', label: 'Inscrição estadual' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'certidao', label: 'Certidão' },
  { value: 'sanitario', label: 'Documentação sanitária' },
  { value: 'licenca', label: 'Licença/autorização' },
  { value: 'outro', label: 'Outro' },
];

export const SITUACOES_DOC: (Opt & { cls: string })[] = [
  { value: 'enviado',  label: 'Enviado',  cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400' },
  { value: 'validado', label: 'Validado', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' },
  { value: 'recusado', label: 'Recusado', cls: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400' },
];

/** Situação da OFERTA na seleção da equipe. */
export const SITUACOES_OFERTA: (Opt & { cls: string; dot: string; desc: string })[] = [
  { value: 'disponivel', label: 'Disponível', cls: 'bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300', dot: 'bg-slate-400', desc: 'Cadastrada, ainda não conferida' },
  { value: 'validada',   label: 'Validada',   cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400',     dot: 'bg-blue-500',  desc: 'Conferida pela equipe (quantidade, preço, período)' },
  { value: 'aceita',     label: 'Aceita',     cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400', dot: 'bg-emerald-500', desc: 'Selecionada para um programa' },
  { value: 'suspensa',   label: 'Suspensa',   cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/50', desc: 'Fora de uso no momento' },
];
export const situacaoOfertaInfo = (v?: string | null) => SITUACOES_OFERTA.find((s) => s.value === v) ?? SITUACOES_OFERTA[0];

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const categoriaLabel = (v?: string | null) => labelOf(CATEGORIAS, v);
export const unidadeLabel = (v?: string | null) => labelOf(UNIDADES, v);
export const programaLabel = (v?: string | null) => labelOf(PROGRAMAS, v);
export const perfilLabel = (v?: string | null) => labelOf(PERFIS, v);
export const formaLabel = (v?: string | null) => labelOf(FORMAS, v);
export const frequenciaLabel = (v?: string | null) => labelOf(FREQUENCIAS, v);
export const tipoDocLabel = (v?: string | null) => labelOf(TIPOS_DOC, v);
export const statusInfo = (v?: string | null) => STATUS.find((s) => s.value === v) ?? STATUS[1];
export const situacaoDocInfo = (v?: string | null) => SITUACOES_DOC.find((s) => s.value === v) ?? SITUACOES_DOC[0];

/** "Mar–Jun" / "Ano todo" / "Jan, Mar, Out" a partir dos meses (1..12). */
export function mesesResumo(meses?: number[] | null): string {
  const m = [...new Set(meses ?? [])].filter((x) => x >= 1 && x <= 12).sort((a, b) => a - b);
  if (m.length === 0) return '—';
  if (m.length === 12) return 'Ano todo';
  // Período contínuo, inclusive atravessando a virada do ano (ex.: Nov–Mar):
  // há exatamente UM mês marcado cujo mês anterior não está marcado.
  const set = new Set(m);
  const inicios = m.filter((x) => !set.has(x === 1 ? 12 : x - 1));
  if (inicios.length === 1 && m.length >= 3) {
    const ini = inicios[0];
    const fim = ((ini - 1 + m.length - 1) % 12) + 1;
    return `${MESES[ini - 1]}–${MESES[fim - 1]}`;
  }
  return m.map((x) => MESES[x - 1]).join(', ');
}

export const fmtNum = (n?: number | null) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const fmtBRL = (n?: number | null) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
