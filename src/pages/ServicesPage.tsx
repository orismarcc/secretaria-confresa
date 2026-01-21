import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
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
import { Service } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Archive, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

export default function ServicesPage() {
  const { services, producers, demandTypes, settlements, locations, createService, updateService, deleteService } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [demandTypeFilter, setDemandTypeFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [serviceToArchive, setServiceToArchive] = useState<Service | null>(null);
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredServices = services.filter(s => {
    const producer = producers.find(p => p.id === s.producerId);
    const matchesSearch = producer?.name.toLowerCase().includes(search.toLowerCase()) || producer?.cpf.includes(search);
    const matchesDemandType = demandTypeFilter === 'all' || s.demandTypeId === demandTypeFilter;
    
    const matchesStatus = statusFilter === 'active' 
      ? (s.status === 'pending' || s.status === 'in_progress')
      : s.status === 'completed';
    
    return matchesSearch && matchesDemandType && matchesStatus;
  });

  const sortedServices = [...filteredServices].sort((a, b) => {
    if (statusFilter === 'active') {
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    }
    return new Date(b.completedDate || b.updatedAt).getTime() - new Date(a.completedDate || a.updatedAt).getTime();
  });

  const handleCreate = (data: any) => {
    const producer = producers.find(p => p.id === data.producerId);
    createService({
      ...data,
      settlementId: producer?.settlementId || '',
      locationId: producer?.locationId || '',
      scheduledDate: new Date(data.scheduledDate),
    });
    toast.success('Atendimento cadastrado com sucesso!');
  };

  const handleEdit = (data: any) => {
    if (editingService) {
      const producer = producers.find(p => p.id === data.producerId);
      updateService(editingService.id, {
        ...data,
        settlementId: producer?.settlementId || editingService.settlementId,
        locationId: producer?.locationId || editingService.locationId,
        scheduledDate: new Date(data.scheduledDate),
        completedDate: data.status === 'completed' && editingService.status !== 'completed' ? new Date() : editingService.completedDate,
      });
      toast.success('Atendimento atualizado com sucesso!');
      setEditingService(null);
    }
  };

  const handleDelete = () => {
    if (serviceToDelete) {
      deleteService(serviceToDelete.id);
      toast.success('Atendimento excluído com sucesso!');
      setServiceToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleArchive = () => {
    if (serviceToArchive) {
      updateService(serviceToArchive.id, { 
        status: 'completed',
        completedDate: new Date(),
      });
      toast.success('Atendimento finalizado e arquivado!');
      setServiceToArchive(null);
      setArchiveDialogOpen(false);
    }
  };

  const openEditForm = (service: Service) => {
    setDetailOpen(false);
    setEditingService(service);
    setFormOpen(true);
  };

  const openDeleteDialog = (service: Service) => {
    setDetailOpen(false);
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const openArchiveDialog = (service: Service) => {
    setDetailOpen(false);
    setServiceToArchive(service);
    setArchiveDialogOpen(true);
  };

  const openDetail = (service: Service) => {
    setDetailService(service);
    setDetailOpen(true);
  };

  // Colunas simplificadas para mobile: Nome do Produtor, Tipo, Assentamento
  const columns = [
    { 
      key: 'producer', 
      header: 'Produtor', 
      render: (s: Service) => {
        const producer = producers.find(p => p.id === s.producerId);
        return <span className="font-medium">{producer?.name || 'N/A'}</span>;
      }
    },
    { 
      key: 'demandType', 
      header: 'Tipo', 
      render: (s: Service) => demandTypes.find(d => d.id === s.demandTypeId)?.name || 'N/A' 
    },
    { 
      key: 'settlement', 
      header: 'Assentamento', 
      render: (s: Service) => settlements.find(st => st.id === s.settlementId)?.name || 'N/A' 
    },
    { 
      key: 'actions', 
      header: '', 
      render: (s: Service) => (
        <Button variant="ghost" size="icon" onClick={() => openDetail(s)}>
          <Eye className="h-4 w-4" />
        </Button>
      )
    },
  ];

  const activeCount = services.filter(s => s.status !== 'completed').length;
  const archivedCount = services.filter(s => s.status === 'completed').length;

  // Dados do serviço selecionado para detalhes
  const detailProducer = detailService ? producers.find(p => p.id === detailService.producerId) : null;
  const detailDemandType = detailService ? demandTypes.find(d => d.id === detailService.demandTypeId) : null;
  const detailSettlement = detailService ? settlements.find(s => s.id === detailService.settlementId) : null;
  const detailLocation = detailService ? locations.find(l => l.id === detailService.locationId) : null;

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
                <StatusBadge status={detailService.status} />
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Produtor</p>
                  <p className="font-medium">{detailProducer?.name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{detailProducer?.cpf}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Demanda</p>
                  <p className="font-medium">{detailDemandType?.name || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Localização</p>
                  <p className="font-medium">{detailSettlement?.name || 'N/A'}</p>
                  <p className="text-sm">{detailLocation?.name || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Data Agendada</p>
                  <p className="font-medium">
                    {format(new Date(detailService.scheduledDate), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Área Trabalhada</p>
                  <p className="font-medium">{detailService.workedArea.toFixed(2)} ha</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Finalidade</p>
                  <p className="font-medium">{detailService.purpose || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Maquinário</p>
                  <p className="font-medium">{detailService.machinery || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Operador</p>
                  <p className="font-medium">{detailService.operatorName || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Chassi/Patrimônio</p>
                  <p className="font-medium">{detailService.chassisCode || 'N/A'}</p>
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
        service={editingService}
        producers={producers}
        settlements={settlements}
        locations={locations}
        demandTypes={demandTypes}
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
