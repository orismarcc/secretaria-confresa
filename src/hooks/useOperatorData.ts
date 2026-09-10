import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`;

export interface Operator {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
}

// Ordem de hierarquia da equipe interna (menor = mais alto).
const HIERARQUIA = ['Secretário de Agricultura', 'Diretor de Campo', 'Supervisor', 'Coordenador'];
export const jobRank = (t?: string | null) => {
  const i = HIERARQUIA.indexOf(t || '');
  return i === -1 ? HIERARQUIA.length : i;
};

/** Mapa id → dados do profile (nome, email, CPF). Usado p/ exibir o CPF.
 *  O CPF vem por função SECURITY DEFINER (só admin recebe) — a coluna cpf de
 *  profiles é revogada para o cliente. Operadores recebem cpf = null. */
export function useProfilesMap() {
  return useQuery({
    queryKey: ['profiles-cpf'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url');
      if (error) throw error;
      const { data: cpfRows } = await (supabase as any).rpc('admin_profile_cpfs');
      const cpfById = new Map<string, string | null>((cpfRows ?? []).map((r: any) => [r.id, r.cpf ?? null]));
      const map = new Map<string, AppUser>();
      (data ?? []).forEach((p: any) => map.set(p.id, { id: p.id, name: p.name, email: p.email, cpf: cpfById.get(p.id) ?? null, avatarUrl: p.avatar_url ?? null }));
      return map;
    },
  });
}

/** Lista de administradores (user_roles.role = 'admin' + profile). */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (error) throw error;
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as AppUser[];
      const { data: profs, error: e2 } = await supabase.from('profiles').select('id, name, email, avatar_url, job_title').in('id', ids);
      if (e2) throw e2;
      const { data: cpfRows } = await (supabase as any).rpc('admin_profile_cpfs');
      const cpfById = new Map<string, string | null>((cpfRows ?? []).map((r: any) => [r.id, r.cpf ?? null]));
      return (profs ?? [])
        .map((p: any) => ({ id: p.id, name: p.name, email: p.email, cpf: cpfById.get(p.id) ?? null, avatarUrl: p.avatar_url ?? null, jobTitle: p.job_title ?? null }))
        // Ordena pela hierarquia; empate por nome.
        .sort((a, b) => jobRank(a.jobTitle) - jobRank(b.jobTitle) || a.name.localeCompare(b.name, 'pt-BR')) as AppUser[];
    },
  });
}

/** Atualiza nome/CPF de um usuário diretamente no profile (admin). */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, name, cpf, avatar_url, job_title }: { id: string; name?: string; cpf?: string | null; avatar_url?: string | null; job_title?: string | null }) => {
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (cpf !== undefined) patch.cpf = cpf;
      if (avatar_url !== undefined) patch.avatar_url = avatar_url;
      if (job_title !== undefined) patch.job_title = job_title;
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase.from('profiles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-cpf'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['operators'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar CPF', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useOperators() {
  return useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(FUNCTION_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch operators');
      
      return data.operators as Operator[];
    },
  });
}

export function useCreateOperator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create operator');
      
      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      toast({ title: 'Operador criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao criar operador', 
        description: friendlyDbError(error),
        variant: 'destructive' 
      });
    },
  });
}

export function useUpdateOperator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, name, is_active }: { userId: string; name?: string; is_active?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(FUNCTION_URL, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, name, is_active }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update operator');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      toast({ title: 'Operador atualizado!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao atualizar operador', 
        description: friendlyDbError(error),
        variant: 'destructive' 
      });
    },
  });
}

export function useToggleOperatorStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, is_active }: { userId: string; is_active: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(FUNCTION_URL, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, is_active }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update status');
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      toast({ 
        title: variables.is_active ? 'Operador ativado!' : 'Operador desativado!',
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao alterar status', 
        description: friendlyDbError(error),
        variant: 'destructive' 
      });
    },
  });
}

export function useDeleteOperator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(FUNCTION_URL, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete operator');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      toast({ title: 'Operador removido!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover operador', 
        description: friendlyDbError(error),
        variant: 'destructive' 
      });
    },
  });
}
