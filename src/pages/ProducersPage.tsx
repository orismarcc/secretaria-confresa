import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ProducerForm } from '@/components/forms/ProducerForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Producer } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProducersPage() {
  const { producers, settlements, locations, demandTypes, createProducer, updateProducer, deleteProducer } = useData();
  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<Producer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [producerToDelete, setProducerToDelete] = useState<Producer | null>(null);

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

  const columns = [
    { key: 'name', header: 'Nome' },
    { key: 'cpf', header: 'CPF' },
    { key: 'phone', header: 'Telefone' },
    { key: 'settlement', header: 'Assentamento', render: (p: Producer) => settlements.find(s => s.id === p.settlementId)?.name || 'N/A' },
    { key: 'location', header: 'Localidade', render: (p: Producer) => locations.find(l => l.id === p.locationId)?.name || 'N/A' },
    { 
      key: 'actions', 
      header: 'Ações', 
      render: (p: Producer) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditForm(p)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(p)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <AppLayout>
      <PageHeader title="Produtores" description="Gerenciar produtores">
        <div className="flex gap-2 items-center flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou CPF..." className="max-w-sm" />
          <Select value={settlementFilter} onValueChange={setSettlementFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por assentamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os assentamentos</SelectItem>
              {settlements.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingProducer(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </PageHeader>
      
      <DataTable 
        data={filtered} 
        columns={columns} 
        keyExtractor={(p) => p.id} 
        emptyMessage="Nenhum produtor encontrado" 
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
