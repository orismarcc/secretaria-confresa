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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Service, ServiceStatus } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Archive, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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

  const filteredServices = services.filter(s => {
    const producer = producers.find(p => p.id === s.producerId);
    const matchesSearch = producer?.name.toLowerCase().includes(search.toLowerCase()) || producer?.cpf.includes(search);
    const matchesDemandType = demandTypeFilter === 'all' || s.demandTypeId === demandTypeFilter;
    
    // Status filter: active = pending + in_progress, archived = completed
    const matchesStatus = statusFilter === 'active' 
      ? (s.status === 'pending' || s.status === 'in_progress')
      : s.status === 'completed';
    
    return matchesSearch && matchesDemandType && matchesStatus;
  });

  // Sort: pending and in_progress first by scheduled date
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (statusFilter === 'active') {
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    }
    // Archived: most recently completed first
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
    setEditingService(service);
    setFormOpen(true);
  };

  const openDeleteDialog = (service: Service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const openArchiveDialog = (service: Service) => {
    setServiceToArchive(service);
    setArchiveDialogOpen(true);
  };

  const columns = [
    { 
      key: 'producer', 
      header: 'Produtor', 
      render: (s: Service) => {
        const producer = producers.find(p => p.id === s.producerId);
        return (
          <div>
            <div className="font-medium">{producer?.name || 'N/A'}</div>
            <div className="text-xs text-muted-foreground">{producer?.cpf}</div>
          </div>
        );
      }
    },
    { key: 'demandType', header: 'Tipo', render: (s: Service) => demandTypes.find(d => d.id === s.demandTypeId)?.name || 'N/A' },
    { key: 'scheduledDate', header: 'Data', render: (s: Service) => format(new Date(s.scheduledDate), 'dd/MM/yyyy', { locale: ptBR }) },
    { key: 'workedArea', header: 'Área (ha)', render: (s: Service) => s.workedArea.toFixed(2) },
    { key: 'status', header: 'Status', render: (s: Service) => <StatusBadge status={s.status} /> },
    { 
      key: 'actions', 
      header: 'Ações', 
      render: (s: Service) => (
        <div className="flex gap-1">
          {s.status !== 'completed' && (
            <Button variant="ghost" size="icon" onClick={() => openArchiveDialog(s)} title="Finalizar">
              <CheckCircle className="h-4 w-4 text-success" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => openEditForm(s)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(s)} className="text-destructive hover:text-destructive" title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  const activeCount = services.filter(s => s.status !== 'completed').length;
  const archivedCount = services.filter(s => s.status === 'completed').length;

  return (
    <AppLayout>
      <PageHeader title="Atendimentos" description="Gerenciar atendimentos">
        <Button onClick={() => { setEditingService(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Atendimento
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
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por produtor..." className="max-w-sm" />
        <Select value={demandTypeFilter} onValueChange={setDemandTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo de demanda" />
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
