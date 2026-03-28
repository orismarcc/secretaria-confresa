import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DemandTypeForm } from '@/components/forms/DemandTypeForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDemandTypes,
  useCreateDemandType,
  useUpdateDemandType,
  useDeleteDemandType
} from '@/hooks/useSupabaseData';

interface DemandType {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

export default function DemandTypesPage() {
  const { data: demandTypes = [], isLoading } = useDemandTypes();
  const createDemandType = useCreateDemandType();
  const updateDemandType = useUpdateDemandType();
  const deleteDemandType = useDeleteDemandType();
  
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<DemandType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<DemandType | null>(null);

  const filtered = demandTypes.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (data: { name: string; description?: string; isActive: boolean }) => {
    createDemandType.mutate({ name: data.name, description: data.description });
    setFormOpen(false);
  };

  const handleEdit = (data: { name: string; description?: string; isActive: boolean }) => {
    if (editingType) {
      updateDemandType.mutate({ 
        id: editingType.id, 
        name: data.name, 
        description: data.description,
        is_active: data.isActive 
      });
      setEditingType(null);
      setFormOpen(false);
    }
  };

  const handleDelete = () => {
    if (typeToDelete) {
      deleteDemandType.mutate(typeToDelete.id);
      setTypeToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleStatus = (demandType: DemandType) => {
    updateDemandType.mutate({ id: demandType.id, is_active: !demandType.is_active });
  };

  const openEditForm = (type: DemandType) => {
    setEditingType(type);
    setFormOpen(true);
  };

  const openDeleteDialog = (type: DemandType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  // Map demand type for form compatibility
  const mapDemandTypeForForm = (dt: DemandType | null) => {
    if (!dt) return null;
    return {
      id: dt.id,
      name: dt.name,
      description: dt.description || undefined,
      isActive: dt.is_active ?? true,
      createdAt: new Date(dt.created_at || Date.now())
    };
  };

  const columns = [
    { key: 'name', header: 'Nome', render: (d: DemandType) => <span className="font-medium">{d.name}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (d: DemandType) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={d.is_active ?? true}
            onCheckedChange={() => handleToggleStatus(d)}
          />
          <Badge variant="outline" className={d.is_active ? 'status-completed' : ''}>
            {d.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
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

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Tipos de Demanda" description="Categorias de atendimento" />
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
        title="Tipos de Demanda"
        description="Categorias de atendimento"
        action={{ label: 'Novo', onClick: () => { setEditingType(null); setFormOpen(true); }, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar tipo..." className="max-w-sm" />
      </div>

      <DataTable 
        data={filtered} 
        columns={columns} 
        keyExtractor={(d) => d.id} 
        emptyMessage="Nenhum tipo cadastrado" 
      />

      <DemandTypeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        demandType={mapDemandTypeForForm(editingType)}
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
