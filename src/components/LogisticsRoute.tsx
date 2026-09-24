import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Navigation, Truck, Flag, ExternalLink, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventRow {
  id: string;
  event_type: string | null;
  storage_path: string | null;
  latitude: number | null;
  longitude: number | null;
  captured_at: string | null;
  url?: string;
}

/** Eventos (início, carregamento, finalização) com GPS e foto de um atendimento. */
function useServiceEvents(serviceId: string) {
  return useQuery({
    queryKey: ['service_events', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_photos')
        .select('id, event_type, storage_path, latitude, longitude, captured_at')
        .eq('service_id', serviceId)
        .order('captured_at', { ascending: true });
      if (error) throw error;
      return Promise.all(((data ?? []) as unknown as EventRow[]).map(async (row) => {
        if (!row.storage_path) return row;
        try {
          const { data: signed } = await supabase.storage.from('service-photos').createSignedUrl(row.storage_path, 3600);
          return { ...row, url: signed?.signedUrl };
        } catch { return row; } // uma foto com problema não derruba as demais
      }));
    },
  });
}

function openInMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
    setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 500);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

const fmtTs = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : format(d, "dd/MM/yyyy 'às' HH:mm");
};

interface Props {
  serviceId: string;
  /** GPS de partida gravado no atendimento (fallback se não houver evento). */
  fallbackStart?: { latitude?: number | null; longitude?: number | null } | null;
}

/**
 * Rota da logística (calcário/insumos): Partida → Carregamento → Entrega na
 * propriedade, cada etapa com horário, coordenadas (mapa) e foto.
 */
export function LogisticsRoute({ serviceId, fallbackStart }: Props) {
  const { data: events = [], isLoading } = useServiceEvents(serviceId);

  const last = (type: string) => [...events].reverse().find((e) => e.event_type === type) || null;
  // Partida: o registro de GPS do início (e não a foto opcional de início da finalização comum).
  const start = [...events].reverse().find((e) => e.event_type === 'start' && e.latitude != null) || null;
  const loading = last('loading');
  const finish = last('finish');

  const steps = [
    {
      key: 'start', icon: Navigation, title: 'Partida', subtitle: 'Início do atendimento',
      at: start?.captured_at ?? null,
      lat: start?.latitude ?? fallbackStart?.latitude ?? null,
      lng: start?.longitude ?? fallbackStart?.longitude ?? null,
      url: undefined as string | undefined, done: !!(start || fallbackStart?.latitude),
      color: 'text-blue-600 bg-blue-500/10 border-blue-500/30',
    },
    {
      key: 'loading', icon: Truck, title: 'Carregamento', subtitle: 'Chegada ao local de carregamento',
      at: loading?.captured_at ?? null, lat: loading?.latitude ?? null, lng: loading?.longitude ?? null,
      url: loading?.url, done: !!loading,
      color: 'text-amber-700 bg-amber-500/10 border-amber-500/30',
    },
    {
      key: 'finish', icon: Flag, title: 'Entrega', subtitle: 'Propriedade do produtor',
      at: finish?.captured_at ?? null, lat: finish?.latitude ?? null, lng: finish?.longitude ?? null,
      url: finish?.url, done: !!finish,
      color: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-primary">Rota da logística</h3>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <ol className="space-y-2">
          {steps.map((st, i) => {
            const Icon = st.icon;
            const when = fmtTs(st.at);
            const hasGps = st.lat != null && st.lng != null;
            return (
              <li key={st.key} className={cn('rounded-lg border p-3', st.done ? st.color : 'border-dashed text-muted-foreground')}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border', st.done ? 'bg-background' : 'bg-muted')}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-1 text-[10px] font-semibold opacity-70">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{st.title}</p>
                    <p className="text-[11px] opacity-80">{st.subtitle}</p>
                    {st.done ? (
                      <>
                        {when && <p className="mt-1 text-xs text-foreground/80">{when}</p>}
                        {hasGps ? (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {Number(st.lat).toFixed(6)}, {Number(st.lng).toFixed(6)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">GPS não capturado</p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-xs">Aguardando</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {st.done && hasGps && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openInMaps(Number(st.lat), Number(st.lng))}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Mapa
                      </Button>
                    )}
                    {st.url && (
                      <button
                        type="button"
                        onClick={() => window.open(st.url, '_blank')}
                        className="relative h-16 w-12 overflow-hidden rounded-md border bg-muted"
                        title="Abrir foto"
                      >
                        <img src={st.url} alt={`Foto — ${st.title}`} className="h-full w-full object-cover" />
                        <Camera className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white drop-shadow" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
