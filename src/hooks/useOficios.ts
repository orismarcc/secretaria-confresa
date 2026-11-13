/**
 * useOficios.ts — dados da página Ofícios (Supabase): ofícios, histórico de
 * arquivos assinados, modelos e arquivos no armazenamento privado.
 * Os links de arquivo são temporários e gerados na hora (nunca ficam salvos).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';
import { friendlyDbError } from '@/lib/dbErrors';
import { useToast } from '@/hooks/use-toast';
import {
  BUCKET_OFICIOS, nomeSeguro, numeroCompleto,
  type Oficio, type OficioArquivo, type OficioModelo, type SituacaoOficio,
} from '@/lib/oficios';

// Tabelas novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const storage = () => supabase.storage.from(BUCKET_OFICIOS);

const QK = {
  oficios: ['oficios'] as const,
  arquivos: (id: string) => ['oficio_arquivos', id] as const,
  modelos: ['oficio_modelos'] as const,
};

export function useOficios(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QK.oficios,
    enabled: opts?.enabled ?? true,
    queryFn: async () => fetchAllRows<Oficio>(() => db.from('oficios').select('*')
      .order('ano', { ascending: false }).order('numero', { ascending: false }).order('id', { ascending: true })),
  });
}

export function useOficioArquivos(oficioId: string | null) {
  return useQuery({
    queryKey: QK.arquivos(oficioId ?? ''),
    enabled: !!oficioId,
    queryFn: async () => {
      const { data, error } = await db.from('oficio_arquivos').select('*')
        .eq('oficio_id', oficioId).order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OficioArquivo[];
    },
  });
}

export function useOficioModelos() {
  return useQuery({
    queryKey: QK.modelos,
    queryFn: async () => {
      const { data, error } = await db.from('oficio_modelos').select('*').order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OficioModelo[];
    },
  });
}

/** Nomes das pessoas (para "enviado por" / "cadastrado por"). */
export function useNomesPessoas() {
  return useQuery({
    queryKey: ['profiles_nomes'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, name');
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id as string, (p.name as string) || '']));
    },
  });
}

// ─── Arquivos ────────────────────────────────────────────────────────────────

