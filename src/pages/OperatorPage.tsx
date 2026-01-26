import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { ServicePhoto } from '@/types';
import { MapPin, Phone, User, Calendar } from 'lucide-react';
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
  useUpdateService
} from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

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
  producers?: { name: string; cpf: string; phone?: string | null } | null;
  demand_types?: { name: string } | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
}

export default function OperatorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: pendingServices = [], isLoading } = usePendingServices();
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();
  const updateService = useUpdateService();
  
  const [selectedService, setSelectedService] = useState<DbService | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

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

  const handleStatusChange = (id: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    updateService.mutate({ id, status: newStatus });
    toast({ title: 'Atendimento iniciado!' });
  };

  const handleOpenFinalize = (service: DbService) => {
    setSelectedService(service);
    setShowFinalizeModal(true);
  };

  const handleFinalize = (data: {
    photo?: ServicePhoto;
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
      sync_status: data.photo ? 'pending' : 'synced',
    });
    
    toast({
      title: 'Atendimento finalizado!',
      description: data.photo 
        ? 'Foto salva. Sincronizará quando online.' 
        : 'Atendimento concluído com sucesso.',
    });
    
    setSelectedService(null);
    setShowFinalizeModal(false);
  };

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
      <PageHeader title="Meus Atendimentos" description="Próximos serviços programados">
        <OnlineIndicator />
      </PageHeader>

      {pendingServices.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum atendimento pendente</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {pendingServices.map((service: DbService) => {
            const settlement = settlements.find(s => s.id === service.settlement_id);
            const location = locations.find(l => l.id === service.location_id);
            return (
              <Card key={service.id} className="overflow-hidden">
                <CardContent className="p-4">
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
                      {settlement?.name || service.settlements?.name || 'N/A'} - {location?.name || service.locations?.name || 'N/A'}
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
                    {service.status === 'pending' && (
                      <Button 
                        className="flex-1" 
                        onClick={() => handleStatusChange(service.id, 'in_progress')}
                        disabled={updateService.isPending}
                      >
                        Iniciar
                      </Button>
                    )}
                    {service.status === 'in_progress' && (
                      <Button 
                        className="flex-1 bg-success hover:bg-success/90" 
                        onClick={() => handleOpenFinalize(service)}
                        disabled={updateService.isPending}
                      >
                        Finalizar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
