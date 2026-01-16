import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { SettlementForm } from '@/components/forms/SettlementForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Settlement } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SettlementsPage() {
  const { settlements, createSettlement, updateSettlement, deleteSettlement } = useData();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settlementToDelete, setSettlementToDelete] = useState<Settlement | null>(null);

  const filtered = settlements.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (data: { name: string }) => {
    createSettlement(data.name);
    toast.success('Assentamento cadastrado com sucesso!');
  };

  const handleEdit = (data: { name: string }) => {
    if (editingSettlement) {
      updateSettlement(editingSettlement.id, { name: data.name });
      toast.success('Assentamento atualizado com sucesso!');
      setEditingSettlement(null);
    }
  };

  const handleDelete = () => {
    if (settlementToDelete) {
      deleteSettlement(settlementToDelete.id);
      toast.success('Assentamento excluído com sucesso!');
      setSettlementToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openEditForm = (settlement: Settlement) => {
    setEditingSettlement(settlement);
    setFormOpen(true);
  };

  const openDeleteDialog = (settlement: Settlement) => {
    setSettlementToDelete(settlement);
    setDeleteDialogOpen(true);
  };

  const columns = [
    { key: 'name', header: 'Nome do Assentamento' },
    { 
      key: 'actions', 
      header: 'Ações', 
      render: (s: Settlement) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditForm(s)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(s)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <AppLayout>
      <PageHeader title="Assentamentos" description="Gerenciar assentamentos">
        <div className="flex gap-2 items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar assentamento..." className="max-w-sm" />
          <Button onClick={() => { setEditingSettlement(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </PageHeader>
      
      <DataTable 
        data={filtered} 
        columns={columns} 
        keyExtractor={(s) => s.id} 
        emptyMessage="Nenhum assentamento cadastrado" 
      />

      <SettlementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        settlement={editingSettlement}
        onSubmit={editingSettlement ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Assentamento"
        description={`Tem certeza que deseja excluir "${settlementToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
