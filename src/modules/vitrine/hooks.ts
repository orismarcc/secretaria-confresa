// Vitrine da Agricultura Familiar — acesso a dados (módulo isolado).
// As tabelas vitrine_* ainda não estão nos tipos gerados do Supabase, por isso
// o `as any` no nome da tabela (mesmo padrão já usado no projeto).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';

const t = (name: string) => supabase.from(name as any) as any;
export const DOCS_BUCKET = 'vitrine-docs';

// ─── Tipos ──────────────────────────────────────────────────────────────────
export interface Produto { id: string; nome: string; categoria: string; unidade_padrao: string; ativo: boolean }
export interface Variedade { id: string; produto_id: string; nome: string; ativo: boolean }
export interface Fornecedor {
  id: string; producer_id: string | null; nome: string; telefone: string | null; whatsapp: string | null;
  email: string | null; settlement_id: string | null; localidade: string | null; data_nascimento: string | null;
  genero: string | null; perfis: string[]; programas: string[]; aceita_contato: boolean; status: string;
  origem: string; observacao_interna: string | null; validado_por: string | null; validado_em: string | null;
  latitude: number | null; longitude: number | null;
  created_at: string; updated_at: string;
  settlements?: { name: string } | null;
}
export interface Oferta {
  id: string; fornecedor_id: string; produto_id: string; variedade_id: string | null; unidade: string;
  qtd_mensal: number | null; capacidade_mensal: number | null; meses: number[]; forma: string | null;
  embalagem: string | null; preco: number | null; preco_entregue: boolean; preco_inclui: string[];
  frequencia: string | null; entrega_propria: boolean | null; emite_nota: boolean | null;
  validade_dias: number | null; registro_sanitario: string | null; observacao: string | null;
  ativo: boolean; preco_atualizado_em: string | null; updated_at: string;
  situacao: string; programa: string | null; qtd_aceita: number | null; situacao_em: string | null;
  vitrine_produtos?: { nome: string; categoria: string } | null;
  vitrine_variedades?: { nome: string } | null;
  vitrine_fornecedores?: { nome: string; status: string; settlement_id: string | null; settlements?: { name: string } | null } | null;
}
export interface Documento {
  id: string; fornecedor_id: string; tipo: string; numero: string | null; validade: string | null;
  file_path: string | null; situacao: string; observacao: string | null; created_at: string;
  vitrine_fornecedores?: { nome: string } | null;
}

function useMut<V>(fn: (v: V) => Promise<unknown>, keys: string[][], okMsg: string, errMsg: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { keys.forEach((k) => qc.invalidateQueries({ queryKey: k })); if (okMsg) toast({ title: okMsg }); },
    onError: (e: Error) => toast({ title: errMsg, description: friendlyDbError(e), variant: 'destructive' }),
  });
}
const check = ({ error }: { error: unknown }) => { if (error) throw error; };

