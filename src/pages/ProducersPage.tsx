import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ProducerForm } from '@/components/forms/ProducerForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProducerDetailSheet } from '@/components/ProducerDetailSheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProducers,
  useSettlements,
  useLocations,
  useDemandTypes,
  useCreateProducer,
  useUpdateProducer,
  useDeleteProducer
} from '@/hooks/useSupabaseData';

interface DbProducer {
  id: string;
  name: string;
  cpf: string;
  phone?: string | null;
  settlement_id?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  property_name?: string | null;
  property_size?: number | null;
  dap_cap?: string | null;
  created_at?: string | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
}

export default function ProducersPage() {
  const { data: producers = [], isLoading: producersLoading } = useProducers();
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();
  const { data: demandTypes = [] } = useDemandTypes();
  const createProducer = useCreateProducer();
  const updateProducer = useUpdateProducer();
  const deleteProducer = useDeleteProducer();

  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<DbProducer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [producerToDelete, setProducerToDelete] = useState<DbProducer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState<DbProducer | null>(null);

  const filtered = producers.filter((p: DbProducer) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search);
    const matchesSettlement = settlementFilter === 'all' || p.settlement_id === settlementFilter;
    return matchesSearch && matchesSettlement;
  });

  const handleCreate = (data: any) => {
    createProducer.mutate({
      name: data.name,
      cpf: data.cpf,
      phone: data.phone,
      settlement_id: data.settlementId,
      location_name: data.locationName,
      property_name: data.propertyName,
      property_size: data.propertySize,
      dap_cap: data.dapCap,
    });
    setFormOpen(false);
  };

  const handleEdit = (data: any) => {
    if (editingProducer) {
      updateProducer.mutate({
        id: editingProducer.id,
        name: data.name,
        cpf: data.cpf,
        phone: data.phone,
        settlement_id: data.settlementId,
        location_name: data.locationName,
        property_name: data.propertyName,
        property_size: data.propertySize,
        dap_cap: data.dapCap,
      });
      setEditingProducer(null);
      setFormOpen(false);
    }
  };

  const handleDelete = () => {
    if (producerToDelete) {
      deleteProducer.mutate(producerToDelete.id);
      setProducerToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openEditForm = (producer: any) => {
    // Find the DB producer
    const dbProducer = producers.find(p => p.id === producer.id);
    if (dbProducer) {
      setEditingProducer(dbProducer);
      setFormOpen(true);
    }
  };

  const openDeleteDialog = (producer: any) => {
    const dbProducer = producers.find(p => p.id === producer.id);
    if (dbProducer) {
      setProducerToDelete(dbProducer);
      setDeleteDialogOpen(true);
    }
  };

  const openDetail = (producer: DbProducer) => {
    setSelectedProducer(producer);
    setDetailOpen(true);
  };

  // Map producer for form/detail compatibility
  const mapProducerForDisplay = (p: DbProducer | null) => {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      cpf: p.cpf,
      phone: p.phone || '',
      settlementId: p.settlement_id || '',
      locationId: p.location_id || '',
      locationName: p.location_name || '',
      demandTypeIds: [],
      createdAt: new Date(p.created_at || Date.now())
    };
  };

  // Map data for form compatibility
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
    { key: 'name', header: 'Nome', render: (p: DbProducer) => <span className="font-medium">{p.name}</span> },
    { 
      key: 'settlement', 
      header: 'Assentamento', 
      render: (p: DbProducer) => p.settlements?.name || settlements.find(s => s.id === p.settlement_id)?.name || 'N/A' 
    },
    { 
      key: 'actions', 
      header: '', 
      render: (p: DbProducer) => (
        <Button variant="ghost" size="sm" onClick={() => openDetail(p)} className="gap-1">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Ver</span>
        </Button>
      )
    },
  ];

  const selectedSettlement = selectedProducer ? settlements.find(s => s.id === selectedProducer.settlement_id) : undefined;
  const selectedLocation = selectedProducer ? locations.find(l => l.id === selectedProducer.location_id) : undefined;

  if (producersLoading) {
    return (
      <AppLayout>
        <PageHeader title="Produtores" description="Gerenciar produtores" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Produtores" description="Gerenciar produtores">
        <Button onClick={() => { setEditingProducer(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </PageHeader>

      <div className="flex gap-2 items-center flex-wrap mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="flex-1 min-w-[150px]" />
        <Select value={settlementFilter} onValueChange={setSettlementFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Assentamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {settlements.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <DataTable 
        data={filtered} 
        columns={columns} 
        keyExtractor={(p) => p.id} 
        emptyMessage="Nenhum produtor encontrado" 
      />

      <ProducerDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        producer={mapProducerForDisplay(selectedProducer)}
        settlement={selectedSettlement ? { id: selectedSettlement.id, name: selectedSettlement.name, createdAt: new Date() } : undefined}
        location={selectedLocation ? { id: selectedLocation.id, name: selectedLocation.name, settlementId: selectedLocation.settlement_id, createdAt: new Date() } : undefined}
        demandTypes={mappedDemandTypes}
        onEdit={openEditForm}
        onDelete={openDeleteDialog}
      />

      <ProducerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        producer={mapProducerForDisplay(editingProducer)}
        settlements={mappedSettlements}
        locations={mappedLocations}
        demandTypes={mappedDemandTypes}
        onSubmit={editingProducer ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Produtor"
        description={`Tem certeza que deseja excluir "${producerToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
