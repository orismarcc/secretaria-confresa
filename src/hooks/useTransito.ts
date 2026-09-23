import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';

// ─── tipos ───────────────────────────────────────────────────────────────────
export interface Condutor {
  id: string; name: string; cpf: string | null; matricula: string | null;
  cnh_numero: string | null; cnh_categoria: string | null; cnh_validade: string | null;
  telefone: string | null; operator_id: string | null; is_active: boolean;
}
export interface Termo {
  id: string; machinery_id: string; condutor_id: string; data_inicio: string | null;
  data_fim: string | null; observacao: string | null; file_path: string | null;
  machinery?: { name: string; patrimony_number: string } | null;
  condutores?: { name: string } | null;
}
export interface Viagem {
  id: string; machinery_id: string; condutor_id: string | null; destino: string | null;
  nad: string | null; finalidade: string | null; data_saida: string | null; data_retorno: string | null;
  status: string; observacao: string | null;
  machinery?: { name: string; patrimony_number: string } | null;
  condutores?: { name: string } | null;
}
export interface Multa {
  id: string; machinery_id: string; condutor_id: string | null; viagem_id: string | null; termo_id: string | null;
  data: string | null; horario: string | null; local: string | null; placa: string | null;
  auto_infracao: string | null; orgao_autuador: string | null; infracao: string | null;
  valor: number | null; pontos: number | null; condutor_identificado: boolean;
  data_limite_recurso: string | null; status: string; observacao: string | null; file_path: string | null;
  machinery?: { name: string; patrimony_number: string } | null;
  condutores?: { name: string } | null;
  viagens?: { destino: string | null; nad: string | null } | null;
}

export const MULTA_STATUS: { value: string; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'condutor_identificado', label: 'Condutor identificado' },
  { value: 'em_recurso', label: 'Em recurso' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'paga', label: 'Paga' },
  { value: 'cancelada', label: 'Cancelada' },
];
export const VIAGEM_STATUS: { value: string; label: string }[] = [
  { value: 'programada', label: 'Programada' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];
export const multaStatusLabel = (v: string) => MULTA_STATUS.find((s) => s.value === v)?.label || v;
export const viagemStatusLabel = (v: string) => VIAGEM_STATUS.find((s) => s.value === v)?.label || v;

// ─── CONDUTORES ──────────────────────────────────────────────────────────────
export function useCondutores() {
  return useQuery({
    queryKey: ['condutores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('condutores')
        .select('id, name, cpf, matricula, cnh_numero, cnh_categoria, cnh_validade, telefone, operator_id, is_active')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Condutor[];
    },
  });
}
export function useSaveCondutor() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<Condutor> & { id?: string }) => {
      const payload: any = { ...item };
      if (item.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('condutores').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      } else {
        const { data: auth } = await supabase.auth.getUser();
        void auth;
        const { error } = await supabase.from('condutores').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['condutores'] }); qc.invalidateQueries({ queryKey: ['transito_cnh'] }); toast({ title: 'Condutor salvo!' }); },
    onError: (e: Error) => toast({ title: 'Erro ao salvar condutor', description: friendlyDbError(e), variant: 'destructive' }),
  });
}
export function useDeleteCondutor() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('condutores').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['condutores'] }); toast({ title: 'Condutor removido.' }); },
    onError: (e: Error) => toast({ title: 'Erro ao remover condutor', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

// ─── TERMOS ──────────────────────────────────────────────────────────────────
export function useTermos() {
  return useQuery({
    queryKey: ['termos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('termos_responsabilidade')
        .select('id, machinery_id, condutor_id, data_inicio, data_fim, observacao, file_path, machinery(name, patrimony_number), condutores(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as Termo[];
    },
  });
}
export function useSaveTermo() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      if (item.id) { const { id, ...rest } = item; const { error } = await supabase.from('termos_responsabilidade').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
      else { const { data: auth } = await supabase.auth.getUser(); const { error } = await supabase.from('termos_responsabilidade').insert({ ...item, created_by: auth?.user?.id ?? null }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['termos'] }); toast({ title: 'Termo salvo!' }); },
    onError: (e: Error) => toast({ title: 'Erro ao salvar termo', description: friendlyDbError(e), variant: 'destructive' }),
  });
}
export function useDeleteTermo() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('termos_responsabilidade').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['termos'] }); toast({ title: 'Termo removido.' }); },
    onError: (e: Error) => toast({ title: 'Erro ao remover termo', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

// ─── VIAGENS ─────────────────────────────────────────────────────────────────
export function useViagens() {
  return useQuery({
    queryKey: ['viagens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('viagens')
        .select('id, machinery_id, condutor_id, destino, nad, finalidade, data_saida, data_retorno, status, observacao, machinery(name, patrimony_number), condutores(name)')
        .order('data_saida', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as any as Viagem[];
    },
  });
}
export function useSaveViagem() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      if (item.id) { const { id, ...rest } = item; const { error } = await supabase.from('viagens').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
      else { const { data: auth } = await supabase.auth.getUser(); const { error } = await supabase.from('viagens').insert({ ...item, created_by: auth?.user?.id ?? null }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['viagens'] }); toast({ title: 'Viagem salva!' }); },
    onError: (e: Error) => toast({ title: 'Erro ao salvar viagem', description: friendlyDbError(e), variant: 'destructive' }),
  });
}
export function useDeleteViagem() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('viagens').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['viagens'] }); toast({ title: 'Viagem removida.' }); },
    onError: (e: Error) => toast({ title: 'Erro ao remover viagem', description: friendlyDbError(e), variant: 'destructive' }),
  });
}

// ─── MULTAS ──────────────────────────────────────────────────────────────────
export function useMultas() {
  return useQuery({
    queryKey: ['multas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('multas')
        .select('*, machinery(name, patrimony_number), condutores(name), viagens(destino, nad)')
        .order('data', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as any as Multa[];
    },
  });
}
export function useSaveMulta() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      if (item.id) { const { id, ...rest } = item; const { error } = await supabase.from('multas').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
      else { const { data: auth } = await supabase.auth.getUser(); const { error } = await supabase.from('multas').insert({ ...item, created_by: auth?.user?.id ?? null }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['multas'] }); toast({ title: 'Multa salva!' }); },
    onError: (e: Error) => toast({ title: 'Erro ao salvar multa', description: friendlyDbError(e), variant: 'destructive' }),
  });
}
export function useDeleteMulta() {
  const { toast } = useToast(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('multas').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['multas'] }); toast({ title: 'Multa removida.' }); },
    onError: (e: Error) => toast({ title: 'Erro ao remover multa', description: friendlyDbError(e), variant: 'destructive' }),
  });
}
