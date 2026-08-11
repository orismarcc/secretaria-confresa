import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ServiceEventType = 'start' | 'pause' | 'resume' | 'finish';

export interface ServiceEvent {
  id: string;
  service_id: string;
  event_type: ServiceEventType | string | null;
  captured_at: string;
  storage_path: string | null;
  latitude?: number | null;
  longitude?: number | null;
  odometer_km?: number | null;
  note?: string | null;
  /** URL assinada da miniatura (bucket privado), resolvida no fetch. */
  signed_url?: string | null;
}

/** Eventos (foto/km) de atendimento por serviço, ordenados por horário. */
export function useServiceEvents(serviceIds: string[]) {
  const key = [...serviceIds].sort().join(',');
  return useQuery({
    queryKey: ['service_events', key],
    queryFn: async () => {
      const map: Record<string, ServiceEvent[]> = {};
      if (serviceIds.length === 0) return map;
      const { data, error } = await supabase
        .from('service_photos')
        .select('id, service_id, event_type, captured_at, storage_path, latitude, longitude, odometer_km, note')
        .in('service_id', serviceIds)
        .order('captured_at', { ascending: true });
      if (error) throw error;
      const events = (data ?? []) as ServiceEvent[];

      // URLs assinadas para as miniaturas (bucket é privado).
      const paths = events.map((e) => e.storage_path).filter((p): p is string => !!p);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from('service-photos').createSignedUrls(paths, 3600);
        const urlByPath = new Map<string, string>();
        (signed ?? []).forEach((s: any) => { if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl); });
        events.forEach((e) => { if (e.storage_path) e.signed_url = urlByPath.get(e.storage_path) ?? null; });
      }

      events.forEach((e) => { (map[e.service_id] ??= []).push(e); });
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
