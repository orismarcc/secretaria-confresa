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
import { User, Clock, ClipboardList, Navigation, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServices, useOperatorDemandTypes, useOperatorSettlements, useOperatorMachinery } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import { useAuth } from '@/contexts/AuthContext';

interface OperatorGroup {
  id: string;
  name: string;
  /** Nº de atendimentos finalizados no ano vigente. */
  realizadosAno: number;
  /** Pendentes com DAM paga e/ou marcados como "próximo". */
  pendentes: any[];
}

const ANO_VIGENTE = new Date().getFullYear();

function mapsHref(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Ano de finalização do atendimento.
function completedYear(s: any): number | null {
  if (s.status !== 'completed' || !s.completed_at) return null;
  const d = new Date(String(s.completed_at).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

// Pendente relevante para o assistente: ainda não finalizado/cancelado e com
// DAM paga OU marcado como "próximo".
function isPendenteRelevante(s: any): boolean {
  if (s.status === 'completed' || s.status === 'cancelled') return false;
  return s.dam_paid === true || s.status === 'proximo';
}

export default function FieldServicesPage() {
  const { user, isAssistente } = useAuth();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: operators = [], isLoading: opsLoading } = useOperators();
  // Assistente satisfaz duas condições (maquinário + assentamento) e vê só os
  // tipos de serviço liberados. Vazio em qualquer dimensão = sem restrição nela.
  const uid = isAssistente ? user?.id : undefined;
  const { data: allowedDemandTypeIds = [], isLoading: dtLoading } = useOperatorDemandTypes(uid);
  const { data: allowedSettlementIds = [], isLoading: stLoading } = useOperatorSettlements(uid);
  const { data: allowedMachineryIds = [], isLoading: mLoading } = useOperatorMachinery(uid);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OperatorGroup | null>(null);

  const isLoading = servicesLoading || opsLoading || dtLoading || stLoading || mLoading;

  // Serviços visíveis. Para o assistente aplica-se a interseção:
  // tipo de serviço ∩ maquinário ∩ assentamento (cada filtro só vale se houver seleção).
  const visibleServices = useMemo(() => {
    if (!isAssistente) return services as any[];
    let vis = services as any[];
    if (allowedDemandTypeIds.length > 0) {
      const allow = new Set(allowedDemandTypeIds);
      vis = vis.filter((s) => allow.has(s.demand_type_id));
    }
    if (allowedMachineryIds.length > 0) {
      const allow = new Set(allowedMachineryIds);
      vis = vis.filter((s) => s.machinery_id && allow.has(s.machinery_id));
    }
    if (allowedSettlementIds.length > 0) {
      const allow = new Set(allowedSettlementIds);
      vis = vis.filter((s) => s.settlement_id && allow.has(s.settlement_id));
    }
    return vis;
  }, [services, isAssistente, allowedDemandTypeIds, allowedMachineryIds, allowedSettlementIds]);

  // Agrupa por operador: conta finalizados no ano e junta os pendentes relevantes.
  const groups = useMemo(() => {
    const nameById = new Map<string, string>((operators as any[]).map((o) => [o.id, o.name]));
    const map = new Map<string, OperatorGroup>();
    for (const s of visibleServices) {
      const opId = s.operator_id;
      if (!opId) continue;
      const name = nameById.get(opId) || s.operador?.name || s.profiles?.name || 'Operador';
      let g = map.get(opId);
      if (!g) { g = { id: opId, name, realizadosAno: 0, pendentes: [] }; map.set(opId, g); }
      if (completedYear(s) === ANO_VIGENTE) g.realizadosAno++;
      if (isPendenteRelevante(s)) g.pendentes.push(s);
    }
    // Só operadores com algo a mostrar (realizados no ano ou pendentes relevantes).
    return Array.from(map.values())
      .filter((g) => g.realizadosAno > 0 || g.pendentes.length > 0)
      .sort((a, b) => b.pendentes.length - a.pendentes.length || b.realizadosAno - a.realizadosAno);
  }, [visibleServices, operators]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  // Pendentes do operador selecionado (DAM paga / próximo), mais recentes primeiro.
  const selectedServices = useMemo(() => {
    if (!selected) return [];
    return [...selected.pendentes].sort((a, b) => {
      const da = new Date(a.scheduled_date || a.created_at || 0).getTime();
      const db = new Date(b.scheduled_date || b.created_at || 0).getTime();
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
      <PageHeader title="Atendimentos por operador" description={`Realizados em ${ANO_VIGENTE} e pendentes com DAM paga / próximo`} />

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
                        <p className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5" />
                          {g.realizadosAno} realizado(s) em {ANO_VIGENTE}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      {g.pendentes.length} pendente(s) — DAM paga / próximo
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
              {selected ? `${selected.realizadosAno} realizado(s) em ${ANO_VIGENTE} · ${selected.pendentes.length} pendente(s) com DAM paga / próximo` : ''}
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
                      {s.dam_paid && (
                        <span className="ml-2 text-xs text-emerald-700 bg-emerald-500/15 rounded-full px-2 py-0.5">
                          DAM paga
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {s.scheduled_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(String(s.scheduled_date).replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR })}
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
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pendente com DAM paga ou marcado como próximo.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
