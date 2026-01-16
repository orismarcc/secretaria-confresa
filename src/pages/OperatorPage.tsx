import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { ServiceStatus } from '@/types';
import { MapPin, Phone, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OnlineIndicator } from '@/components/ConnectionStatus';
import { useToast } from '@/hooks/use-toast';

export default function OperatorPage() {
  const { getPendingServices, updateService, settlements, locations } = useData();
  const { toast } = useToast();
  const pendingServices = getPendingServices();

  const handleStatusChange = (id: string, newStatus: ServiceStatus) => {
    updateService(id, { status: newStatus, ...(newStatus === 'completed' ? { completedDate: new Date() } : {}) });
    toast({ title: 'Status atualizado!' });
  };

  return (
    <AppLayout>
      <PageHeader title="Meus Atendimentos" description="Próximos serviços programados">
        <OnlineIndicator />
      </PageHeader>

      {pendingServices.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum atendimento pendente</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {pendingServices.map((service) => {
            const settlement = settlements.find(s => s.id === service.settlementId);
            const location = locations.find(l => l.id === service.locationId);
            return (
              <Card key={service.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-lg">{service.producer?.name}</p>
                      <p className="text-sm text-primary">{service.demandType?.name}</p>
                    </div>
                    <StatusBadge status={service.status} />
                  </div>
                  
                  <div className="grid gap-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(service.scheduledDate), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {settlement?.name} - {location?.name}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      {service.producer?.cpf}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {service.producer?.phone}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {service.status === 'pending' && (
                      <Button className="flex-1" onClick={() => handleStatusChange(service.id, 'in_progress')}>Iniciar</Button>
                    )}
                    {service.status === 'in_progress' && (
                      <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => handleStatusChange(service.id, 'completed')}>Finalizar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
