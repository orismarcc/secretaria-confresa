/**
 * useAssociacoes.ts — dados da página Associações (Supabase): cadastro,
 * checklist, documentos, dispensas, maquinário cedido e atendimentos.
 * Arquivos no armazenamento privado, abertos por link temporário.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { friendlyDbError } from '@/lib/dbErrors';
import { useToast } from '@/hooks/use-toast';
import {
  BUCKET_ASSOCIACOES, nomeSeguroArquivo, tipoMime,
  type Associacao, type AtendimentoAssociacao, type Cessao, type Dispensa, type DocumentoAssociacao, type ItemChecklist,
} from '@/lib/associacoes';

// Tabelas novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const storage = () => supabase.storage.from(BUCKET_ASSOCIACOES);

export const QK_ASSOC = {
  associacoes: ['associacoes'] as const,
  itens: ['associacao_checklist_itens'] as const,
  documentos: ['associacao_documentos'] as const,
  dispensas: ['associacao_dispensas'] as const,
  cessoes: ['associacao_cessoes'] as const,
  atendimentos: ['associacao_atendimentos'] as const,
};

function useTabela<T>(chave: readonly string[], tabela: string, ordem: [string, boolean][]) {
  return useQuery({
    queryKey: chave,
    queryFn: async () => fetchAllRows<T>(() => {
      let q = db.from(tabela).select('*');
      ordem.forEach(([c, asc]) => { q = q.order(c, { ascending: asc }); });
      return q;
    }),
  });
}

export const useAssociacoes = () => useTabela<Associacao>(QK_ASSOC.associacoes, 'associacoes', [['nome', true], ['id', true]]);
export const useItensChecklist = () => useTabela<ItemChecklist>(QK_ASSOC.itens, 'associacao_checklist_itens', [['ordem', true], ['id', true]]);
export const useDocumentosAssociacoes = () => useTabela<DocumentoAssociacao>(QK_ASSOC.documentos, 'associacao_documentos', [['created_at', false], ['id', true]]);
export const useDispensas = () => useTabela<Dispensa>(QK_ASSOC.dispensas, 'associacao_dispensas', [['created_at', true], ['item_id', true]]);
export const useCessoes = () => useTabela<Cessao>(QK_ASSOC.cessoes, 'associacao_cessoes', [['data_cessao', false], ['id', true]]);
export const useAtendimentosAssociacoes = () => useTabela<AtendimentoAssociacao>(QK_ASSOC.atendimentos, 'associacao_atendimentos', [['data_atendimento', false], ['id', true]]);

// ─── Arquivos ────────────────────────────────────────────────────────────────

export async function abrirArquivoAssociacao(path: string, baixarComo?: string): Promise<void> {
  const aba = baixarComo ? null : window.open('', '_blank'); // antes do await (iPhone)
  const { data, error } = await storage().createSignedUrl(path, 300, baixarComo ? { download: baixarComo } : undefined);
  if (error || !data?.signedUrl) { aba?.close(); throw error ?? new Error('Arquivo não encontrado.'); }
  if (aba) { aba.location.href = data.signedUrl; return; }
  const a = document.createElement('a');
  a.href = data.signedUrl; a.download = baixarComo ?? '';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function enviarArquivo(pasta: string, file: File): Promise<{ path: string; nome: string; tamanho: number }> {
  const path = `${pasta}/${Date.now()}-${nomeSeguroArquivo(file.name)}`;
  const { error } = await storage().upload(path, file, { contentType: tipoMime(file.name), upsert: false });
  if (error) throw error;
  return { path, nome: file.name.slice(0, 200), tamanho: file.size };
}
const removerArquivos = async (paths: (string | null | undefined)[]) => {
  const p = paths.filter(Boolean) as string[];
  if (p.length) { try { await storage().remove(p); } catch { /* melhor esforço */ } }
};

function useMutacao<TArgs, TRes>(fn: (a: TArgs) => Promise<TRes>, opts: {
  invalidar: (readonly string[])[]; sucesso?: (r: TRes) => string | null; erro: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      opts.invalidar.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      const msg = opts.sucesso?.(r);
      if (msg) toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: opts.erro, description: friendlyDbError(e), variant: 'destructive' }),
  });
}

