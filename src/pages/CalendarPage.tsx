import { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useServices, useProducers, useDemandTypes } from '@/hooks/useSupabaseData';
import { StatusBadge } from '@/components/StatusBadge';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales,
});

const messages = {
  allDay: 'Dia inteiro',
  previous: '‹ Anterior',
  next: 'Próximo ›',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Atendimento',
  noEventsInRange: 'Nenhum atendimento neste período.',
  showMore: (total: number) => `+${total} mais`,
};

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    service: any;
    producerName: string;
    demandTypeName: string;
    status: string;
    notes?: string;
  };
}

export default function CalendarPage() {
  const { data: services = [], isLoading } = useServices();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const events = useMemo((): CalendarEvent[] => {
    return (services as any[]).map(s => {
      const producer = (producers as any[]).find(p => p.id === s.producer_id);
      const demandType = (demandTypes as any[]).find(d => d.id === s.demand_type_id);
      const d = new Date(s.scheduled_date);
      return {
        id: s.id,
        title: producer?.name || s.producers?.name || 'Produtor',
        start: d,
        end: d,
        allDay: true,
        resource: {
          service: s,
          producerName: producer?.name || s.producers?.name || 'N/A',
          demandTypeName: demandType?.name || s.demand_types?.name || 'N/A',
          status: s.status,
          notes: s.notes,
        },
      };
    });
  }, [services, producers, demandTypes]);

  const eventStyleGetter = (event: CalendarEvent) => ({
    style: {
      backgroundColor: statusColors[event.resource.status] ?? '#6b7280',
      borderRadius: '6px',
      border: 'none',
      color: 'white',
      fontSize: '12px',
      padding: '2px 6px',
      cursor: 'pointer',
    },
  });

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  const pendingCount = events.filter(e => e.resource.status === 'pending').length;
  const inProgressCount = events.filter(e => e.resource.status === 'in_progress').length;
  const completedCount = events.filter(e => e.resource.status === 'completed').length;

  return (
    <AppLayout>
      <PageHeader
        title="Calendário de Atendimentos"
        description="Visualização por data dos atendimentos agendados"
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
          <span className="text-muted-foreground">Pendente ({pendingCount})</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          <span className="text-muted-foreground">Em Execução ({inProgressCount})</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span className="text-muted-foreground">Finalizado ({completedCount})</span>
        </div>
        <Badge variant="outline" className="ml-auto">{events.length} total</Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-xl" />
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="h-[600px]">
              <Calendar
                localizer={localizer}
                events={events}
                view={view}
                date={date}
                onView={setView}
                onNavigate={setDate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                messages={messages}
                culture="pt-BR"
                style={{ height: '100%' }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-left">Detalhes do Atendimento</SheetTitle>
          </SheetHeader>
          {selectedEvent && (
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Produtor</p>
                <p className="font-semibold text-lg">{selectedEvent.resource.producerName}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Demanda</p>
                <p className="font-medium">{selectedEvent.resource.demandTypeName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Agendada</p>
                <p className="font-medium">
                  {format(selectedEvent.start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <StatusBadge status={selectedEvent.resource.status as 'pending' | 'in_progress' | 'completed'} />
              </div>
              {selectedEvent.resource.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{selectedEvent.resource.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
