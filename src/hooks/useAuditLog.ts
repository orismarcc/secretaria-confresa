import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const AUDIT_PAGE_SIZE = 25;

export interface AuditRow {
  id: string;
  table_name: string;
  record_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
}

export interface AuditFilters {
  table: string;   // 'all' | table_name
  action: string;  // 'all' | INSERT | UPDATE | DELETE
  page: number;
}

/** Log de auditoria — paginado no servidor (a tabela pode crescer muito). */
export function useAuditLog({ table, action, page }: AuditFilters) {
  return useQuery({
    queryKey: ['audit_log', table, action, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('changed_at', { ascending: false })
        .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE - 1);
      if (table !== 'all') q = q.eq('table_name', table);
      if (action !== 'all') q = q.eq('action', action);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });
}

/** Mapa id→nome dos usuários (para exibir "quem" na auditoria). */
export function useProfilesMap() {
  return useQuery({
    queryKey: ['profiles_map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, name');
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((p: { id: string; name: string }) => map.set(p.id, p.name));
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}
