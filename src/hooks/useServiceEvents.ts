import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ServiceEventType = 'start' | 'pause' | 'resume' | 'finish';

export interface ServiceEvent {
  id: string;
  service_id: string;
  event_type: ServiceEventType | string | null;
  captured_at: string;
  storage_path: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** Eventos (fotos) de atendimento por serviço, ordenados por horário. */
export function useServiceEvents(serviceIds: string[]) {
  const key = [...serviceIds].sort().join(',');
  return useQuery({
    queryKey: ['service_events', key],
    queryFn: async () => {
      const map: Record<string, ServiceEvent[]> = {};
      if (serviceIds.length === 0) return map;
      const { data, error } = await supabase
        .from('service_photos')
        .select('id, service_id, event_type, captured_at, storage_path, latitude, longitude')
        .in('service_id', serviceIds)
        .order('captured_at', { ascending: true });
      if (error) throw error;
      (data ?? []).forEach((e: any) => {
        (map[e.service_id] ??= []).push(e as ServiceEvent);
      });
      return map;
    },
    enabled: serviceIds.length > 0,
  });
}

/** Último evento (mais recente) de uma lista já ordenada. */
export function latestEvent(events: ServiceEvent[] | undefined): ServiceEvent | null {
  if (!events || events.length === 0) return null;
  return events[events.length - 1];
}

/** Um atendimento está "pausado" quando seu último evento é uma pausa. */
export function isPaused(events: ServiceEvent[] | undefined): boolean {
  return latestEvent(events)?.event_type === 'pause';
}
