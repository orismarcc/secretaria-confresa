import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
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
import { Producer } from '@/types';
import { Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function ProducersPage() {
  const { producers, settlements, locations, demandTypes, createProducer, updateProducer, deleteProducer } = useData();
  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<Producer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [producerToDelete, setProducerToDelete] = useState<Producer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState<Producer | null>(null);

  const filtered = producers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search);
    const matchesSettlement = settlementFilter === 'all' || p.settlementId === settlementFilter;
    return matchesSearch && matchesSettlement;
  });

  const handleCreate = (data: Omit<Producer, 'id' | 'createdAt'>) => {
    createProducer(data);
    toast.success('Produtor cadastrado com sucesso!');
  };

  const handleEdit = (data: Omit<Producer, 'id' | 'createdAt'>) => {
    if (editingProducer) {
      updateProducer(editingProducer.id, data);
      toast.success('Produtor atualizado com sucesso!');
      setEditingProducer(null);
    }
  };

  const handleDelete = () => {
    if (producerToDelete) {
      deleteProducer(producerToDelete.id);
      toast.success('Produtor excluído com sucesso!');
      setProducerToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openEditForm = (producer: Producer) => {
    setEditingProducer(producer);
    setFormOpen(true);
  };

  const openDeleteDialog = (producer: Producer) => {
    setProducerToDelete(producer);
    setDeleteDialogOpen(true);
  };

  const openDetail = (producer: Producer) => {
    setSelectedProducer(producer);
    setDetailOpen(true);
  };

  // Colunas simplificadas para mobile: Nome, Assentamento e botão Ver Informações
  const columns = [
    { key: 'name', header: 'Nome', render: (p: Producer) => <span className="font-medium">{p.name}</span> },
    { key: 'settlement', header: 'Assentamento', render: (p: Producer) => settlements.find(s => s.id === p.settlementId)?.name || 'N/A' },
    { 
      key: 'actions', 
      header: '', 
      render: (p: Producer) => (
        <Button variant="ghost" size="sm" onClick={() => openDetail(p)} className="gap-1">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Ver</span>
        </Button>
      )
    },
  ];

  const selectedSettlement = selectedProducer ? settlements.find(s => s.id === selectedProducer.settlementId) : undefined;
  const selectedLocation = selectedProducer ? locations.find(l => l.id === selectedProducer.locationId) : undefined;

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
        producer={selectedProducer}
        settlement={selectedSettlement}
        location={selectedLocation}
        demandTypes={demandTypes}
        onEdit={openEditForm}
        onDelete={openDeleteDialog}
      />

      <ProducerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        producer={editingProducer}
        settlements={settlements}
        locations={locations}
        demandTypes={demandTypes}
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
