import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ServiceForm } from '@/components/forms/ServiceForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Archive, CheckCircle, Eye } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useServices,
  useProducers,
  useDemandTypes,
  useSettlements,
  useLocations,
  useCreateService,
  useUpdateService,
  useDeleteService
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
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  producers?: { name: string } | null;
  demand_types?: { name: string } | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
}

export default function ServicesPage() {
  const queryClient = useQueryClient();
  
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [demandTypeFilter, setDemandTypeFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<DbService | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<DbService | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [serviceToArchive, setServiceToArchive] = useState<DbService | null>(null);
  const [detailService, setDetailService] = useState<DbService | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('services_page_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['services'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredServices = services.filter((s: DbService) => {
    const producer = producers.find(p => p.id === s.producer_id);
    const matchesSearch = producer?.name?.toLowerCase().includes(search.toLowerCase()) || 
                          producer?.cpf?.includes(search) ||
                          s.producers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesDemandType = demandTypeFilter === 'all' || s.demand_type_id === demandTypeFilter;
    
    const matchesStatus = statusFilter === 'active' 
      ? (s.status === 'pending' || s.status === 'in_progress')
      : s.status === 'completed';
    
    return matchesSearch && matchesDemandType && matchesStatus;
  });

  const sortedServices = [...filteredServices].sort((a: DbService, b: DbService) => {
    if (statusFilter === 'active') {
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    }
    return new Date(b.completed_at || b.updated_at || 0).getTime() - new Date(a.completed_at || a.updated_at || 0).getTime();
  });

  const handleCreate = (data: any) => {
    const producer = producers.find(p => p.id === data.producerId);
    createService.mutate({
      producer_id: data.producerId,
      demand_type_id: data.demandTypeId,
      settlement_id: producer?.settlement_id || data.settlementId,
      location_id: producer?.location_id || data.locationId,
      scheduled_date: data.scheduledDate,
      notes: data.notes,
      priority: data.priority || 'medium',
    });
    setFormOpen(false);
  };

  const handleEdit = (data: any) => {
    if (editingService) {
      const producer = producers.find(p => p.id === data.producerId);
      updateService.mutate({
        id: editingService.id,
        producer_id: data.producerId,
        demand_type_id: data.demandTypeId,
        settlement_id: producer?.settlement_id || editingService.settlement_id,
        location_id: producer?.location_id || editingService.location_id,
        scheduled_date: data.scheduledDate,
        notes: data.notes,
        status: data.status,
        completed_at: data.status === 'completed' && editingService.status !== 'completed' 
          ? new Date().toISOString() 
          : editingService.completed_at,
      });
      setEditingService(null);
      setFormOpen(false);
    }
  };

  const handleDelete = () => {
    if (serviceToDelete) {
      deleteService.mutate(serviceToDelete.id);
      setServiceToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleArchive = () => {
    if (serviceToArchive) {
      updateService.mutate({ 
        id: serviceToArchive.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      setServiceToArchive(null);
      setArchiveDialogOpen(false);
    }
  };

  const openEditForm = (service: DbService) => {
    setDetailOpen(false);
    setEditingService(service);
    setFormOpen(true);
  };

  const openDeleteDialog = (service: DbService) => {
    setDetailOpen(false);
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const openArchiveDialog = (service: DbService) => {
    setDetailOpen(false);
    setServiceToArchive(service);
    setArchiveDialogOpen(true);
  };

  const openDetail = (service: DbService) => {
    setDetailService(service);
    setDetailOpen(true);
  };

  // Map service for form compatibility
  const mapServiceForForm = (s: DbService | null) => {
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
      priority: s.priority as 'low' | 'medium' | 'high',
      purpose: '',
      workedArea: 0,
      machinery: '',
      operatorName: '',
      chassisCode: '',
      termSigned: false,
      createdAt: new Date(s.created_at || Date.now()),
      updatedAt: new Date(s.updated_at || Date.now()),
    };
  };

  // Map data for form compatibility
  const mappedProducers = producers.map(p => ({
    id: p.id,
    name: p.name,
    cpf: p.cpf,
    phone: p.phone || '',
    settlementId: p.settlement_id || '',
    locationId: p.location_id || '',
    demandTypeIds: [],
    createdAt: new Date(p.created_at || Date.now())
  }));

  const mappedSettlements = settlements.map(s => ({
    id: s.id,
    name: s.name,
    createdAt: new Date(s.created_at || Date.now())
  }));

  const mappedLocations = locations.map(l => ({
    id: l.id,
    name: l.name,
    settlementId: l.settlement_id,
    createdAt: new Date(l.created_at || Date.now())
  }));

  const mappedDemandTypes = demandTypes.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description || undefined,
    isActive: d.is_active ?? true,
    createdAt: new Date(d.created_at || Date.now())
  }));

  const columns = [
    { 
      key: 'producer', 
      header: 'Produtor', 
      render: (s: DbService) => {
        const producer = producers.find(p => p.id === s.producer_id);
        return <span className="font-medium">{producer?.name || s.producers?.name || 'N/A'}</span>;
      }
    },
    { 
      key: 'demandType', 
      header: 'Tipo', 
      render: (s: DbService) => {
        const dt = demandTypes.find(d => d.id === s.demand_type_id);
        return dt?.name || s.demand_types?.name || 'N/A';
      }
    },
    { 
      key: 'settlement', 
      header: 'Assentamento', 
      render: (s: DbService) => {
        const st = settlements.find(set => set.id === s.settlement_id);
        return st?.name || s.settlements?.name || 'N/A';
      }
    },
    { 
      key: 'actions', 
      header: '', 
      render: (s: DbService) => (
        <Button variant="ghost" size="icon" onClick={() => openDetail(s)}>
          <Eye className="h-4 w-4" />
        </Button>
      )
    },
  ];

  const activeCount = services.filter((s: DbService) => s.status !== 'completed').length;
  const archivedCount = services.filter((s: DbService) => s.status === 'completed').length;

  // Detail view data
  const detailProducer = detailService ? producers.find(p => p.id === detailService.producer_id) : null;
  const detailDemandType = detailService ? demandTypes.find(d => d.id === detailService.demand_type_id) : null;
  const detailSettlement = detailService ? settlements.find(s => s.id === detailService.settlement_id) : null;
  const detailLocation = detailService ? locations.find(l => l.id === detailService.location_id) : null;

  if (servicesLoading) {
    return (
      <AppLayout>
        <PageHeader title="Atendimentos" description="Gerenciar atendimentos" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Atendimentos" description="Gerenciar atendimentos">
        <Button onClick={() => { setEditingService(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </PageHeader>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            Ativos <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs">{activeCount}</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            Arquivados <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{archivedCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2 items-center flex-wrap mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por produtor..." className="flex-1 min-w-[200px]" />
        <Select value={demandTypeFilter} onValueChange={setDemandTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {demandTypes.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <DataTable 
        data={sortedServices} 
        columns={columns} 
        keyExtractor={(s) => s.id} 
        emptyMessage={statusFilter === 'active' ? "Nenhum atendimento ativo" : "Nenhum atendimento arquivado"} 
      />

      {/* Sheet de Detalhes do Atendimento */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Detalhes do Atendimento</SheetTitle>
          </SheetHeader>
          
          {detailService && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={detailService.status as 'pending' | 'in_progress' | 'completed'} />
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Produtor</p>
                  <p className="font-medium">{detailProducer?.name || detailService.producers?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{detailProducer?.cpf}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Demanda</p>
                  <p className="font-medium">{detailDemandType?.name || detailService.demand_types?.name || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Localização</p>
                  <p className="font-medium">{detailSettlement?.name || detailService.settlements?.name || 'N/A'}</p>
                  <p className="text-sm">{detailLocation?.name || detailService.locations?.name || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Data Agendada</p>
                  <p className="font-medium">
                    {format(new Date(detailService.scheduled_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>

                {detailService.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="font-medium">{detailService.notes}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                {detailService.status !== 'completed' && (
                  <Button 
                    onClick={() => openArchiveDialog(detailService)}
                    className="w-full bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Atendimento
                  </Button>
                )}
                <Button variant="outline" onClick={() => openEditForm(detailService)} className="w-full">
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => openDeleteDialog(detailService)}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ServiceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        service={mapServiceForForm(editingService)}
        producers={mappedProducers}
        settlements={mappedSettlements}
        locations={mappedLocations}
        demandTypes={mappedDemandTypes}
        onSubmit={editingService ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Atendimento"
        description="Tem certeza que deseja excluir este atendimento? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Finalizar Atendimento"
        description="Ao finalizar, este atendimento será arquivado. Deseja continuar?"
        onConfirm={handleArchive}
        confirmLabel="Finalizar"
      />
    </AppLayout>
  );
}