// ─── Associação ──────────────────────────────────────────────────────────────

export type AssociacaoEntrada = Omit<Associacao, 'id' | 'created_at' | 'updated_at'>;

export const useSalvarAssociacao = () => useMutacao(
  async ({ id, dados }: { id?: string; dados: AssociacaoEntrada }) => {
    const q = id ? db.from('associacoes').update(dados).eq('id', id) : db.from('associacoes').insert(dados);
    const { data, error } = await q.select().single();
    if (error) throw error;
    return { assoc: data as Associacao, novo: !id };
  },
  { invalidar: [QK_ASSOC.associacoes], sucesso: (r) => `Associação "${r.assoc.nome}" ${r.novo ? 'cadastrada' : 'atualizada'}`, erro: 'Erro ao salvar a associação' },
);

export const useExcluirAssociacao = () => useMutacao(
  async (a: Associacao) => {
    const [{ data: docs }, { data: ces }] = await Promise.all([
      db.from('associacao_documentos').select('arquivo_path').eq('associacao_id', a.id),
      db.from('associacao_cessoes').select('termo_path').eq('associacao_id', a.id),
    ]);
    const { error } = await db.from('associacoes').delete().eq('id', a.id);
    if (error) throw error;
    await removerArquivos([...(docs ?? []).map((d: { arquivo_path: string }) => d.arquivo_path), ...(ces ?? []).map((c: { termo_path: string }) => c.termo_path)]);
    return a;
  },
  { invalidar: Object.values(QK_ASSOC), sucesso: (a) => `Associação "${a.nome}" excluída`, erro: 'Erro ao excluir a associação' },
);

// ─── Documentos ──────────────────────────────────────────────────────────────

export interface DocumentoEntrada {
  associacao_id: string;
  item_id: string | null;
  titulo: string;
  numero: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  observacao: string | null;
}

export const useSalvarDocumento = () => useMutacao(
  async ({ id, dados, arquivo, arquivoAnterior }: { id?: string; dados: DocumentoEntrada; arquivo?: File | null; arquivoAnterior?: string | null }) => {
    const up = arquivo ? await enviarArquivo(`${dados.associacao_id}/documentos`, arquivo) : null;
    const campos = { ...dados, ...(up ? { arquivo_path: up.path, arquivo_nome: up.nome, arquivo_tamanho: up.tamanho } : {}) };
    const q = id ? db.from('associacao_documentos').update(campos).eq('id', id) : db.from('associacao_documentos').insert(campos);
    const { data, error } = await q.select().single();
    if (error) { if (up) await removerArquivos([up.path]); throw error; }
    if (up && arquivoAnterior) await removerArquivos([arquivoAnterior]);
    return { doc: data as DocumentoAssociacao, novo: !id };
  },
  { invalidar: [QK_ASSOC.documentos], sucesso: (r) => (r.novo ? 'Documento adicionado' : 'Documento atualizado'), erro: 'Erro ao salvar o documento' },
);

export const useExcluirDocumento = () => useMutacao(
  async (d: DocumentoAssociacao) => {
    const { error } = await db.from('associacao_documentos').delete().eq('id', d.id);
    if (error) throw error;
    await removerArquivos([d.arquivo_path]);
    return d;
  },
  { invalidar: [QK_ASSOC.documentos], sucesso: () => 'Documento excluído', erro: 'Erro ao excluir o documento' },
);

export const useDispensarItem = () => useMutacao(
  async ({ associacao_id, item_id, motivo }: { associacao_id: string; item_id: string; motivo: string | null }) => {
    const { error } = motivo
      ? await db.from('associacao_dispensas').upsert({ associacao_id, item_id, motivo })
      : await db.from('associacao_dispensas').delete().eq('associacao_id', associacao_id).eq('item_id', item_id);
    if (error) throw error;
    return !!motivo;
  },
  { invalidar: [QK_ASSOC.dispensas], sucesso: (d) => (d ? 'Item marcado como "não se aplica"' : 'Item voltou a contar no checklist'), erro: 'Erro ao atualizar o item' },
);