/** Abre (ou baixa) um arquivo guardado, por link temporário de 5 minutos. */
export async function abrirArquivoOficio(path: string, baixarComo?: string): Promise<void> {
  // Abre a aba antes do await: no iPhone, abrir depois é bloqueado como pop-up.
  const aba = baixarComo ? null : window.open('', '_blank');
  const { data, error } = await storage().createSignedUrl(path, 300, baixarComo ? { download: baixarComo } : undefined);
  if (error || !data?.signedUrl) {
    aba?.close();
    throw error ?? new Error('Arquivo não encontrado.');
  }
  if (aba) { aba.location.href = data.signedUrl; return; }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = baixarComo ?? '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Conteúdo de um arquivo guardado (para preencher modelos). */
export async function baixarConteudoOficio(path: string): Promise<ArrayBuffer> {
  const { data, error } = await storage().download(path);
  if (error || !data) throw error ?? new Error('Arquivo não encontrado.');
  return data.arrayBuffer();
}

async function enviarParaArmazenamento(path: string, file: File): Promise<void> {
  const tipo = /\.pdf$/i.test(file.name) ? 'application/pdf' : (file.type || 'application/octet-stream');
  const { error } = await storage().upload(path, file, { contentType: tipo, upsert: false });
  if (error) throw error;
}

/** Envia o PDF assinado e registra como nova versão (histórico). */
async function registrarArquivo(oficio: Pick<Oficio, 'id' | 'arquivo_versao'>, file: File, motivo?: string): Promise<number> {
  const path = `${oficio.id}/v${(oficio.arquivo_versao || 0) + 1}-${Date.now()}-${nomeSeguro(file.name)}`;
  await enviarParaArmazenamento(path, file);
  const { data, error } = await db.rpc('registrar_arquivo_oficio', {
    _oficio_id: oficio.id, _path: path, _nome: file.name.slice(0, 200), _tamanho: file.size, _motivo: motivo ?? null,
  });
  if (error) {
    await storage().remove([path]); // não deixa arquivo órfão
    throw error;
  }
  return data as number;
}

// ─── Ofícios ─────────────────────────────────────────────────────────────────

export interface OficioEntrada {
  numero: number | null; // null = próximo do ano (definido no banco)
  data_oficio: string;
  destinatario: string;
  assunto: string;
  categoria: string;
  situacao: SituacaoOficio;
  descricao: string | null;
  modelo_id: string | null;
}

export function useSalvarOficio() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, dados, arquivo }: { id?: string; dados: OficioEntrada; arquivo?: File | null }) => {
      let oficio: Oficio;
      if (id) {
        const { numero, ...resto } = dados;
        const { data, error } = await db.from('oficios')
          .update({ ...resto, ...(numero ? { numero } : {}) }).eq('id', id).select().single();
        if (error) throw error;
        oficio = data as Oficio;
      } else {
        const { numero, ...resto } = dados;
        const { data, error } = await db.from('oficios')
          .insert({ ...resto, ...(numero ? { numero } : {}) }).select().single();
        if (error) throw error;
        oficio = data as Oficio;
      }
      let arquivoFalhou: string | null = null;
      if (arquivo) {
        try { await registrarArquivo(oficio, arquivo); } catch (e) { arquivoFalhou = friendlyDbError(e); }
      }
      return { oficio, arquivoFalhou, novo: !id };
    },
    onSuccess: ({ oficio, arquivoFalhou, novo }) => {
      qc.invalidateQueries({ queryKey: QK.oficios });
      qc.invalidateQueries({ queryKey: QK.arquivos(oficio.id) });
      toast({ title: `Ofício Nº ${numeroCompleto(oficio)} ${novo ? 'cadastrado' : 'atualizado'}` });
      if (arquivoFalhou) {
        toast({ title: 'O ofício foi salvo, mas o PDF não foi enviado', description: `${arquivoFalhou} Envie o arquivo nos detalhes do ofício.`, variant: 'destructive' });
      }
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar o ofício', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

export function useEnviarArquivoOficio() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ oficio, arquivo, motivo }: { oficio: Oficio; arquivo: File; motivo?: string }) => {
      const versao = await registrarArquivo(oficio, arquivo, motivo);
      return { oficio, versao };
    },
    onSuccess: ({ oficio, versao }) => {
      qc.invalidateQueries({ queryKey: QK.oficios });
      qc.invalidateQueries({ queryKey: QK.arquivos(oficio.id) });
      toast({ title: versao > 1 ? `Arquivo substituído (versão ${versao})` : 'PDF assinado enviado', description: versao > 1 ? 'A versão anterior continua no histórico.' : undefined });
    },
    onError: (e: Error) => toast({ title: 'Erro ao enviar o arquivo', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

export function useExcluirOficio() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (oficio: Oficio) => {
      const { data: arqs } = await db.from('oficio_arquivos').select('arquivo_path').eq('oficio_id', oficio.id);
      const { error } = await db.from('oficios').delete().eq('id', oficio.id);
      if (error) throw error;
      const paths = ((arqs ?? []) as { arquivo_path: string }[]).map((a) => a.arquivo_path);
      if (paths.length) await storage().remove(paths); // melhor esforço
      return oficio;
    },
    onSuccess: (oficio) => {
      qc.invalidateQueries({ queryKey: QK.oficios });
      toast({ title: `Ofício Nº ${numeroCompleto(oficio)} excluído` });
    },
    onError: (e: Error) => toast({ title: 'Erro ao excluir o ofício', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

export interface ModeloEntrada {
  nome: string;
  categoria: string;
  finalidade: string | null;
  descricao: string | null;
  ativo: boolean;
}

export function useSalvarModelo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ modelo, dados, arquivo }: { modelo?: OficioModelo | null; dados: ModeloEntrada; arquivo?: File | null }) => {
      let novoPath: string | null = null;
      if (arquivo) {
        novoPath = `modelos/${Date.now()}-${nomeSeguro(arquivo.name)}`;
        await enviarParaArmazenamento(novoPath, arquivo);
      }
      const camposArquivo = arquivo && novoPath
        ? { arquivo_path: novoPath, arquivo_nome: arquivo.name.slice(0, 200), arquivo_tamanho: arquivo.size }
        : {};
      const q = modelo
        ? db.from('oficio_modelos').update({ ...dados, ...camposArquivo }).eq('id', modelo.id).select().single()
        : db.from('oficio_modelos').insert({ ...dados, ...camposArquivo }).select().single();
      const { data, error } = await q;
      if (error) {
        if (novoPath) await storage().remove([novoPath]);
        throw error;
      }
      // Arquivo antigo do modelo substituído sai do armazenamento.
      if (novoPath && modelo?.arquivo_path) await storage().remove([modelo.arquivo_path]);
      return { salvo: data as OficioModelo, novo: !modelo };
    },
    onSuccess: ({ salvo, novo }) => {
      qc.invalidateQueries({ queryKey: QK.modelos });
      toast({ title: `Modelo "${salvo.nome}" ${novo ? 'criado' : 'atualizado'}` });
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar o modelo', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

export function useExcluirModelo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (modelo: OficioModelo) => {
      const { error } = await db.from('oficio_modelos').delete().eq('id', modelo.id);
      if (error) throw error;
      if (modelo.arquivo_path) await storage().remove([modelo.arquivo_path]);
      return modelo;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: QK.modelos });
      qc.invalidateQueries({ queryKey: QK.oficios });
      toast({ title: `Modelo "${m.nome}" excluído` });
    },
    onError: (e: Error) => toast({ title: 'Erro ao excluir o modelo', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

// ─── Ofício de restituição da DAM (gerado no cancelamento do atendimento) ────

/**
 * Cadastra (ou atualiza, ao gerar de novo) o ofício de restituição na página
 * Ofícios, com o número escolhido. Sem arquivo: o PDF ASSINADO é anexado
 * depois, na página Ofícios.
 */
export async function salvarOficioRestituicao(p: {
  existenteId?: string | null;
  numero: number;
  data: string; // yyyy-MM-dd
  assunto: string;
  descricao: string;
}): Promise<{ id: string; criado: boolean }> {
  if (p.existenteId) {
    const { data, error } = await db.from('oficios')
      .update({ numero: p.numero, assunto: p.assunto, descricao: p.descricao })
      .eq('id', p.existenteId).select('id').maybeSingle();
    if (error) throw error;
    if (data) return { id: data.id as string, criado: false };
    // o ofício anterior foi excluído: cadastra um novo
  }
  const { data, error } = await db.from('oficios').insert({
    numero: p.numero,
    data_oficio: p.data,
    destinatario: 'Secretaria Municipal de Finanças',
    assunto: p.assunto,
    categoria: 'Restituição de DAM',
    situacao: 'emitido',
    descricao: p.descricao,
  }).select('id').single();
  if (error) throw error;
  return { id: data.id as string, criado: true };
}

/** Desfaz o cadastro de um ofício recém-criado (quando o passo seguinte falha). */
export async function desfazerOficioCriado(id: string): Promise<void> {
  try { await db.from('oficios').delete().eq('id', id); } catch { /* melhor esforço */ }
}

// ─── Texto do editor ─────────────────────────────────────────────────────────

/** Salva o texto escrito no editor (ofício ou modelo de texto). */
export function useSalvarConteudo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ tipo, id, html }: { tipo: 'oficio' | 'modelo'; id: string; html: string }) => {
      const tabela = tipo === 'oficio' ? 'oficios' : 'oficio_modelos';
      const campos = tipo === 'oficio'
        ? { conteudo_html: html, conteudo_atualizado_em: new Date().toISOString() }
        : { conteudo_html: html };
      const { error } = await db.from(tabela).update(campos).eq('id', id);
      if (error) throw error;
      return { tipo, id };
    },
    onSuccess: ({ tipo }) => {
      qc.invalidateQueries({ queryKey: tipo === 'oficio' ? QK.oficios : QK.modelos });
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar o texto', description: friendlyDbError(e), variant: 'destructive' }),
  });
}
