import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, Phone, User, Calendar, GripVertical, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineIndicator } from '@/components/ConnectionStatus';
import { FinalizeServiceModal } from '@/components/FinalizeServiceModal';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePendingServices,
  useSettlements,
  useLocations,
  useUpdateService,
  useUpdateServicePositions
} from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface DbService {
  id: string;
  producer_id: string;
  demand_type_id: string;
  settlement_id?: string | null;
  location_id?: string | null;
  status: string;
  scheduled_date: string;
  completed_at?: string | null;
  notes?: string | null;
  priority: string;
  operator_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  position?: number | null;
  producers?: { name: string; cpf: string; phone?: string | null; location_name?: string | null; latitude?: number | null; longitude?: number | null } | null;
  demand_types?: { name: string } | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
}

// Sortable Card Component for Operator
interface SortableOperatorCardProps {
  service: DbService;
  settlementName: string;
  locationName: string;
  onStart: (id: string) => void;
  onFinalize: (service: DbService) => void;
  isPending: boolean;
}

function SortableOperatorCard({
  service,
  settlementName,
  locationName,
  onStart,
  onFinalize,
  isPending,
}: SortableOperatorCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "overflow-hidden transition-all",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none mt-1"
            aria-label="Arrastar para reordenar"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-lg">{service.producers?.name || 'N/A'}</p>
                <p className="text-sm text-primary">{service.demand_types?.name}</p>
              </div>
              <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed'} />
            </div>
            
            <div className="grid gap-2 text-sm mb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(new Date(service.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {settlementName} - {locationName}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                {service.producers?.cpf || 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                {service.producers?.phone || 'N/A'}
              </div>
            </div>
            
            <div className="flex gap-2">
              {service.producers?.latitude && service.producers?.longitude && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  asChild
                >
                  <a
                    href={`geo:${service.producers.latitude},${service.producers.longitude}?q=${service.producers.latitude},${service.producers.longitude}`}
                    onClick={(e) => {
                      // Fallback to Google Maps on desktop
                      if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                        e.preventDefault();
                        window.open(`https://www.google.com/maps?q=${service.producers!.latitude},${service.producers!.longitude}`, '_blank');
                      }
                    }}
                  >
                    <Navigation className="h-4 w-4" />
                    Maps
                  </a>
                </Button>
              )}
              {service.status === 'pending' && (
                <Button 
                  className="flex-1" 
                  onClick={() => onStart(service.id)}
                  disabled={isPending}
                >
                  Iniciar
                </Button>
              )}
              {service.status === 'in_progress' && (
                <Button 
                  className="flex-1 bg-success hover:bg-success/90" 
                  onClick={() => onFinalize(service)}
                  disabled={isPending}
                >
                  Finalizar
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperatorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const { data: pendingServicesRaw = [], isLoading } = usePendingServices();
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();
  const updateService = useUpdateService();
  const updatePositions = useUpdateServicePositions();
  
  const [selectedService, setSelectedService] = useState<DbService | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  // Drag and drop sensors with touch support for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort pending services by position
  const pendingServices = useMemo(() => {
    return [...pendingServicesRaw].sort((a, b) => {
      const posA = (a as DbService).position ?? 999999;
      const posB = (b as DbService).position ?? 999999;
      if (posA !== posB) return posA - posB;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });
  }, [pendingServicesRaw]);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('operator_services_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['services', 'pending'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleStartService = (id: string) => {
    updateService.mutate({ 
      id, 
      status: 'in_progress',
      operator_id: user?.id 
    });
    toast({ title: 'Atendimento iniciado! Atribuído a você.' });
  };

  const handleOpenFinalize = (service: DbService) => {
    setSelectedService(service);
    setShowFinalizeModal(true);
  };

  const handleFinalize = (data: {
    photoStoragePath?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    if (!selectedService) return;
    
    updateService.mutate({
      id: selectedService.id,
      status: 'completed',
      completed_at: new Date().toISOString(),
      latitude: data.latitude,
      longitude: data.longitude,
      sync_status: 'synced',
    });
    
    toast({
      title: 'Atendimento finalizado!',
      description: 'Atendimento concluído com sucesso.',
    });
    
    setSelectedService(null);
    setShowFinalizeModal(false);
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pendingServices.findIndex((s) => s.id === active.id);
      const newIndex = pendingServices.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(pendingServices, oldIndex, newIndex);
        
        const updates = reordered.map((service, index) => ({
          id: service.id,
          position: index + 1,
        }));
        
        updatePositions.mutate(updates);
        toast({ title: 'Ordem atualizada!' });
      }
    }
  }, [pendingServices, updatePositions, toast]);

  // Map service for modal compatibility
  const mapServiceForModal = (s: DbService | null) => {
    if (!s) return null;
    return {
      id: s.id,
      producerId: s.producer_id,
      demandTypeId: s.demand_type_id,
      settlementId: s.settlement_id || '',
      locationId: s.location_id || '',
      status: s.status as 'pending' | 'in_progress' | 'completed',
      scheduledDate: new Date(s.scheduled_date),
      completedDate: s.completed_at ? new Date(s.completed_at) : undefined,
      notes: s.notes || undefined,
      priority: s.priority,
      purpose: '',
      workedArea: 0,
      machinery: '',
      operatorName: '',
      chassisCode: '',
      termSigned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      producer: s.producers ? {
        id: s.producer_id,
        name: s.producers.name,
        cpf: s.producers.cpf,
        phone: s.producers.phone || '',
        settlementId: s.settlement_id || '',
        locationId: s.location_id || '',
        demandTypeIds: [],
        createdAt: new Date()
      } : undefined,
      demandType: s.demand_types ? {
        id: s.demand_type_id,
        name: s.demand_types.name,
        isActive: true,
        createdAt: new Date()
      } : undefined,
    };
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Meus Atendimentos" description="Próximos serviços programados">
          <OnlineIndicator />
        </PageHeader>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Meus Atendimentos" description="Próximos serviços programados (arraste para reordenar)">
        <OnlineIndicator />
      </PageHeader>

      {pendingServices.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum atendimento pendente</CardContent></Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pendingServices.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {pendingServices.map((service: DbService) => {
                const settlement = settlements.find(s => s.id === service.settlement_id);
                const location = locations.find(l => l.id === service.location_id);
                return (
                  <SortableOperatorCard
                    key={service.id}
                    service={service}
                    settlementName={settlement?.name || service.settlements?.name || 'N/A'}
                    locationName={service.producers?.location_name || location?.name || service.locations?.name || 'N/A'}
                    onStart={handleStartService}
                    onFinalize={handleOpenFinalize}
                    isPending={updateService.isPending}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FinalizeServiceModal
        open={showFinalizeModal}
        onOpenChange={setShowFinalizeModal}
        service={mapServiceForModal(selectedService)}
        onFinalize={handleFinalize}
      />
    </AppLayout>
  );
}
