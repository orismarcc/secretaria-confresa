import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';

export interface MaintenanceRow {
  id: string;
  machinery_id: string;
  operator_id: string | null;
  description: string;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  machinery?: { name: string; patrimony_number: string } | null;
}

/** Lista de manutenções/reparos com o maquinário embutido. */
export function useMaintenances() {
  return useQuery({
    queryKey: ['maintenances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machinery_maintenance')
        .select('*, machinery:machinery_id(name, patrimony_number)')
        .order('started_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaintenanceRow[];
    },
  });
}

export interface MaintenanceInput {
  machinery_id: string;
  operator_id?: string | null;
  description: string;
  started_at: string;
  ended_at?: string | null;
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: MaintenanceInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('machinery_maintenance')
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      toast({ title: 'Manutenção registrada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar manutenção', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<MaintenanceInput>) => {
      const { data, error } = await supabase
        .from('machinery_maintenance')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      toast({ title: 'Manutenção atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar manutenção', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('machinery_maintenance').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenances'] });
      toast({ title: 'Manutenção excluída!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir manutenção', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Duração em minutos entre início e fim (0 se em andamento ou inválido). */
export function maintenanceMinutes(m: Pick<MaintenanceRow, 'started_at' | 'ended_at'>): number {
  if (!m.ended_at) return 0;
  const s = new Date(m.started_at.replace(' ', 'T')).getTime();
  const e = new Date(m.ended_at.replace(' ', 'T')).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 60000);
}

/** Formata minutos como "Xh Ymin" / "Ymin". */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
