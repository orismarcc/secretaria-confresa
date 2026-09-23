import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/SearchInput';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { textIncludes } from '@/lib/text';
import type { OperatorCompletedService } from '@/hooks/useSupabaseData';

const PAGE = 30;

const parseTs = (v?: string | null) => (v ? new Date(String(v).replace(' ', 'T')) : null);

function openMaps(lat: number, lng: number) {
  // Celular abre o app de mapas; desktop abre o Google Maps no navegador.
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
  else window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
}

interface Props {
  services: OperatorCompletedService[];
  isLoading?: boolean;
}

/** Lista resumida dos atendimentos finalizados pelo operador, agrupada por mês. */
export function OperatorCompletedList({ services, isLoading }: Props) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => services.filter((s) =>
    !search ||
    textIncludes(s.producers?.name, search) ||
    textIncludes(s.demand_types?.name, search) ||
    textIncludes(s.settlements?.name, search) ||
    textIncludes(s.producers?.location_name || s.locations?.name, search),
  ), [services, search]);

  // Agrupa por mês de conclusão (mantém a ordem: mais recentes primeiro).
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: OperatorCompletedService[] }[] = [];
    filtered.slice(0, limit).forEach((s) => {
      const d = parseTs(s.completed_at);
      const key = d ? format(d, 'yyyy-MM') : 'sem-data';
      const label = d ? format(d, "MMMM 'de' yyyy", { locale: ptBR }) : 'Sem data de conclusão';
      let g = out.find((x) => x.key === key);
      if (!g) { g = { key, label, items: [] }; out.push(g); }
      g.items.push(s);
    });
    return out;
  }, [filtered, limit]);

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  }

  if (services.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">Você ainda não tem atendimentos finalizados.</CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(PAGE); }} placeholder="Buscar produtor, serviço ou local..." />

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum atendimento encontrado.</p>
      )}

      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground first-letter:uppercase">
            {g.label} <span className="ml-1 font-bold text-success">{g.items.length}</span>
          </h3>
          <div className="space-y-2">
            {g.items.map((s) => {
              const d = parseTs(s.completed_at);
              const horas = Number(s.worked_hours) || 0;
              const local = [s.settlements?.name, s.producers?.location_name || s.locations?.name].filter(Boolean).join(' - ');
              const hasGps = s.latitude != null && s.longitude != null;
              return (
                <Card key={s.id} className="border-l-4 border-l-success">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{s.producers?.name || 'Produtor'}</p>
                        <p className="text-sm text-primary truncate">{s.demand_types?.name || 'Serviço'}</p>
                      </div>
                      {hasGps && (
                        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => openMaps(s.latitude!, s.longitude!)}>
                          <Navigation className="h-4 w-4" /> Mapa
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        {d ? `Finalizado em ${format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : 'Finalizado'}
                      </span>
                      {local && (
                        <span className="flex items-center gap-2 min-w-0">
                          <MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{local}</span>
                        </span>
                      )}
                      {horas > 0 && (
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0" />
                          {horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h realizadas
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length > limit && (
        <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Mostrar mais ({filtered.length - limit} restantes)
        </Button>
      )}
    </div>
  );
}
