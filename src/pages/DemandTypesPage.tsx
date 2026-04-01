import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DemandTypeForm, DEMAND_CATEGORIES } from '@/components/forms/DemandTypeForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Tractor, Package, Layers } from 'lucide-react';
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
  category?: string | null;
  created_at?: string | null;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  patrulha_mecanizada: { label: 'Patrulha Mecanizada', icon: Tractor, color: 'text-amber-600' },
  entregas: { label: 'Entregas', icon: Package, color: 'text-blue-600' },
  calcario: { label: 'Logística do Calcário', icon: Layers, color: 'text-stone-600' },
};

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

  const filtered = (demandTypes as DemandType[]).filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped: Record<string, DemandType[]> = {};
  const uncategorized: DemandType[] = [];

  filtered.forEach(d => {
    if (d.category) {
      if (!grouped[d.category]) grouped[d.category] = [];
      grouped[d.category].push(d);
    } else {
      uncategorized.push(d);
    }
  });

  const handleCreate = (data: { name: string; description?: string; category?: string | null; isActive: boolean }) => {
    createDemandType.mutate({ name: data.name, description: data.description, category: data.category ?? null });
    setFormOpen(false);
  };

  const handleEdit = (data: { name: string; description?: string; category?: string | null; isActive: boolean }) => {
    if (editingType) {
      updateDemandType.mutate({
        id: editingType.id,
        name: data.name,
        description: data.description,
        category: data.category ?? null,
        is_active: data.isActive,
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

  const mapForForm = (dt: DemandType | null) => {
    if (!dt) return null;
    return {
      id: dt.id,
      name: dt.name,
      description: dt.description || undefined,
      category: dt.category || null,
      isActive: dt.is_active ?? true,
      createdAt: new Date(dt.created_at || Date.now()),
    };
  };

  const DemandRow = ({ d }: { d: DemandType }) => (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-medium truncate">{d.name}</span>
        {d.description && (
          <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[200px]">{d.description}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={d.is_active ?? true}
          onCheckedChange={() => handleToggleStatus(d)}
        />
        <Badge variant="outline" className={d.is_active ? 'status-completed' : ''}>
          {d.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
        <Button variant="ghost" size="icon" onClick={() => openEditForm(d)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openDeleteDialog(d)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const CategorySection = ({ categoryKey, items }: { categoryKey: string; items: DemandType[] }) => {
    const meta = CATEGORY_META[categoryKey];
    const Icon = meta?.icon;
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
          {Icon && <Icon className={`h-4 w-4 ${meta.color}`} />}
          <span className={`font-semibold text-sm ${meta?.color || ''}`}>
            {meta?.label || categoryKey}
          </span>
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </div>
        <div className="divide-y">
          {items.map(d => <DemandRow key={d.id} d={d} />)}
        </div>
      </div>
    );
  };

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

  const categoryOrder = ['patrulha_mecanizada', 'entregas', 'calcario'];

  return (
    <AppLayout>
      <PageHeader
        title="Tipos de Demanda"
        description="Categorias de atendimento"
        action={{
          label: 'Novo',
          onClick: () => { setEditingType(null); setFormOpen(true); },
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar tipo..." className="max-w-sm" />
      </div>

      <div className="space-y-4">
        {/* Categorized sections */}
        {categoryOrder.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return <CategorySection key={cat} categoryKey={cat} items={items} />;
        })}

        {/* Any extra categories not in the preset order */}
        {Object.keys(grouped)
          .filter(k => !categoryOrder.includes(k))
          .map(cat => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return <CategorySection key={cat} categoryKey={cat} items={items} />;
          })}

        {/* Uncategorized */}
        {uncategorized.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
              <span className="font-semibold text-sm text-muted-foreground">Outros</span>
              <Badge variant="secondary" className="ml-auto">{uncategorized.length}</Badge>
            </div>
            <div className="divide-y">
              {uncategorized.map(d => <DemandRow key={d.id} d={d} />)}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Nenhum tipo encontrado</p>
        )}
      </div>

      <DemandTypeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        demandType={mapForForm(editingType) as any}
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
