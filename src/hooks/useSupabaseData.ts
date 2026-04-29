import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
      const { data, error } = await supabase
        .from('demand_types')
        .select('*')
        .order('category', { nullsFirst: false })
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDemandType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, description, category }: { name: string; description?: string; category?: string | null }) => {
      const { data, error } = await supabase
        .from('demand_types')
        .insert({ name, description, category })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand_types'] });
      toast({ title: 'Tipo de demanda criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar tipo de demanda', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateDemandType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; is_active?: boolean; category?: string | null }) => {
      const { data, error } = await supabase
        .from('demand_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand_types'] });
      toast({ title: 'Tipo de demanda atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Erro ao criar assentamento', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Assentamento removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Erro ao criar localidade', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Localidade removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
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
      demandTypeIds?: string[];
    }) => {
      const { demandTypeIds, ...producerData } = producer;
      
      const { data, error } = await supabase
        .from('producers')
        .insert(producerData)
        .select()
        .single();
      if (error) throw error;

      // Insert producer demands if provided
      if (demandTypeIds && demandTypeIds.length > 0) {
        const demands = demandTypeIds.map(demandTypeId => ({
          producer_id: data.id,
          demand_type_id: demandTypeId,
        }));
        const { error: demandError } = await supabase
          .from('producer_demands')
          .insert(demands);
        if (demandError) throw demandError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      toast({ title: 'Produtor cadastrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar produtor', description: error.message, variant: 'destructive' });
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
      if (error) throw error;

      // Update producer demands if provided
      if (demandTypeIds !== undefined) {
        // Delete existing demands
        await supabase
          .from('producer_demands')
          .delete()
          .eq('producer_id', id);

        // Insert new demands
        if (demandTypeIds.length > 0) {
          const demands = demandTypeIds.map(demandTypeId => ({
            producer_id: id,
            demand_type_id: demandTypeId,
          }));
          const { error: demandError } = await supabase
            .from('producer_demands')
            .insert(demands);
          if (demandError) throw demandError;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      toast({ title: 'Produtor atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteProducer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete producer demands first
      await supabase.from('producer_demands').delete().eq('producer_id', id);
      const { error } = await supabase.from('producers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      toast({ title: 'Produtor removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteProducers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from('producer_demands').delete().in('producer_id', ids);
      const { error } = await supabase.from('producers').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['producers'] });
      queryClient.invalidateQueries({ queryKey: ['producer_demands'] });
      toast({ title: `${ids.length} produtor(es) removido(s)!` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
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
        .select('*, producers(name, phone, location_name, latitude, longitude), demand_types(name), settlements(name), locations(name), machinery(name, patrimony_number), profiles!created_by(name)')
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
        .neq('status', 'completed')
        .order('position', { ascending: true })
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

// Bulk update service positions via single RPC call
export function useUpdateServicePositions() {
  const queryClient = useQueryClient();

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
      purpose?: string;
      notes?: string;
      priority?: string;
      worked_area?: number | null;
      operator_id?: string | null;
      machinery_id?: string | null;
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
      toast({ title: 'Atendimento agendado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao agendar atendimento', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Atendimento atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Atendimento removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
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
        .select('*, demand_types(name), settlements(name), profiles!operator_id(name)')
        .eq('producer_id', producerId)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data;
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
      toast({ title: 'Erro ao cadastrar maquinário', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Maquinário removido!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });
}

// ============= DASHBOARD STATS =============
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const [servicesRes, producersRes] = await Promise.all([
        supabase.from('services').select('status, demand_type_id'),
        supabase.from('producers').select('id', { count: 'exact', head: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (producersRes.error) throw producersRes.error;

      const services = servicesRes.data || [];
      const totalProducers = producersRes.count || 0;

      const stats = {
        totalServices: services.length,
        pendingServices: services.filter(s => s.status === 'pending').length,
        inProgressServices: services.filter(s => s.status === 'in_progress').length,
        completedServices: services.filter(s => s.status === 'completed').length,
        proximoServices: services.filter(s => s.status === 'proximo').length,
        totalProducers,
        servicesByDemandType: Object.entries(
          services.reduce((acc, s) => {
            acc[s.demand_type_id] = (acc[s.demand_type_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([demandTypeId, count]) => ({ demandTypeId, count: count as number })),
      };

      return stats;
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
        .select('*, producers(name, phone), demand_types(name, category), settlements(name), profiles!created_by(name)')
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
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('deliveries')
        .insert({ ...delivery, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ title: 'Entrega cadastrada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar entrega', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ title: 'Entrega atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar entrega', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Entrega removida!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover entrega', description: error.message, variant: 'destructive' });
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
