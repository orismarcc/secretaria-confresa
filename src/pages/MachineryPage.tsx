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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Wrench, Droplet, User, FileText, Car } from 'lucide-react';
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
import { CustoMaquinasPanel } from '@/components/CustoMaquinasPanel';
import { FleetDocsDialog } from '@/components/FleetDocsDialog';
import { FleetAlerts } from '@/components/FleetAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VINCULOS, vinculoLabel, vinculoOrigemLabel, vinculoBadgeClass, type Vinculo } from '@/lib/vinculo';
import { statusVencimento, vencClasses, vencLabel } from '@/lib/vencimento';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MachineryItem {
  id: string;
  name: string;
  patrimony_number: string;
  chassis: string | null;
  fuel_type: string | null;
  kind: string | null;
  vinculo?: string | null;
  vinculo_origem?: string | null;
  vinculo_inicio?: string | null;
  vinculo_fim?: string | null;
  is_active: boolean;
  created_at: string | null;
}

const NO_FUEL = '__none__';

export default function MachineryPage() {
  const { isAssistente } = useAuth();
  const { toast } = useToast();
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
  const [tab, setTab] = useState<'maquinario' | 'veiculo'>('maquinario');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MachineryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MachineryItem | null>(null);
  const [refuelMachine, setRefuelMachine] = useState<MachineryItem | null>(null);
  const [docsMachine, setDocsMachine] = useState<MachineryItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPatrimony, setFormPatrimony] = useState('');
  const [formChassis, setFormChassis] = useState('');
  const [formFuel, setFormFuel] = useState('');
  const [formKind, setFormKind] = useState<'maquinario' | 'veiculo'>('maquinario');
  const [formVinculo, setFormVinculo] = useState<Vinculo>('proprio');
  const [formVinculoOrigem, setFormVinculoOrigem] = useState('');
  const [formVinculoInicio, setFormVinculoInicio] = useState('');
  const [formVinculoFim, setFormVinculoFim] = useState('');
  const isProprio = formVinculo === 'proprio';

  const kindOf = (m: MachineryItem) => (m.kind === 'veiculo' ? 'veiculo' : 'maquinario');
  const maquinarios = machinery.filter((m: MachineryItem) => kindOf(m) === 'maquinario');
  const veiculos = machinery.filter((m: MachineryItem) => kindOf(m) === 'veiculo');
  const isVeiculoTab = tab === 'veiculo';
  const singular = isVeiculoTab ? 'Veículo' : 'Maquinário';

  const filtered = (isVeiculoTab ? veiculos : maquinarios).filter((m: MachineryItem) =>
    textIncludes(m.name, search) ||
    textIncludes(m.patrimony_number, search)
  );

  const openCreateForm = () => {
    setEditing(null);
    setFormName('');
    setFormPatrimony('');
    setFormChassis('');
    setFormFuel('');
    setFormKind(isVeiculoTab ? 'veiculo' : 'maquinario'); // novo item herda a aba atual
    setFormVinculo('proprio');
    setFormVinculoOrigem('');
    setFormVinculoInicio('');
    setFormVinculoFim('');
    setFormOpen(true);
  };

  const openEditForm = (item: MachineryItem) => {
    setEditing(item);
    setFormName(item.name);
    setFormPatrimony(item.patrimony_number);
    setFormChassis(item.chassis || '');
    setFormFuel(item.fuel_type || '');
    setFormKind(kindOf(item));
    setFormVinculo(((item.vinculo as Vinculo) || 'proprio'));
    setFormVinculoOrigem(item.vinculo_origem || '');
    setFormVinculoInicio((item.vinculo_inicio || '').slice(0, 10));
    setFormVinculoFim((item.vinculo_fim || '').slice(0, 10));
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Não próprio (cedido/locado/consórcio): data de admissão obrigatória;
    // término/validade opcional (vazio = prazo indeterminado).
    if (!isProprio && !formVinculoInicio) {
      toast({ title: 'Informe a data de admissão', description: 'Obrigatória para itens cedidos, locados ou de consórcio.', variant: 'destructive' });
      return;
    }
    if (!isProprio && formVinculoFim && formVinculoFim < formVinculoInicio) {
      toast({ title: 'Datas inválidas', description: 'O término não pode ser antes da admissão.', variant: 'destructive' });
      return;
    }
    // Próprio: limpa os dados de vínculo (evita datas "órfãs" se o tipo mudou).
    const vinculoFields = {
      vinculo: formVinculo,
      vinculo_origem: isProprio ? null : (formVinculoOrigem.trim() || null),
      vinculo_inicio: isProprio ? null : (formVinculoInicio || null),
      vinculo_fim: isProprio ? null : (formVinculoFim || null),
    };
    if (editing) {
      updateMachinery.mutate({
        id: editing.id,
        name: formName,
        patrimony_number: formPatrimony,
        chassis: formChassis || null,
        fuel_type: formFuel || null,
        kind: formKind,
        ...vinculoFields,
      });
    } else {
      createMachinery.mutate({
        name: formName,
        patrimony_number: formPatrimony,
        chassis: formChassis || null,
        fuel_type: formFuel || null,
        kind: formKind,
        ...vinculoFields,
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
      header: singular,
      render: (m: MachineryItem) => (
        <div className="flex items-center gap-2">
          {kindOf(m) === 'veiculo'
            ? <Car className="h-4 w-4 text-muted-foreground" />
            : <Wrench className="h-4 w-4 text-muted-foreground" />}
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
      key: 'vinculo',
      header: 'Vínculo',
      className: 'hidden lg:table-cell',
      render: (m: MachineryItem) => {
        const fim = m.vinculo && m.vinculo !== 'proprio' ? m.vinculo_fim : null;
        const st = fim ? statusVencimento(fim) : null;
        return (
          <div className="space-y-1">
            <Badge variant="outline" className={cn('text-xs', vinculoBadgeClass(m.vinculo))}>{vinculoLabel(m.vinculo)}</Badge>
            {m.vinculo && m.vinculo !== 'proprio' && m.vinculo_origem && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{m.vinculo_origem}</p>
            )}
            {fim && st && (
              <span className={cn('block w-fit text-[11px] font-medium rounded-full px-2 py-0.5', vencClasses(st.status))}>
                até {format(new Date(fim.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')} — {vencLabel(fim)}
              </span>
            )}
          </div>
        );
      },
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
          <Button variant="ghost" size="icon" onClick={() => setDocsMachine(m)} title="Documentação">
            <FileText className="h-4 w-4 text-primary" />
          </Button>
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
        <PageHeader title="Frotas" description="Maquinários, veículos e documentação" />
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
        title="Frotas"
        description="Maquinários, veículos, abastecimento e documentação"
        action={canManage ? { label: `Novo ${singular}`, onClick: openCreateForm, icon: <Plus className="h-4 w-4 mr-2" /> } : undefined}
      />

      {/* Alertas de vencimento (documentos + CNH) */}
      <div className="mb-4">
        <FleetAlerts />
      </div>

      {/* Custo por hora-máquina (seção própria, recolhida por padrão) */}
      <div className="mb-4">
        <CustoMaquinasPanel />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'maquinario' | 'veiculo')} className="mb-4">
        <TabsList>
          <TabsTrigger value="maquinario" className="gap-2">
            <Wrench className="h-4 w-4" /> Maquinários
            <span className="bg-muted px-1.5 py-0.5 rounded-full text-xs">{maquinarios.length}</span>
          </TabsTrigger>
          <TabsTrigger value="veiculo" className="gap-2">
            <Car className="h-4 w-4" /> Veículos
            <span className="bg-muted px-1.5 py-0.5 rounded-full text-xs">{veiculos.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`Buscar ${singular.toLowerCase()}...`} className="max-w-md" />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(m) => m.id}
        emptyMessage={`Nenhum ${singular.toLowerCase()} cadastrado`}
      />

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${singular}` : `Novo ${singular}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formKind} onValueChange={(v) => setFormKind(v as 'maquinario' | 'veiculo')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maquinario">Maquinário</SelectItem>
                  <SelectItem value="veiculo">Veículo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome do {singular} *</Label>
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
              <Label>Vínculo</Label>
              <Select value={formVinculo} onValueChange={(v) => setFormVinculo(v as Vinculo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VINCULOS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!isProprio && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-2">
                  <Label htmlFor="vinculo-origem">{vinculoOrigemLabel(formVinculo)} (opcional)</Label>
                  <Input
                    id="vinculo-origem"
                    value={formVinculoOrigem}
                    onChange={(e) => setFormVinculoOrigem(e.target.value)}
                    placeholder="De quem é o item"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="vinculo-inicio">Data de admissão *</Label>
                    <Input id="vinculo-inicio" type="date" value={formVinculoInicio} onChange={(e) => setFormVinculoInicio(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vinculo-fim">Término / validade</Label>
                    <Input id="vinculo-fim" type="date" value={formVinculoFim} min={formVinculoInicio || undefined} onChange={(e) => setFormVinculoFim(e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Deixe o término vazio se o prazo for indeterminado.</p>
              </div>
            )}
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
        title={`Excluir ${singular}`}
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

      <FleetDocsDialog
        open={!!docsMachine}
        onOpenChange={(o) => { if (!o) setDocsMachine(null); }}
        machineryId={docsMachine?.id ?? null}
        machineryName={docsMachine?.name}
      />
    </AppLayout>
  );
}