// ─── Catálogo ───────────────────────────────────────────────────────────────
export function useProdutos() {
  return useQuery({
    queryKey: ['vitrine', 'produtos'],
    queryFn: async () => {
      const { data, error } = await t('vitrine_produtos').select('id, nome, categoria, unidade_padrao, ativo').order('nome');
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });
}
export function useVariedades() {
  return useQuery({
    queryKey: ['vitrine', 'variedades'],
    queryFn: async () => {
      const { data, error } = await t('vitrine_variedades').select('id, produto_id, nome, ativo').order('nome');
      if (error) throw error;
      return (data ?? []) as Variedade[];
    },
  });
}
export const useSaveProduto = () => useMut(
  async (p: Partial<Produto> & { id?: string }) => {
    const { id, ...rest } = p;
    check(id ? await t('vitrine_produtos').update(rest).eq('id', id) : await t('vitrine_produtos').insert(rest));
  },
  [['vitrine', 'produtos']], 'Produto salvo!', 'Erro ao salvar produto',
);
export const useSaveVariedade = () => useMut(
  async (v: Partial<Variedade> & { id?: string }) => {
    const { id, ...rest } = v;
    check(id ? await t('vitrine_variedades').update(rest).eq('id', id) : await t('vitrine_variedades').insert(rest));
  },
  [['vitrine', 'variedades']], 'Variedade salva!', 'Erro ao salvar variedade',
);

// ─── Fornecedores ───────────────────────────────────────────────────────────
export function useFornecedores() {
  return useQuery({
    queryKey: ['vitrine', 'fornecedores'],
    queryFn: async () => {
      const { data, error } = await t('vitrine_fornecedores').select('*, settlements(name)').order('nome');
      if (error) throw error;
      return (data ?? []) as Fornecedor[];
    },
  });
}
export const useSaveFornecedor = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (f: Partial<Fornecedor> & { id?: string }): Promise<string> => {
      const { id, settlements: _s, ...rest } = f as any;
      if (id) {
        check(await t('vitrine_fornecedores').update(rest).eq('id', id));
        return id;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await t('vitrine_fornecedores')
        .insert({ ...rest, created_by: auth?.user?.id ?? null }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vitrine'] }); toast({ title: 'Fornecedor salvo!' }); },
    onError: (e: Error) => {
      const dup = /uq_vitrine_fornecedores_producer/.test(e.message);
      toast({
        title: 'Erro ao salvar fornecedor',
        description: dup ? 'Este produtor rural já está cadastrado na vitrine.' : friendlyDbError(e),
        variant: 'destructive',
      });
    },
  });
};
export const useSetStatusFornecedor = () => useMut(
  async ({ id, status }: { id: string; status: string }) => {
    const { data: auth } = await supabase.auth.getUser();
    const extra = status === 'validado' ? { validado_por: auth?.user?.id ?? null, validado_em: new Date().toISOString() } : {};
    check(await t('vitrine_fornecedores').update({ status, ...extra }).eq('id', id));
  },
  [['vitrine']], 'Situação atualizada!', 'Erro ao atualizar situação',
);
export const useDeleteFornecedor = () => useMut(
  async (id: string) => { check(await t('vitrine_fornecedores').delete().eq('id', id)); },
  [['vitrine']], 'Fornecedor removido.', 'Erro ao remover fornecedor',
);

// ─── Ofertas ────────────────────────────────────────────────────────────────
const OFERTA_SELECT = '*, vitrine_produtos(nome, categoria), vitrine_variedades(nome), vitrine_fornecedores(nome, status, settlement_id, settlements(name))';
export function useOfertas() {
  return useQuery({
    queryKey: ['vitrine', 'ofertas'],
    queryFn: async () => {
      const { data, error } = await t('vitrine_ofertas').select(OFERTA_SELECT).order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Oferta[];
    },
  });
}
export const useSaveOferta = () => useMut(
  async (o: Partial<Oferta> & { id?: string }) => {
    const { id, vitrine_produtos: _p, vitrine_variedades: _v, vitrine_fornecedores: _f, ...rest } = o as any;
    if (id) { check(await t('vitrine_ofertas').update(rest).eq('id', id)); return; }
    const { data: auth } = await supabase.auth.getUser();
    check(await t('vitrine_ofertas').insert({ ...rest, created_by: auth?.user?.id ?? null }));
  },
  [['vitrine']], 'Oferta salva!', 'Erro ao salvar oferta',
);
export const useDeleteOferta = () => useMut(
  async (id: string) => { check(await t('vitrine_ofertas').delete().eq('id', id)); },
  [['vitrine']], 'Oferta removida.', 'Erro ao remover oferta',
);
export const useSetSituacaoOferta = () => useMut(
  async ({ id, situacao, programa, qtd_aceita }: { id: string; situacao: string; programa?: string | null; qtd_aceita?: number | null }) => {
    const payload: any = { situacao };
    if (situacao === 'aceita') { payload.programa = programa ?? null; payload.qtd_aceita = qtd_aceita ?? null; }
    check(await t('vitrine_ofertas').update(payload).eq('id', id));
  },
  [['vitrine', 'ofertas']], 'Situação da oferta atualizada!', 'Erro ao atualizar a oferta',
);

/**
 * Histórico de preço de VÁRIAS ofertas juntas (ex.: todas as ofertas do mesmo
 * produto/variedade de um fornecedor) — assim o histórico não se perde quando
 * alguém cadastra uma oferta nova em vez de editar a existente.
 */
export function usePrecosHistDe(ofertaIds: string[]) {
  const key = [...ofertaIds].sort().join(',');
  return useQuery({
    queryKey: ['vitrine', 'precos_hist', key],
    enabled: ofertaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await t('vitrine_precos_hist')
        .select('id, oferta_id, preco, preco_entregue, unidade, registrado_em').in('oferta_id', ofertaIds).order('registrado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; oferta_id: string; preco: number | null; preco_entregue: boolean | null; unidade: string | null; registrado_em: string }[];
    },
  });
}

export function usePrecosHist(ofertaId: string | null) {
  return useQuery({
    queryKey: ['vitrine', 'precos_hist', ofertaId],
    enabled: !!ofertaId,
    queryFn: async () => {
      const { data, error } = await t('vitrine_precos_hist')
        .select('id, preco, preco_entregue, unidade, registrado_em').eq('oferta_id', ofertaId).order('registrado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; preco: number | null; preco_entregue: boolean | null; unidade: string | null; registrado_em: string }[];
    },
  });
}

// ─── Documentos ─────────────────────────────────────────────────────────────
export function useDocumentos() {
  return useQuery({
    queryKey: ['vitrine', 'documentos'],
    queryFn: async () => {
      const { data, error } = await t('vitrine_documentos').select('*, vitrine_fornecedores(nome)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });
}
export const useSaveDocumento = () => useMut(
  async ({ file, ...d }: Partial<Documento> & { id?: string; file?: File | null }) => {
    // Só grava file_path quando há arquivo NOVO — atualizar apenas a situação
    // (ou outro campo) nunca apaga o vínculo com o arquivo já anexado.
    const payload: any = { ...d };
    if (file) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${d.fornecedor_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      payload.file_path = path;
    }
    const { id, vitrine_fornecedores: _f, ...rest } = payload;
    if (id) { check(await t('vitrine_documentos').update(rest).eq('id', id)); return; }
    const { data: auth } = await supabase.auth.getUser();
    check(await t('vitrine_documentos').insert({ ...rest, created_by: auth?.user?.id ?? null }));
  },
  [['vitrine', 'documentos']], 'Documento salvo!', 'Erro ao salvar documento',
);
export const useDeleteDocumento = () => useMut(
  async (doc: Documento) => {
    check(await t('vitrine_documentos').delete().eq('id', doc.id));
    if (doc.file_path) await supabase.storage.from(DOCS_BUCKET).remove([doc.file_path]);
  },
  [['vitrine', 'documentos']], 'Documento removido.', 'Erro ao remover documento',
);
export async function openDocumento(path: string) {
  const { data } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
