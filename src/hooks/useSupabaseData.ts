import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDbError } from '@/lib/dbErrors';
import { Sentry } from '@/lib/sentry';

// ============= SCHEMA-RESILIENCE HELPER =============
/**
 * Extracts the offending column name from a Supabase / PostgREST error.
 * Handles two patterns:
 *   1. "Could not find the 'column_name' column of 'table' in the schema cache"
 *   2. column "column_name" of relation "table" does not exist
 */
function extractMissingColumn(message: string): string | null {
  const cacheMatch = message.match(/find the '(\w+)' column/);
  if (cacheMatch) return cacheMatch[1];
  const pgMatch = message.match(/column "(\w+)" of relation/);
  if (pgMatch) return pgMatch[1];
  return null;
}

/**
 * Retries a Supabase call, automatically dropping any column that the DB
 * reports as missing (schema cache out of sync with the code).
 * Up to MAX_RETRIES columns can be stripped before giving up.
 *
 * @param callFn   - receives the (possibly reduced) payload and returns { data, error }
 * @param payload  - initial key/value object to pass to the DB call
 * @param onSkip   - optional callback called with each stripped column name
 */
async function withMissingColumnRetry<T>(
  callFn: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>,
  payload: Record<string, unknown>,
  onSkip?: (column: string) => void,
): Promise<T> {
  const MAX_RETRIES = 8;
  let current = { ...payload };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { data, error } = await callFn(current);
    if (!error) return data as T;

    const missing = extractMissingColumn(error.message);
    if (missing && missing in current) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [missing]: _dropped, ...rest } = current;
      current = rest;
      onSkip?.(missing);
      continue; // retry without the missing column
    }

    // Not a missing-column error — re-throw as a proper Error
    throw new Error(error.message);
  }

  throw new Error('Máximo de tentativas atingido ao tentar salvar o registro.');
}

// ============= DEMAND TYPES =============
export function useDemandTypes() {
  return useQuery({
    queryKey: ['demand_types'],
    queryFn: async () => {
      // Try ordering by category first; fall back to name-only if the column
      // doesn't exist yet (schema cache lag before migration runs).
      const { data, error } = await supabase
        .from('demand_types')
        .select('*')
        .order('category', { nullsFirst: false })
        .order('name');

      if (error) {
        if (error.message.includes('category')) {
          // category column not yet present — return results ordered by name only
          const fallback = await supabase
            .from('demand_types')
            .select('*')
            .order('name');
          if (fallback.error) throw fallback.error;
          return fallback.data;
        }
        throw error;
      }
      return data;
    },
  });
}

