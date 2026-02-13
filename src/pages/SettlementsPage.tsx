import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { SettlementForm } from '@/components/forms/SettlementForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSettlements,
  useCreateSettlement,
  useUpdateSettlement,
  useDeleteSettlement
} from '@/hooks/useSupabaseData';

interface Settlement {
  id: string;
  name: string;
  created_at?: string | null;
}

export default function SettlementsPage() {
  const { data: settlements = [], isLoading } = useSettlements();
  const createSettlement = useCreateSettlement();
  const updateSettlement = useUpdateSettlement();
  const deleteSettlement = useDeleteSettlement();
  
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settlementToDelete, setSettlementToDelete] = useState<Settlement | null>(null);

  const filtered = settlements.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (data: { name: string }) => {
    createSettlement.mutate({ name: data.name });
    setFormOpen(false);
  };

  const handleEdit = (data: { name: string }) => {
    if (editingSettlement) {
      updateSettlement.mutate({ id: editingSettlement.id, name: data.name });
      setEditingSettlement(null);
      setFormOpen(false);
    }
  };

  const handleDelete = () => {
    if (settlementToDelete) {
      deleteSettlement.mutate(settlementToDelete.id);
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

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Assentamentos" description="Gerenciar assentamentos" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Assentamentos" description="Gerenciar assentamentos">
        <div className="flex gap-2 items-center flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar assentamento..." className="flex-1 min-w-[120px]" />
          <Button onClick={() => { setEditingSettlement(null); setFormOpen(true); }} className="shrink-0">
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
        settlement={editingSettlement ? { ...editingSettlement, createdAt: new Date(editingSettlement.created_at || Date.now()) } : null}
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
