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
import { useServices } from '@/hooks/useSupabaseData';
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
    eventType: 'created' | 'completed';
    registeredBy?: string;
  };
}

export default function CalendarPage() {
  const { data: services = [], isLoading } = useServices();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Parse a Supabase date/timestamp string to a local-midnight Date to avoid timezone shifts
  const toLocalDay = (raw: string | null | undefined): Date | null => {
    if (!raw) return null;
    // Normalize: replace space with T, extract YYYY-MM-DD, then treat as local noon to be safe
    const iso = raw.replace(' ', 'T');
    const datePart = iso.substring(0, 10); // "2026-04-08"
    return new Date(`${datePart}T12:00:00`);
  };

  const events = useMemo((): CalendarEvent[] => {
    const result: CalendarEvent[] = [];

    (services as any[]).forEach(s => {
      const producerName = s.producers?.name || 'Produtor';
      const demandTypeName = s.demand_types?.name || 'N/A';
      const registeredBy = s.profiles?.name;

      // Event for creation date (cadastro)
      const createdDate = toLocalDay(s.created_at) ?? toLocalDay(s.scheduled_date) ?? new Date();
      result.push({
        id: `${s.id}-created`,
        title: `📋 ${producerName}`,
        start: createdDate,
        end: createdDate,
        allDay: true,
        resource: {
          service: s,
          producerName,
          demandTypeName,
          status: s.status,
          notes: s.notes,
          eventType: 'created',
          registeredBy,
        },
      });

      // Event for completion date (only for completed services)
      if (s.status === 'completed' && s.completed_at) {
        const d = toLocalDay(s.completed_at) ?? new Date();
        result.push({
          id: `${s.id}-completed`,
          title: `✅ ${producerName}`,
          start: d,
          end: d,
          allDay: true,
          resource: {
            service: s,
            producerName,
            demandTypeName,
            status: s.status,
            notes: s.notes,
            eventType: 'completed',
            registeredBy,
          },
        });
      }
    });

    return result;
  }, [services]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const isCompleted = event.resource.eventType === 'completed';
    const bgColor = isCompleted ? '#22c55e' : (
      event.resource.status === 'pending' ? '#f59e0b' :
      event.resource.status === 'in_progress' ? '#3b82f6' : '#6b7280'
    );
    return {
      style: {
        backgroundColor: bgColor,
        borderRadius: '6px',
        border: 'none',
        color: 'white',
        fontSize: '12px',
        padding: '2px 6px',
        cursor: 'pointer',
      },
    };
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  const createdCount = events.filter(e => e.resource.eventType === 'created').length;
  const completedCount = events.filter(e => e.resource.eventType === 'completed').length;

  return (
    <AppLayout>
      <PageHeader
        title="Calendário de Atendimentos"
        description="Cadastros e finalizações por data"
      />

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
          <span className="text-muted-foreground">Cadastrado - Pendente</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          <span className="text-muted-foreground">Cadastrado - Em Execução</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span className="text-muted-foreground">Finalizado</span>
        </div>
        <Badge variant="outline" className="ml-auto">
          {createdCount} cadastros · {completedCount} finalizações
        </Badge>
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
            <SheetTitle className="text-left">
              {selectedEvent?.resource.eventType === 'completed' ? '✅ Finalização' : '📋 Cadastro'} de Atendimento
            </SheetTitle>
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
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.resource.eventType === 'completed' ? 'Finalizado em' : 'Cadastrado em'}
                </p>
                <p className="font-medium">
                  {format(selectedEvent.start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              {selectedEvent.resource.registeredBy && selectedEvent.resource.eventType === 'created' && (
                <div>
                  <p className="text-sm text-muted-foreground">Cadastrado por</p>
                  <p className="font-medium">{selectedEvent.resource.registeredBy}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status atual</p>
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
