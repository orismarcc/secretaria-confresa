// Detalhes de um Responsável Técnico: resumo e lista dos atendimentos em que
// ele consta como responsável. Clicar num atendimento abre os detalhes dele
// em Atendimentos.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { AvatarThumb } from '@/components/AvatarUpload';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchInput } from '@/components/SearchInput';
import { ChevronRight, ClipboardList, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { textIncludes } from '@/lib/text';

interface Tecnico { id: string; name: string; cargo: string | null; photo_url?: string | null }

const dataServico = (s: any): string => {
  const raw = s.completed_at || s.scheduled_date;
  if (!raw) return '—';
  const d = new Date(String(raw).length <= 10 ? `${raw}T12:00:00` : String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy', { locale: ptBR });
};

export function DetalhesTecnicoSheet({ tecnico, services, onClose }: {
  tecnico: Tecnico | null;
  services: any[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const doTecnico = useMemo(() => (tecnico
    ? services
        .filter((s) => s.responsible_technician_id === tecnico.id && s.status !== 'cancelled')
        .sort((a, b) => String(b.completed_at || b.scheduled_date || '').localeCompare(String(a.completed_at || a.scheduled_date || '')))
    : []), [services, tecnico]);

  const finalizados = doTecnico.filter((s) => s.status === 'completed').length;
  const emAberto = doTecnico.length - finalizados;
  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    doTecnico.forEach((s) => { const t = s.demand_types?.name || 'Sem tipo'; m.set(t, (m.get(t) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [doTecnico]);
  const lista = doTecnico.filter((s) => !busca
    || textIncludes(s.producers?.name, busca) || textIncludes(s.demand_types?.name, busca) || textIncludes(s.settlements?.name, busca));

  return (
    <Sheet open={!!tecnico} onOpenChange={(o) => { if (!o) { setBusca(''); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">Detalhes do Responsável Técnico</SheetTitle>
        </SheetHeader>
        {tecnico && (
          <div className="mt-5 space-y-5">
            <div className="flex items-center gap-3">
              <AvatarThumb url={tecnico.photo_url} />
              <div className="min-w-0">
                <p className="font-semibold text-lg leading-tight">{tecnico.name}</p>
                <p className="text-sm text-muted-foreground">{tecnico.cargo || 'Responsável técnico'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border bg-primary/5 p-2.5">
                <ClipboardList className="h-4 w-4 mx-auto text-primary" />
                <p className="text-xl font-black">{doTecnico.length}</p>
                <p className="text-[10px] text-muted-foreground">atendimentos</p>
              </div>
              <div className="rounded-lg border bg-success/5 p-2.5">
                <CheckCircle2 className="h-4 w-4 mx-auto text-success" />
                <p className="text-xl font-black">{finalizados}</p>
                <p className="text-[10px] text-muted-foreground">finalizados</p>
              </div>
              <div className="rounded-lg border bg-amber-500/5 p-2.5">
                <Clock className="h-4 w-4 mx-auto text-amber-600" />
                <p className="text-xl font-black">{emAberto}</p>
                <p className="text-[10px] text-muted-foreground">em aberto</p>
              </div>
            </div>

            {porTipo.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {porTipo.map(([t, n]) => <Badge key={t} variant="secondary">{t}: {n}</Badge>)}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Atendimentos</p>
              {doTecnico.length > 6 && (
                <SearchInput value={busca} onChange={setBusca} placeholder="Buscar produtor, serviço ou assentamento..." />
              )}
              {lista.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {doTecnico.length === 0 ? 'Nenhum atendimento com este responsável técnico.' : 'Nada encontrado.'}
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {lista.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/services?detail=${s.id}`)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
                        title="Abrir os detalhes do atendimento"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{s.producers?.name || 'Produtor'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.demand_types?.name || 'Serviço'} · {dataServico(s)}
                          </p>
                          {s.settlements?.name && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />{s.settlements.name}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={s.status} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
