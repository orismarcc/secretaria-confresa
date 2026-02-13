import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useLocations,
  useSettlements,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation
} from '@/hooks/useSupabaseData';

interface Location {
  id: string;
  name: string;
  settlement_id: string;
  settlements?: { name: string } | null;
}

export default function LocationsPage() {
  const { data: locations = [], isLoading: locationsLoading } = useLocations();
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();
  
  const [search, setSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const filtered = locations.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchesSettlement = settlementFilter === 'all' || l.settlement_id === settlementFilter;
    return matchesSearch && matchesSettlement;
  });

  const handleCreate = (data: { name: string; settlementId: string }) => {
    createLocation.mutate({ name: data.name, settlement_id: data.settlementId });
    setFormOpen(false);
  };

  const handleEdit = (data: { name: string; settlementId: string }) => {
    if (editingLocation) {
      updateLocation.mutate({ id: editingLocation.id, name: data.name, settlement_id: data.settlementId });
      setEditingLocation(null);
      setFormOpen(false);
    }
  };

  const handleDelete = () => {
    if (locationToDelete) {
      deleteLocation.mutate(locationToDelete.id);
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

  // Map location for form compatibility
  const mapLocationForForm = (loc: Location | null) => {
    if (!loc) return null;
    return {
      id: loc.id,
      name: loc.name,
      settlementId: loc.settlement_id,
      createdAt: new Date()
    };
  };

  // Map settlements for form compatibility
  const mappedSettlements = settlements.map(s => ({
    id: s.id,
    name: s.name,
    createdAt: new Date(s.created_at || Date.now())
  }));

  const columns = [
    { key: 'name', header: 'Localidade', render: (l: Location) => <span className="font-medium">{l.name}</span> },
    { 
      key: 'settlement', 
      header: 'Assentamento', 
      render: (l: Location) => l.settlements?.name || settlements.find(s => s.id === l.settlement_id)?.name || 'N/A' 
    },
    { 
      key: 'actions', 
      header: '', 
      render: (l: Location) => (
        <div className="flex gap-1">
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

  const isLoading = locationsLoading || settlementsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Localidades" description="Gerenciar localidades" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Localidades" description="Gerenciar localidades">
        <Button onClick={() => { setEditingLocation(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova
        </Button>
      </PageHeader>

      <div className="flex gap-2 items-center flex-wrap mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar localidade..." className="flex-1 min-w-[150px]" />
        <Select value={settlementFilter} onValueChange={setSettlementFilter}>
          <SelectTrigger className="w-[140px] sm:w-[180px]">
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
        keyExtractor={(l) => l.id} 
        emptyMessage="Nenhuma localidade cadastrada" 
      />

      <LocationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        location={mapLocationForForm(editingLocation)}
        settlements={mappedSettlements}
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
