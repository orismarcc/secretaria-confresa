import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Eye, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProducers,
  useSettlements,
  useLocations,
  useDemandTypes,
  useCreateProducer,
  useUpdateProducer,
  useDeleteProducer,
  useDeleteProducers,
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
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
  producer_demands?: { demand_type_id: string }[] | null;
}

export default function ProducersPage() {
  const { data: producers = [], isLoading: producersLoading } = useProducers();
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();
  const { data: demandTypes = [] } = useDemandTypes();
  const createProducer = useCreateProducer();
  const updateProducer = useUpdateProducer();
  const deleteProducer = useDeleteProducer();
  const deleteProducers = useDeleteProducers();

  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<DbProducer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [producerToDelete, setProducerToDelete] = useState<DbProducer | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState<DbProducer | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = producers.filter((p: DbProducer) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search);
    const matchesSettlement = settlementFilter === 'all' || p.settlement_id === settlementFilter;
    return matchesSearch && matchesSettlement;
  });

  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  const someSelected = filtered.some(p => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = (data: any) => {
    createProducer.mutate({
      name: data.name,
      cpf: data.cpf,
      phone: data.phone,
      settlement_id: data.settlementId,
      location_name: data.locationName,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
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
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
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

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    deleteProducers.mutate(ids, {
      onSuccess: () => {
        setSelectedIds(new Set());
        setBulkDeleteDialogOpen(false);
      },
    });
  };

  const openEditForm = (producer: any) => {
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

  const mapProducerForDisplay = (p: DbProducer | null) => {
    if (!p) return null;
    const demandTypeIds = p.producer_demands?.map(d => d.demand_type_id) || [];
    return {
      id: p.id,
      name: p.name,
      cpf: p.cpf,
      phone: p.phone || '',
      settlementId: p.settlement_id || '',
      locationId: p.location_id || '',
      locationName: p.location_name || '',
      demandTypeIds,
      latitude: p.latitude,
      longitude: p.longitude,
      createdAt: new Date(p.created_at || Date.now())
    };
  };

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
      <PageHeader
        title="Produtores"
        description="Gerenciar produtores"
        action={{ label: 'Novo', onClick: () => { setEditingProducer(null); setFormOpen(true); }, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

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
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Excluir {selectedIds.size} selecionado(s)
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-3 py-3 text-left">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                  className={someSelected && !allSelected ? 'data-[state=unchecked]:bg-muted' : ''}
                />
              </th>
              <th className="px-3 py-3 text-left font-medium">Nome</th>
              <th className="px-3 py-3 text-left font-medium hidden sm:table-cell">Assentamento</th>
              <th className="w-16 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum produtor encontrado
                </td>
              </tr>
            ) : (
              filtered.map((p: DbProducer) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                      aria-label={`Selecionar ${p.name}`}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium">{p.name}</td>
                  <td className="px-3 py-3 hidden sm:table-cell text-muted-foreground">
                    {p.settlements?.name || settlements.find(s => s.id === p.settlement_id)?.name || 'N/A'}
                  </td>
                  <td className="px-3 py-3">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(p)} className="gap-1">
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">Ver</span>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Excluir Produtores"
        description={`Tem certeza que deseja excluir ${selectedIds.size} produtor(es) selecionado(s)? Esta ação não pode ser desfeita.`}
        onConfirm={handleBulkDelete}
        confirmLabel="Excluir todos"
        variant="destructive"
      />
    </AppLayout>
  );
}
