import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { textIncludes } from '@/lib/text';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Wrench, Droplet, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMachinery,
  useCreateMachinery,
  useUpdateMachinery,
  useDeleteMachinery,
  useOperatorMachineryMap,
  useMachineryRefuelTotals,
} from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import { MachineryRefuelDialog, FUEL_TYPES } from '@/components/MachineryRefuelDialog';
import { useAuth } from '@/contexts/AuthContext';

interface MachineryItem {
  id: string;
  name: string;
  patrimony_number: string;
  chassis: string | null;
  fuel_type: string | null;
  is_active: boolean;
  created_at: string | null;
}

const NO_FUEL = '__none__';

export default function MachineryPage() {
  const { isAssistente } = useAuth();
  // Assistente de Campo: só vê e ABASTECE — não cria/edita/exclui maquinário.
  const canManage = !isAssistente;
  const { data: machinery = [], isLoading } = useMachinery();
  const createMachinery = useCreateMachinery();
  const updateMachinery = useUpdateMachinery();
  const deleteMachinery = useDeleteMachinery();
  const { data: operators = [] } = useOperators();
  const { data: opMachineryMap = {} } = useOperatorMachineryMap();
  const { data: refuelTotals = {} } = useMachineryRefuelTotals();

  // Mapa maquinário → nomes de operadores (a partir do vínculo em Operadores).
  const machineryOperators = (() => {
    const nameById = new Map<string, string>((operators as any[]).map((o) => [o.id, o.name]));
    const map: Record<string, string[]> = {};
    Object.entries(opMachineryMap as Record<string, string[]>).forEach(([opId, machIds]) => {
      const opName = nameById.get(opId);
      if (!opName) return;
      (machIds || []).forEach((mid) => { (map[mid] = map[mid] || []).push(opName); });
    });
    return map;
  })();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MachineryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MachineryItem | null>(null);
  const [refuelMachine, setRefuelMachine] = useState<MachineryItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPatrimony, setFormPatrimony] = useState('');
  const [formChassis, setFormChassis] = useState('');
  const [formFuel, setFormFuel] = useState('');

  const filtered = machinery.filter((m: MachineryItem) =>
    textIncludes(m.name, search) ||
    textIncludes(m.patrimony_number, search)
  );

  const openCreateForm = () => {
    setEditing(null);
    setFormName('');
    setFormPatrimony('');
    setFormChassis('');
    setFormFuel('');
    setFormOpen(true);
  };

  const openEditForm = (item: MachineryItem) => {
    setEditing(item);
    setFormName(item.name);
    setFormPatrimony(item.patrimony_number);
    setFormChassis(item.chassis || '');
    setFormFuel(item.fuel_type || '');
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMachinery.mutate({
        id: editing.id,
        name: formName,
        patrimony_number: formPatrimony,
        chassis: formChassis || null,
        fuel_type: formFuel || null,
      });
    } else {
      createMachinery.mutate({
        name: formName,
        patrimony_number: formPatrimony,
        chassis: formChassis || null,
        fuel_type: formFuel || null,
      });
    }
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (toDelete) {
      deleteMachinery.mutate(toDelete.id);
      setToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleActive = (item: MachineryItem) => {
    updateMachinery.mutate({ id: item.id, is_active: !item.is_active });
  };

  const columns = [
    {
      key: 'name',
      header: 'Maquinário',
      render: (m: MachineryItem) => (
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{m.name}</span>
        </div>
      ),
    },
    {
      key: 'patrimony',
      header: 'Nº Patrimônio',
      className: 'hidden sm:table-cell',
      render: (m: MachineryItem) => m.patrimony_number,
    },
    {
      key: 'chassis',
      header: 'Chassi',
      className: 'hidden lg:table-cell',
      render: (m: MachineryItem) => m.chassis || '—',
    },
    {
      key: 'operator',
      header: 'Operador',
      render: (m: MachineryItem) => {
        const ops = machineryOperators[m.id] || [];
        return ops.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <User className="h-3.5 w-3.5 text-violet-600 shrink-0" />
            <span className="truncate max-w-[160px]">{ops.join(', ')}</span>
          </span>
        ) : <span className="text-muted-foreground text-sm">—</span>;
      },
    },
    {
      key: 'fuel',
      header: 'Combustível',
      className: 'hidden sm:table-cell',
      render: (m: MachineryItem) => {
        const total = Number((refuelTotals as Record<string, number>)[m.id] || 0);
        return (
          <div className="text-sm">
            <span>{m.fuel_type || '—'}</span>
            {total > 0 && (
              <span className="block text-xs text-blue-600 font-medium">
                {total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (m: MachineryItem) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={m.is_active}
            onCheckedChange={() => handleToggleActive(m)}
            disabled={!canManage}
          />
          <Badge variant="outline" className={`hidden sm:inline-flex ${m.is_active ? 'status-completed' : ''}`}>
            {m.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (m: MachineryItem) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setRefuelMachine(m)} title="Abastecimento">
            <Droplet className="h-4 w-4 text-blue-500" />
          </Button>
          {canManage && (
            <>
              <Button variant="ghost" size="icon" onClick={() => openEditForm(m)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setToDelete(m); setDeleteDialogOpen(true); }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Maquinários" description="Gerenciar maquinários" />
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
        title="Maquinários"
        description="Gerenciar maquinários para os serviços"
        action={canManage ? { label: 'Novo', onClick: openCreateForm, icon: <Plus className="h-4 w-4 mr-2" /> } : undefined}
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar maquinário..." className="max-w-md" />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(m) => m.id}
        emptyMessage="Nenhum maquinário cadastrado"
      />

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Maquinário' : 'Novo Maquinário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Maquinário *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Trator MF 275"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patrimony">Nº do Patrimônio *</Label>
              <Input
                id="patrimony"
                value={formPatrimony}
                onChange={(e) => setFormPatrimony(e.target.value)}
                placeholder="Ex: PAT-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chassis">Chassi (opcional)</Label>
              <Input
                id="chassis"
                value={formChassis}
                onChange={(e) => setFormChassis(e.target.value)}
                placeholder="Ex: 9BWHE21JX24060811"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de combustível (opcional)</Label>
              <Select
                value={formFuel || NO_FUEL}
                onValueChange={(v) => setFormFuel(v === NO_FUEL ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o combustível" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FUEL}>—</SelectItem>
                  {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Maquinário"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />

      <MachineryRefuelDialog
        open={!!refuelMachine}
        onOpenChange={(o) => { if (!o) setRefuelMachine(null); }}
        machineryId={refuelMachine?.id ?? null}
        machineryName={refuelMachine?.name}
        defaultFuelType={refuelMachine?.fuel_type}
      />
    </AppLayout>
  );
}
