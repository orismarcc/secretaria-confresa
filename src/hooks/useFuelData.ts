import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';

export interface FuelUsageRow {
  id: string;
  fuel_type: string;
  reference_month: string; // YYYY-MM-DD (primeiro dia do mês)
  liters: number;
  created_at: string;
}

/** Registros de combustível (litros por tipo e mês). */
export function useFuelUsage() {
  return useQuery({
    queryKey: ['fuel_usage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_usage')
        .select('*')
        .order('fuel_type', { ascending: true })
        .order('reference_month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FuelUsageRow[];
    },
  });
}

export interface FuelUsageInput {
  fuel_type: string;
  reference_month: string; // YYYY-MM-DD
  liters: number;
}

/** Insere ou atualiza (por tipo + mês) — permite adicionar/corrigir depois. */
export function useUpsertFuelUsage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: FuelUsageInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('fuel_usage')
        .upsert(
          { ...input, created_by: user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: 'fuel_type,reference_month' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_usage'] });
      toast({ title: 'Combustível registrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar combustível', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteFuelUsage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fuel_usage').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_usage'] });
      toast({ title: 'Registro removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover registro', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}
