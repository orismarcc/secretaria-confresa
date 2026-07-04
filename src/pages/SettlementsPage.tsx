import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { SettlementForm } from '@/components/forms/SettlementForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Pencil, Trash2, Eye, Tractor, Users2, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useSettlements,
  useCreateSettlement,
  useUpdateSettlement,
  useDeleteSettlement,
  useServices,
  useProducers,
  useDemandTypes,
  useGlebas,
} from '@/hooks/useSupabaseData';
import { getPatrulhaIds, computeSettlementStats } from '@/lib/analyticsUtils';
import { textIncludes } from '@/lib/text';
import { GlebasManagerDialog } from '@/components/GlebasManagerDialog';

interface Settlement {
  id: string;
  name: string;
  created_at?: string | null;
}

export default function SettlementsPage() {
  const { data: settlements = [], isLoading } = useSettlements();
  const { data: services = [] } = useServices();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: glebas = [] } = useGlebas();

  const createSettlement = useCreateSettlement();
  const updateSettlement = useUpdateSettlement();
  const deleteSettlement = useDeleteSettlement();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settlementToDelete, setSettlementToDelete] = useState<Settlement | null>(null);

  // Mobile detail sheet
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);

  // Glebas
  const [glebasSettlement, setGlebasSettlement] = useState<Settlement | null>(null);
  const glebasCount = useMemo(() => {
    const map: Record<string, number> = {};
    (glebas as any[]).forEach((g) => { map[g.settlement_id] = (map[g.settlement_id] || 0) + 1; });
    return map;
  }, [glebas]);

  // ── Computed stats ──────────────────────────────────────────────────────────

  // M-03: use shared helpers from analyticsUtils
  const patrulhaIds = useMemo(() => getPatrulhaIds(demandTypes as any[]), [demandTypes]);
  const settlementStats = useMemo(
    () => computeSettlementStats(services as any[], producers as any[], patrulhaIds),
    [services, producers, patrulhaIds],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const filtered = settlements.filter(s =>
    textIncludes(s.name, search)
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

  // ── Table columns ────────────────────────────────────────────────────────────

  const columns = [
    { key: 'name', header: 'Nome do Assentamento' },

    // PM finalizados — desktop only
    {
      key: 'pm_count',
      header: 'PM Finalizados',
      className: 'hidden sm:table-cell text-center',
      render: (s: Settlement) => {
        const stat = settlementStats[s.id];
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Tractor className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-amber-700">{stat?.pmCount ?? 0}</span>
          </div>
        );
      },
    },

    // Produtores cadastrados — desktop only
    {
      key: 'producers_count',
      header: 'Produtores',
      className: 'hidden sm:table-cell text-center',
      render: (s: Settlement) => {
        const stat = settlementStats[s.id];
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Users2 className="h-4 w-4 text-primary" />
            <span className="font-semibold">{stat?.producersCount ?? 0}</span>
          </div>
        );
      },
    },

    {
      key: 'actions',
      header: '',
      render: (s: Settlement) => (
        <div className="flex gap-1 justify-end">
          {/* Eye icon: mobile only — opens bottom sheet with PM + producers stats */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => { setDetailSettlement(s); setDetailSheetOpen(true); }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Glebas"
            className="relative"
            onClick={() => setGlebasSettlement(s)}
          >
            <Layers className="h-4 w-4" />
            {glebasCount[s.id] > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full h-4 min-w-4 px-0.5 flex items-center justify-center">
                {glebasCount[s.id]}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEditForm(s)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDeleteDialog(s)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

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
      <PageHeader
        title="Assentamentos"
        description="Gerenciar assentamentos"
        action={{
          label: 'Novo',
          onClick: () => { setEditingSettlement(null); setFormOpen(true); },
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar assentamento..."
          className="max-w-sm"
        />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(s) => s.id}
        emptyMessage="Nenhum assentamento cadastrado"
      />

      {/* Settlement Form */}
      <SettlementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        settlement={
          editingSettlement
            ? { ...editingSettlement, createdAt: new Date(editingSettlement.created_at || Date.now()) }
            : null
        }
        onSubmit={editingSettlement ? handleEdit : handleCreate}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Assentamento"
        description={`Tem certeza que deseja excluir "${settlementToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />

      {/* Mobile detail bottom sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-5 text-left">
            <SheetTitle className="text-left">{detailSettlement?.name}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 pb-8">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Tractor className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  PM Finalizados
                </p>
                <p className="text-3xl font-black text-amber-700">
                  {detailSettlement ? (settlementStats[detailSettlement.id]?.pmCount ?? 0) : 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <Users2 className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Produtores
                </p>
                <p className="text-3xl font-black text-primary">
                  {detailSettlement ? (settlementStats[detailSettlement.id]?.producersCount ?? 0) : 0}
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Gerenciar glebas do assentamento */}
      <GlebasManagerDialog
        open={!!glebasSettlement}
        onOpenChange={(open) => !open && setGlebasSettlement(null)}
        settlement={glebasSettlement}
      />
    </AppLayout>
  );
}
