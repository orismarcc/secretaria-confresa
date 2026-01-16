import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { LocationForm } from '@/components/forms/LocationForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Location } from '@/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LocationsPage() {
  const { locations, settlements, createLocation, updateLocation, deleteLocation } = useData();
  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const filtered = locations.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchesSettlement = settlementFilter === 'all' || l.settlementId === settlementFilter;
    return matchesSearch && matchesSettlement;
  });

  const handleCreate = (data: { name: string; settlementId: string }) => {
    createLocation(data.name, data.settlementId);
    toast.success('Localidade cadastrada com sucesso!');
  };

  const handleEdit = (data: { name: string; settlementId: string }) => {
    if (editingLocation) {
      updateLocation(editingLocation.id, data);
      toast.success('Localidade atualizada com sucesso!');
      setEditingLocation(null);
    }
  };

  const handleDelete = () => {
    if (locationToDelete) {
      deleteLocation(locationToDelete.id);
      toast.success('Localidade excluída com sucesso!');
      setLocationToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openEditForm = (location: Location) => {
    setEditingLocation(location);
    setFormOpen(true);
  };

  const openDeleteDialog = (location: Location) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const columns = [
    { key: 'name', header: 'Localidade' },
    { 
      key: 'settlement', 
      header: 'Assentamento', 
      render: (l: Location) => settlements.find(s => s.id === l.settlementId)?.name || 'N/A' 
    },
    { 
      key: 'actions', 
      header: 'Ações', 
      render: (l: Location) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditForm(l)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(l)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <AppLayout>
      <PageHeader title="Localidades" description="Gerenciar localidades">
        <div className="flex gap-2 items-center flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar localidade..." className="max-w-sm" />
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
          <Button onClick={() => { setEditingLocation(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova
          </Button>
        </div>
      </PageHeader>
      
      <DataTable 
        data={filtered} 
        columns={columns} 
        keyExtractor={(l) => l.id} 
        emptyMessage="Nenhuma localidade cadastrada" 
      />

      <LocationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        location={editingLocation}
        settlements={settlements}
        onSubmit={editingLocation ? handleEdit : handleCreate}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Localidade"
        description={`Tem certeza que deseja excluir "${locationToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