// ─── Itens do checklist (configuração) ───────────────────────────────────────

export type ItemEntrada = Omit<ItemChecklist, 'id' | 'codigo'>;
export const useSalvarItemChecklist = () => useMutacao(
  async ({ id, dados }: { id?: string; dados: ItemEntrada }) => {
    const q = id ? db.from('associacao_checklist_itens').update(dados).eq('id', id) : db.from('associacao_checklist_itens').insert(dados);
    const { data, error } = await q.select().single();
    if (error) throw error;
    return data as ItemChecklist;
  },
  { invalidar: [QK_ASSOC.itens], sucesso: (i) => `Item "${i.nome}" salvo`, erro: 'Erro ao salvar o item do checklist' },
);

// ─── Maquinário cedido ───────────────────────────────────────────────────────

export interface CessaoEntrada {
  associacao_id: string;
  machinery_id: string;
  data_cessao: string;
  data_devolucao: string | null;
  observacao: string | null;
}

export const useSalvarCessao = () => useMutacao(
  async ({ id, dados, termo, termoAnterior }: { id?: string; dados: CessaoEntrada; termo?: File | null; termoAnterior?: string | null }) => {
    const up = termo ? await enviarArquivo(`${dados.associacao_id}/cessoes`, termo) : null;
    const campos = { ...dados, ...(up ? { termo_path: up.path, termo_nome: up.nome } : {}) };
    const q = id ? db.from('associacao_cessoes').update(campos).eq('id', id) : db.from('associacao_cessoes').insert(campos);
    const { data, error } = await q.select().single();
    if (error) {
      if (up) await removerArquivos([up.path]);
      if (/associacao_cessoes_maquina_ativa|duplicate key/i.test(error.message || '')) {
        throw new Error('Esta máquina já está cedida a uma associação. Registre a devolução antes de ceder de novo.');
      }
      throw error;
    }
    if (up && termoAnterior) await removerArquivos([termoAnterior]);
    return { cessao: data as Cessao, novo: !id };
  },
  { invalidar: [QK_ASSOC.cessoes], sucesso: (r) => (r.novo ? 'Cessão registrada' : 'Cessão atualizada'), erro: 'Erro ao salvar a cessão' },
);

export const useExcluirCessao = () => useMutacao(
  async (c: Cessao) => {
    const { error } = await db.from('associacao_cessoes').delete().eq('id', c.id);
    if (error) throw error;
    await removerArquivos([c.termo_path]);
    return c;
  },
  { invalidar: [QK_ASSOC.cessoes], sucesso: () => 'Cessão excluída', erro: 'Erro ao excluir a cessão' },
);

// ─── Atendimentos das associações ────────────────────────────────────────────

export interface AtendimentoEntrada {
  associacao_id: string;
  producer_id: string | null;
  produtor_nome: string | null;
  demand_type_id: string;
  machinery_id: string | null;
  settlement_id: string | null;
  data_atendimento: string;
  horas: number | null;
  area_ha: number | null;
  combustivel_litros: number | null;
  observacao: string | null;
}

export const useSalvarAtendimentoAssociacao = () => useMutacao(
  async ({ id, dados }: { id?: string; dados: AtendimentoEntrada }) => {
    const q = id ? db.from('associacao_atendimentos').update(dados).eq('id', id) : db.from('associacao_atendimentos').insert(dados);
    const { data, error } = await q.select().single();
    if (error) throw error;
    return { at: data as AtendimentoAssociacao, novo: !id };
  },
  { invalidar: [QK_ASSOC.atendimentos], sucesso: (r) => (r.novo ? 'Atendimento registrado' : 'Atendimento atualizado'), erro: 'Erro ao salvar o atendimento' },
);

export const useExcluirAtendimentoAssociacao = () => useMutacao(
  async (a: AtendimentoAssociacao) => {
    const { error } = await db.from('associacao_atendimentos').delete().eq('id', a.id);
    if (error) throw error;
    return a;
  },
  { invalidar: [QK_ASSOC.atendimentos], sucesso: () => 'Atendimento excluído', erro: 'Erro ao excluir o atendimento' },
);
