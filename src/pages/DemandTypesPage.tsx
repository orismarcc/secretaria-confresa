import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DemandTypeForm } from '@/components/forms/DemandTypeForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DemandType } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DemandTypesPage() {
  const { demandTypes, createDemandType, updateDemandType, deleteDemandType } = useData();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<DemandType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<DemandType | null>(null);

  const filtered = demandTypes.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (data: { name: string; description?: string; isActive: boolean }) => {
    createDemandType(data.name, data.description);
    toast.success('Tipo de demanda cadastrado com sucesso!');
  };

  const handleEdit = (data: { name: string; description?: string; isActive: boolean }) => {
    if (editingType) {
      updateDemandType(editingType.id, data);
      toast.success('Tipo de demanda atualizado com sucesso!');
      setEditingType(null);
    }
  };

  const handleDelete = () => {
    if (typeToDelete) {
      deleteDemandType(typeToDelete.id);
      toast.success('Tipo de demanda excluído com sucesso!');
      setTypeToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleStatus = (demandType: DemandType) => {
    updateDemandType(demandType.id, { isActive: !demandType.isActive });
    toast.success(demandType.isActive ? 'Tipo desativado' : 'Tipo ativado');
  };

  const openEditForm = (type: DemandType) => {
    setEditingType(type);
    setFormOpen(true);
  };

  const openDeleteDialog = (type: DemandType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  // Colunas simplificadas com switch de status
  const columns = [
    { key: 'name', header: 'Nome', render: (d: DemandType) => <span className="font-medium">{d.name}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (d: DemandType) => (
        <div className="flex items-center gap-2">
          <Switch 
            checked={d.isActive} 
            onCheckedChange={() => handleToggleStatus(d)}
          />
          <span className={`text-sm ${d.isActive ? 'text-success' : 'text-muted-foreground'}`}>
            {d.isActive ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      )
    },
    { 
      key: 'actions', 
      header: '', 
      render: (d: DemandType) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditForm(d)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(d)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <AppLayout>
      <PageHeader title="Tipos de Demanda" description="Categorias de atendimento">
        <div className="flex gap-2 items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar tipo..." className="flex-1 min-w-[150px]" />
          <Button onClick={() => { setEditingType(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </PageHeader>
      
      <DataTable 
        data={filtered} 
        columns={columns} 
        keyExtractor={(d) => d.id} 
        emptyMessage="Nenhum tipo cadastrado" 
      />

      <DemandTypeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        demandType={editingType}
        onSubmit={editingType ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Tipo de Demanda"
        description={`Tem certeza que deseja excluir "${typeToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
