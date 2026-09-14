import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchInput } from '@/components/SearchInput';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Clock, ClipboardList, Navigation, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServices, useOperatorDemandTypes } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import { useAuth } from '@/contexts/AuthContext';

interface OperatorGroup {
  id: string;
  name: string;
  services: any[];
  totalHours: number;
  emAndamento: number;
  finalizados: number;
}

const hLine = (h: number) => `${(Number(h) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;

function mapsHref(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function FieldServicesPage() {
  const { user, isAssistente } = useAuth();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: operators = [], isLoading: opsLoading } = useOperators();
  // Assistente vê apenas os tipos de serviço liberados (vazio = todos).
  const { data: allowedDemandTypeIds = [], isLoading: dtLoading } = useOperatorDemandTypes(isAssistente ? user?.id : undefined);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OperatorGroup | null>(null);

  const isLoading = servicesLoading || opsLoading || dtLoading;

  // Serviços visíveis: se o assistente tem tipos liberados, filtra por eles.
  const visibleServices = useMemo(() => {
    if (!isAssistente || allowedDemandTypeIds.length === 0) return services as any[];
    const allowed = new Set(allowedDemandTypeIds);
    return (services as any[]).filter((s) => allowed.has(s.demand_type_id));
  }, [services, isAssistente, allowedDemandTypeIds]);

  // Agrupa por operador (só quem tem atendimentos atribuídos).
  const groups = useMemo(() => {
    const nameById = new Map<string, string>((operators as any[]).map((o) => [o.id, o.name]));
    const map = new Map<string, OperatorGroup>();
    for (const s of visibleServices) {
      const opId = s.operator_id;
      if (!opId) continue;
      const name = nameById.get(opId) || s.operador?.name || s.profiles?.name || 'Operador';
      let g = map.get(opId);
      if (!g) { g = { id: opId, name, services: [], totalHours: 0, emAndamento: 0, finalizados: 0 }; map.set(opId, g); }
      g.services.push(s);
      g.totalHours += Number(s.worked_hours) || 0;
      if (s.status === 'in_progress') g.emAndamento++;
      if (s.status === 'completed') g.finalizados++;
    }
    return Array.from(map.values()).sort((a, b) => b.services.length - a.services.length);
  }, [visibleServices, operators]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  // Serviços do operador selecionado, mais recentes primeiro.
  const selectedServices = useMemo(() => {
    if (!selected) return [];
    return [...selected.services].sort((a, b) => {
      const da = new Date(a.completed_at || a.scheduled_date || 0).getTime();
      const db = new Date(b.completed_at || b.scheduled_date || 0).getTime();
      return db - da;
    });
  }, [selected]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Atendimentos por operador" description="Selecione um operador para ver os atendimentos" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Atendimentos por operador" description="Toque em um operador para ver os atendimentos, horas e status" />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar operador..." className="max-w-md" />
      </div>

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum operador com atendimentos {search ? 'para esta busca' : 'no momento'}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g) => (
            <button key={g.id} onClick={() => setSelected(g)} className="text-left">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-full bg-violet-500/10 shrink-0">
                        <User className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.services.length} atendimento(s)</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {g.emAndamento > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> {g.emAndamento} em execução
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {hLine(g.totalHours)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <ClipboardList className="h-3.5 w-3.5" /> {g.finalizados} concluído(s)
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Detalhe do operador */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-violet-600" />
              {selected?.name}
            </DialogTitle>
            <DialogDescription>
              {selected ? `${selected.services.length} atendimento(s) · ${hLine(selected.totalHours)} · ${selected.finalizados} concluído(s)` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {selectedServices.map((s) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.producers?.name || 'N/A'}</p>
                    <p className="text-sm text-primary truncate">
                      {s.demand_types?.name || 'N/A'}
                      {(Number(s.worked_hours) || 0) > 0 && (
                        <span className="ml-2 text-xs text-foreground bg-muted rounded-full px-2 py-0.5">
                          {hLine(Number(s.worked_hours))}
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {(s.completed_at || s.scheduled_date) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date((s.completed_at || s.scheduled_date).toString().replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      )}
                      {s.settlements?.name && <span className="truncate">{s.settlements.name}</span>}
                    </div>
                  </div>
                  <StatusBadge status={s.status} className="shrink-0" />
                </div>
                {s.latitude && s.longitude && (
                  <a
                    href={mapsHref(s.latitude, s.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-info font-medium hover:underline"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Ver no mapa
                  </a>
                )}
              </div>
            ))}
            {selectedServices.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum atendimento.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