export function useCreateDemandType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, description, category, operation_type }: { name: string; description?: string; category?: string | null; operation_type?: string | null }) => {
      const payload: Record<string, unknown> = { name, description, category, operation_type };
      const result = await withMissingColumnRetry(
        (p) => supabase.from('demand_types').insert(p).select().single(),
        payload,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand_types'] });
      toast({ title: 'Tipo de demanda criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar tipo de demanda', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateDemandType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; is_active?: boolean; category?: string | null; operation_type?: string | null }) => {
      const result = await withMissingColumnRetry(
        (p) => supabase.from('demand_types').update(p).eq('id', id).select().single(),
        updates as Record<string, unknown>,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand_types'] });
      toast({ title: 'Tipo de demanda atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar tipo de demanda', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteDemandType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('demand_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand_types'] });
      toast({ title: 'Tipo de demanda removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover tipo de demanda', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= SETTLEMENTS =============
export function useSettlements() {
  return useQuery({
    queryKey: ['settlements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await supabase
        .from('settlements')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      toast({ title: 'Assentamento criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar assentamento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= GLEBAS (subdivisões de assentamentos) =============
export function useGlebas() {
  return useQuery({
    queryKey: ['glebas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glebas')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateGleba() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ name, settlement_id }: { name: string; settlement_id: string }) => {
      const { data, error } = await supabase
        .from('glebas')
        .insert({ name, settlement_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glebas'] });
      toast({ title: 'Gleba criada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar gleba', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateGleba() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('glebas')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glebas'] });
      toast({ title: 'Gleba atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar gleba', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteGleba() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('glebas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glebas'] });
      toast({ title: 'Gleba removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover gleba', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateSettlement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('settlements')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      toast({ title: 'Assentamento atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar assentamento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteSettlement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('settlements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      // M-08: invalidar caches que fazem join com settlements
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ title: 'Assentamento removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover assentamento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= LOCATIONS =============
export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*, settlements(name)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useLocationsBySettlement(settlementId: string | null) {
  return useQuery({
    queryKey: ['locations', 'settlement', settlementId],
    queryFn: async () => {
      if (!settlementId) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('settlement_id', settlementId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!settlementId,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, settlement_id }: { name: string; settlement_id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .insert({ name, settlement_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: 'Localidade criada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar localidade', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name, settlement_id }: { id: string; name: string; settlement_id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .update({ name, settlement_id })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: 'Localidade atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar localidade', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      // M-08: invalidar caches que fazem join com locations
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: 'Localidade removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover localidade', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= PRODUCERS =============
export function useProducers() {
  return useQuery({
    queryKey: ['producers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producers')
        .select('*, settlements(name), locations(name), producer_demands(demand_type_id)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

// Get producer demands
export function useProducerDemands(producerId: string | undefined) {
  return useQuery({
    queryKey: ['producer_demands', producerId],
    queryFn: async () => {
      if (!producerId) return [];
      const { data, error } = await supabase
        .from('producer_demands')
        .select('demand_type_id')
        .eq('producer_id', producerId);
      if (error) throw error;
      return data.map(d => d.demand_type_id);
    },
    enabled: !!producerId,
  });
}

export function useCreateProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (producer: {
      name: string;
      cpf: string;
      phone?: string;
      settlement_id?: string;
      location_id?: string;
      location_name?: string;
      property_name?: string;
      property_size?: number;
      dap_cap?: string;
      latitude?: number | null;
      longitude?: number | null;
      caf?: string | null;
      demandTypeIds?: string[];
    }) => {
      const { demandTypeIds, ...producerData } = producer;

      const { data, error } = await supabase
        .from('producers')
        .insert(producerData)
        .select()
        .single();
      if (error) {
        // CPF/CNPJ duplicado (UNIQUE producers_cpf_key) → mensagem clara
        if ((error as any).code === '23505' || /producers_cpf_key|duplicate key/i.test(error.message)) {
          throw new Error('Já existe um produtor cadastrado com este CPF/CNPJ. Use a busca para localizá-lo.');
        }
        throw error;
      }

      // Insert producer demands if provided
      if (demandTypeIds && demandTypeIds.length > 0) {
        const demands = demandTypeIds.map(demandTypeId => ({
          producer_id: data.id,
          demand_type_id: demandTypeId,
        }));
        const { error: demandError } = await supabase
          .from('producer_demands')
          .insert(demands);
        if (demandError) {
          // A-01: compensate — roll back the producer row so we don't leave
          // an orphan producer with no demands.
          await supabase.from('producers').delete().eq('id', data.id);
          throw new Error(`Erro ao salvar tipos de demanda: ${demandError.message}`);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Produtor cadastrado!' });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { tags: { op: 'create_producer' } });
      toast({ title: 'Erro ao cadastrar produtor', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, demandTypeIds, ...updates }: { id: string; demandTypeIds?: string[]; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('producers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if ((error as any).code === '23505' || /producers_cpf_key|duplicate key/i.test(error.message)) {
          throw new Error('Já existe outro produtor com este CPF/CNPJ.');
        }
        throw error;
      }

      // Update producer demands if provided
      if (demandTypeIds !== undefined) {
        // Snapshot current demands for compensating restore
        const { data: existingDemands } = await supabase
          .from('producer_demands')
          .select('demand_type_id')
          .eq('producer_id', id);

        // Delete existing demands
        const { error: delDemandErr } = await supabase
          .from('producer_demands')
          .delete()
          .eq('producer_id', id);
        if (delDemandErr) throw delDemandErr;

        // Insert new demands
        if (demandTypeIds.length > 0) {
          const demands = demandTypeIds.map(demandTypeId => ({
            producer_id: id,
            demand_type_id: demandTypeId,
          }));
          const { error: demandError } = await supabase
            .from('producer_demands')
            .insert(demands);
          if (demandError) {
            // Compensate: restore previous demands
            if (existingDemands && existingDemands.length > 0) {
              await supabase.from('producer_demands').insert(
                existingDemands.map((d) => ({ producer_id: id, demand_type_id: d.demand_type_id })),
              );
            }
            throw demandError;
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Produtor atualizado!' });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { tags: { op: 'update_producer' } });
      toast({ title: 'Erro ao atualizar produtor', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // A-02: checar erro do delete de demands antes de deletar o produtor
      // — evita produtor deletado com demands órfãs
      const { error: demandErr } = await supabase.from('producer_demands').delete().eq('producer_id', id);
      if (demandErr) throw new Error(`Erro ao remover vínculos do produtor: ${demandErr.message}`);
      const { error } = await supabase.from('producers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Produtor removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover produtor', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteProducers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: demandErr } = await supabase.from('producer_demands').delete().in('producer_id', ids);
      if (demandErr) throw new Error(`Erro ao remover vínculos dos produtores: ${demandErr.message}`);
      const { error } = await supabase.from('producers').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: `${ids.length} produtor(es) removido(s)!` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover produtores', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= SERVICES =============
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, producers(name, phone, location_name, latitude, longitude), demand_types(name), settlements(name), locations(name), machinery(name, patrimony_number), profiles!created_by(name), responsible_technicians(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePendingServices() {
  return useQuery({
    queryKey: ['services', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, producers(name, phone, location_name, latitude, longitude), demand_types(name), settlements(name), locations(name), profiles!operator_id(name)')
        // exclui finalizados E cancelados — só atendimentos em aberto entram na fila
        .not('status', 'in', '("completed","cancelled")')
        .order('position', { ascending: true, nullsFirst: false }) // B-05: explicit NULLS LAST
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

// Bulk update service positions via single RPC call
export function useUpdateServicePositions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      const { error } = await supabase.rpc('batch_update_service_positions', {
        updates: updates,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services', 'pending'] });
    },
    onError: (error: Error) => {
      console.error('[useUpdateServicePositions] Falha ao salvar posições:', error.message);
      toast({ title: 'Erro ao salvar ordem dos atendimentos', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (service: {
      producer_id: string;
      demand_type_id: string;
      settlement_id?: string;
      location_id?: string;
      scheduled_date: string;
      appointment_date?: string | null;
      completed_at?: string | null;
      purpose?: string;
      notes?: string;
      status?: string;
      priority?: string;
      worked_area?: number | null;
      operator_id?: string | null;
      machinery_id?: string | null;
      dam_issued?: boolean;
      dam_paid?: boolean;
      dam_issued_at?: string | null;
      limestone_quantity?: number | null;
      input_quantity?: number | null;
      fuel_liters?: number | null;
      worked_hours?: number | null;
      dam_paid_at?: string | null;
      dam_receipt_url?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = { ...service, created_by: user?.id ?? null };
      const skipped: string[] = [];

      const result = await withMissingColumnRetry(
        (p) => supabase.from('services').insert(p).select().single(),
        payload,
        (col) => skipped.push(col),
      );

      if (skipped.length > 0) {
        toast({
          title: 'Atenção: campos não salvos',
          description: `Os campos "${skipped.join(', ')}" ainda não existem no banco. Execute a migração pendente no Supabase.`,
          variant: 'destructive',
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Atendimento agendado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao agendar atendimento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const skipped: string[] = [];

      const result = await withMissingColumnRetry(
        (p) => supabase.from('services').update(p).eq('id', id).select().single(),
        updates as Record<string, unknown>,
        (col) => skipped.push(col),
      );

      if (skipped.length > 0) {
        toast({
          title: 'Atenção: campos não salvos',
          description: `Os campos "${skipped.join(', ')}" ainda não existem no banco. Execute a migração pendente no Supabase.`,
          variant: 'destructive',
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Atendimento atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar atendimento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Atendimento removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover atendimento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= COMUNICADO DAM — CONTADOR =============
/** Lê o próximo número que será atribuído (valor atual + 1), só para exibição. */
export function useNextComunicadoNumber() {
  return useQuery({
    queryKey: ['comunicado_dam_counter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_counters')
        .select('value')
        .eq('key', 'comunicado_dam')
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? 0) + 1;
    },
  });
}

/** Incrementa atomicamente e retorna o número efetivamente atribuído. */
export function useIncrementComunicadoNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('next_comunicado_dam');
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicado_dam_counter'] });
    },
  });
}

// ============= OPERATOR DEMAND-TYPE ACCESS =============
// Restringe quais tipos de serviço um operador enxerga no login.
// Lista vazia = acesso a todos os tipos (retrocompatível).
export function useOperatorDemandTypes(operatorId: string | undefined) {
  return useQuery({
    queryKey: ['operator_demand_types', operatorId],
    queryFn: async () => {
      if (!operatorId) return [] as string[];
      const { data, error } = await supabase
        .from('operator_demand_types')
        .select('demand_type_id')
        .eq('operator_id', operatorId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.demand_type_id as string);
    },
    enabled: !!operatorId,
  });
}

export function useSetOperatorDemandTypes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ operatorId, demandTypeIds }: { operatorId: string; demandTypeIds: string[] }) => {
      // Snapshot para rollback compensatório
      const { data: existing } = await supabase
        .from('operator_demand_types')
        .select('demand_type_id')
        .eq('operator_id', operatorId);

      const { error: delErr } = await supabase
        .from('operator_demand_types')
        .delete()
        .eq('operator_id', operatorId);
      if (delErr) throw delErr;

      if (demandTypeIds.length > 0) {
        const rows = demandTypeIds.map((id) => ({ operator_id: operatorId, demand_type_id: id }));
        const { error: insErr } = await supabase.from('operator_demand_types').insert(rows);
        if (insErr) {
          // Restaura o estado anterior
          if (existing && existing.length > 0) {
            await supabase.from('operator_demand_types').insert(
              existing.map((e: any) => ({ operator_id: operatorId, demand_type_id: e.demand_type_id })),
            );
          }
          throw insErr;
        }
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operator_demand_types', variables.operatorId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar acessos do operador', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useServicesByProducer(producerId: string | undefined) {
  return useQuery({
    queryKey: ['services', 'producer', producerId],
    queryFn: async () => {
      if (!producerId) return [];
      const { data, error } = await supabase
        .from('services')
        .select('*, demand_types(name, category), settlements(name), profiles!operator_id(name)')
        .eq('producer_id', producerId)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!producerId,
  });
}

export function useDeliveriesByProducer(producerId: string | undefined) {
  return useQuery({
    queryKey: ['deliveries', 'producer', producerId],
    queryFn: async () => {
      if (!producerId) return [];
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          demand_types(name, category),
          settlements(name),
          delivery_items:delivery_items(
            quantity,
            delivery_lots(name, unit)
          )
        `)
        .eq('producer_id', producerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!producerId,
  });
}

// ============= MACHINERY =============
export function useMachinery() {
  return useQuery({
    queryKey: ['machinery'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machinery')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMachinery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: { name: string; patrimony_number: string; chassis?: string | null }) => {
      const { data, error } = await supabase
        .from('machinery')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machinery'] });
      toast({ title: 'Maquinário cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar maquinário', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateMachinery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('machinery')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machinery'] });
      toast({ title: 'Maquinário atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar maquinário', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteMachinery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('machinery').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machinery'] });
      queryClient.invalidateQueries({ queryKey: ['services'] }); // M-08: services join machinery
      toast({ title: 'Maquinário removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover maquinário', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= DASHBOARD STATS =============
/**
 * Contagem de produtores para o Dashboard.
 * As estatísticas de atendimentos são derivadas do cache de `useServices`
 * no próprio DashboardPage — evita um segundo fetch de `services`.
 * Mantém a queryKey ['dashboard_stats'] para preservar as invalidações
 * já espalhadas pelas mutations de produtor.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('producers')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return { totalProducers: count || 0 };
    },
  });
}

// ============= DELIVERIES =============
export function useDeliveries() {
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          producers:producer_id(
            name, cpf, phone, settlement_id, location_id, location_name,
            settlements(name),
            locations(name)
          ),
          demand_types(name, category),
          settlements(name),
          delivery_items(quantity, lot_id, delivery_lots(name))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (delivery: {
      producer_id: string;
      demand_type_id: string;
      settlement_id?: string | null;
      quantity?: number | null;
      notes?: string | null;
      delivery_date_start?: string | null;
      delivery_date_end?: string | null;
      status?: string;
      completed_at?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = { ...delivery, created_by: user?.id ?? null };
      const result = await withMissingColumnRetry(
        (p) => supabase.from('deliveries').insert(p).select().single(),
        payload,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ title: 'Entrega cadastrada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar entrega', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const result = await withMissingColumnRetry(
        (p) => supabase.from('deliveries').update(p).eq('id', id).select().single(),
        updates as Record<string, unknown>,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ title: 'Entrega atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar entrega', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteDelivery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deliveries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      // delivery_items are cascade-deleted; invalidate their cache + lot summaries
      queryClient.invalidateQueries({ queryKey: ['delivery_items'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_lots'] });
      toast({ title: 'Entrega removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover entrega', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= USER ROLE =============
export function useUserRole(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_role', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!userId,
  });
}

// ============= PATRIMONY =============
export function usePatrimony() {
  return useQuery({
    queryKey: ['patrimony'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrimony')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePatrimony() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (item: {
      name: string;
      patrimony_number: string;
      patrimony_number_state?: string | null;
      description?: string | null;
      value?: number | null;
      category?: string | null;
      acquisition_date?: string | null;
      location?: string | null;
      responsible_name?: string | null;
      responsible_phone?: string | null;
      condition?: string | null;
      written_off?: boolean;
      image_url?: string | null;
      image_url_2?: string | null;
      image_url_3?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      const { data, error } = await supabase.from('patrimony').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrimony'] });
      toast({ title: 'Bem cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar bem', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdatePatrimony() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase.from('patrimony').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrimony'] });
      toast({ title: 'Bem atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar bem do patrimônio', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeletePatrimony() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      // A-08: fetch all 3 image URLs before deleting to clean up Storage
      const { data: item } = await supabase
        .from('patrimony')
        .select('image_url, image_url_2, image_url_3')
        .eq('id', id)
        .maybeSingle();

      if (item) {
        const urls = [item.image_url, item.image_url_2, item.image_url_3].filter(Boolean) as string[];
        for (const url of urls) {
          try {
            const match = url.match(/patrimony-images\/(.+)$/);
            if (match) await supabase.storage.from('patrimony-images').remove([match[1]]);
          } catch (storageErr) {
            console.warn('[useDeletePatrimony] Falha ao remover imagem do storage:', storageErr);
          }
        }
      }

      const { error } = await supabase.from('patrimony').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrimony'] });
      toast({ title: 'Bem removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover bem do patrimônio', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function usePatrimonyTransfers(patrimonyId: string | null) {
  return useQuery({
    queryKey: ['patrimony_transfers', patrimonyId],
    queryFn: async () => {
      if (!patrimonyId) return [];
      const { data, error } = await supabase
        .from('patrimony_transfers')
        .select('*')
        .eq('patrimony_id', patrimonyId)
        .order('transferred_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patrimonyId,
  });
}

export function useCreatePatrimonyTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      transfer,
      patrimonyId,
    }: {
      transfer: {
        patrimony_id: string;
        transferred_at: string;
        location?: string | null;
        responsible_name?: string | null;
        responsible_phone?: string | null;
        condition?: string | null;
        notes?: string | null;
        created_by?: string | null;
      };
      patrimonyId: string;
    }) => {
      // 1. Insert the transfer record
      const { data: transferData, error: transferError } = await supabase
        .from('patrimony_transfers')
        .insert(transfer)
        .select()
        .single();
      if (transferError) throw transferError;

      // 2. Update patrimony with the new operational state
      const { error: updateError } = await supabase
        .from('patrimony')
        .update({
          location: transfer.location ?? null,
          responsible_name: transfer.responsible_name ?? null,
          responsible_phone: transfer.responsible_phone ?? null,
          condition: transfer.condition ?? null,
        })
        .eq('id', patrimonyId);

      if (updateError) {
        // Compensate: remove the transfer we just inserted
        await supabase.from('patrimony_transfers').delete().eq('id', transferData.id);
        throw updateError;
      }

      return transferData;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patrimony'] });
      queryClient.invalidateQueries({ queryKey: ['patrimony_transfers', variables.patrimonyId] });
      toast({ title: 'Movimentação registrada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar movimentação', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= RESPONSIBLE TECHNICIANS =============
export function useResponsibleTechnicians() {
  return useQuery({
    queryKey: ['responsible_technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('responsible_technicians')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateResponsibleTechnician() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (item: { name: string; cpf?: string | null; cargo?: string | null }) => {
      const { data, error } = await supabase
        .from('responsible_technicians')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsible_technicians'] });
      toast({ title: 'Responsável Técnico cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar responsável técnico', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateResponsibleTechnician() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; cpf?: string | null; cargo?: string | null; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('responsible_technicians')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsible_technicians'] });
      toast({ title: 'Responsável Técnico atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar responsável técnico', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteResponsibleTechnician() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('responsible_technicians').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsible_technicians'] });
      // M-08: services e delivery_lots têm FK para responsible_technicians
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_lots'] });
      toast({ title: 'Responsável Técnico removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

// ============= DELIVERY LOTS =============

export function useDeliveryLots(demandTypeId?: string) {
  return useQuery({
    queryKey: ['delivery_lots', demandTypeId ?? 'all'],
    queryFn: async () => {
      let query = (supabase as any)
        .from('delivery_lot_summary')
        .select('*')
        .order('lot_date', { ascending: false });
      if (demandTypeId) {
        query = query.eq('demand_type_id', demandTypeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateDeliveryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (lot: {
      demand_type_id: string;
      name: string;
      initial_quantity: number;
      unit: string;
      supplier?: string | null;
      lot_date?: string | null;
      notes?: string | null;
      responsible_technician_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = { ...lot, created_by: user?.id ?? null };
      const result = await withMissingColumnRetry(
        (p) => (supabase as any).from('delivery_lots').insert(p).select().single(),
        payload,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_lots'] });
      toast({ title: 'Lote cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar lote', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateDeliveryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const result = await withMissingColumnRetry(
        (p) => (supabase as any).from('delivery_lots').update(p).eq('id', id).select().single(),
        updates as Record<string, unknown>,
      );
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_lots'] });
      toast({ title: 'Lote atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar lote', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteDeliveryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('delivery_lots' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_lots'] });
      // M-08: delivery_items e deliveries ficam stale após remoção de um lote
      queryClient.invalidateQueries({ queryKey: ['delivery_items'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ title: 'Lote removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover lote', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeliveryItems(deliveryId?: string) {
  return useQuery({
    queryKey: ['delivery_items', deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_items' as any)
        .select('*, delivery_lots(name, unit, initial_quantity)')
        .eq('delivery_id', deliveryId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!deliveryId,
  });
}

export function useSaveDeliveryItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      deliveryId,
      items,
    }: {
      deliveryId: string;
      items: { lot_id: string; quantity: number }[];
    }) => {
      // Delete all existing items for this delivery first
      const { error: delErr } = await supabase
        .from('delivery_items' as any)
        .delete()
        .eq('delivery_id', deliveryId);
      if (delErr) throw delErr;

      // Insert new items if any
      if (items.length > 0) {
        const rows = items.map((item) => ({
          delivery_id: deliveryId,
          lot_id: item.lot_id,
          quantity: item.quantity,
        }));
        const { error: insErr } = await supabase
          .from('delivery_items' as any)
          .insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_items'] });
      queryClient.invalidateQueries({ queryKey: ['delivery_lots'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] }); // M-08: delivery sub-items changed
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar lotes da entrega',
        description: friendlyDbError(error),
        variant: 'destructive',
      });
    },
  });
}

// ============= SEFAZ =============
export function useSefazProducers() {
  return useQuery({
    queryKey: ['sefaz_producers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sefaz_producers')
        .select('*, sefaz_services(id)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSefazProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (producer: {
      name: string;
      cpf?: string | null;
      phone?: string | null;
      settlement?: string | null;
      location?: string | null;
      settlement_id?: string | null;
    }) => {
      const { data, error } = await supabase.from('sefaz_producers').insert(producer).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sefaz_producers'] });
      toast({ title: 'Produtor SEFAZ cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateSefazProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase.from('sefaz_producers').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sefaz_producers'] });
      toast({ title: 'Produtor SEFAZ atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar produtor SEFAZ', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteSefazProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sefaz_producers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sefaz_producers'] });
      queryClient.invalidateQueries({ queryKey: ['sefaz_services'] }); // M-08: cascade-delete no DB
      toast({ title: 'Produtor removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover produtor SEFAZ', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useSefazServices(producerId?: string) {
  return useQuery({
    queryKey: ['sefaz_services', producerId],
    queryFn: async () => {
      let query = supabase
        .from('sefaz_services')
        .select('*, sefaz_producers(name, cpf, phone, settlement, location)')
        .order('service_date', { ascending: false });
      if (producerId) query = query.eq('sefaz_producer_id', producerId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSefazService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (service: {
      sefaz_producer_id: string;
      service_type: string;
      signed_list?: boolean;
      service_date: string;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase.from('sefaz_services').insert(service).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sefaz_services'] });
      queryClient.invalidateQueries({ queryKey: ['sefaz_producers'] });
      toast({ title: 'Atendimento SEFAZ registrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar atendimento', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateSefazService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase.from('sefaz_services').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sefaz_services'] });
      toast({ title: 'Atendimento atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar atendimento SEFAZ', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteSefazService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sefaz_services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sefaz_services'] });
      queryClient.invalidateQueries({ queryKey: ['sefaz_producers'] });
      toast({ title: 'Atendimento removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover atendimento SEFAZ', description: friendlyDbError(error), variant: 'destructive' });
    },
  });
}
