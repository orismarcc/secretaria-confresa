import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OperatorForm } from '@/components/forms/OperatorForm';
import {
  useOperators,
  useCreateOperator,
  useDeleteOperator,
  useUpdateOperator,
  useToggleOperatorStatus,
  Operator,
} from '@/hooks/useOperatorData';
import {
  useResponsibleTechnicians,
  useCreateResponsibleTechnician,
  useUpdateResponsibleTechnician,
  useDeleteResponsibleTechnician,
  useServices,
  useDemandTypes,
} from '@/hooks/useSupabaseData';
import {
  Plus, Pencil, Trash2, UserCog, BarChart3, CheckCircle,
  ClipboardList, HardHat, User, Briefcase, FileText,
} from 'lucide-react';

function cpfMask(v: string) {
  return v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

interface ResponsibleTechnician {
  id: string;
  name: string;
  cpf: string | null;
  cargo: string | null;
  is_active: boolean;
  created_at: string | null;
}

// ─── Responsável Técnico Form ─────────────────────────────────────────────────

function TechnicianForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: Partial<ResponsibleTechnician>;
  onSubmit: (data: { name: string; cpf: string; cargo: string }) => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [cpf, setCpf] = useState(initial?.cpf ?? '');
  const [cargo, setCargo] = useState(initial?.cargo ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, cpf, cargo });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tech-name">Nome Completo *</Label>
        <Input
          id="tech-name"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          placeholder="NOME DO RESPONSÁVEL"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tech-cpf">CPF</Label>
        <Input
          id="tech-cpf"
          value={cpf}
          onChange={(e) => setCpf(cpfMask(e.target.value))}
          placeholder="000.000.000-00"
          inputMode="numeric"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tech-cargo">Cargo</Label>
        <Input
          id="tech-cargo"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          placeholder="Ex: Engenheiro Agrônomo, Técnico Agrícola"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : initial?.id ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OperatorsPage() {
  const [activeTab, setActiveTab] = useState<'operators' | 'technicians'>('operators');

  // ── Operators state ────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [deletingOperator, setDeletingOperator] = useState<Operator | null>(null);
  const [metricsOperator, setMetricsOperator] = useState<Operator | null>(null);

  const { data: operators, isLoading: opLoading } = useOperators();
  const { data: services = [] } = useServices();
  const { data: demandTypes = [] } = useDemandTypes();
  const createOperator = useCreateOperator();
  const updateOperator = useUpdateOperator();
  const deleteOperator = useDeleteOperator();
  const toggleStatus = useToggleOperatorStatus();

  // ── Technicians state ──────────────────────────────────────────────────────
  const [techFormOpen, setTechFormOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<ResponsibleTechnician | null>(null);
  const [deletingTech, setDeletingTech] = useState<ResponsibleTechnician | null>(null);

  const { data: technicians = [], isLoading: techLoading } = useResponsibleTechnicians();
  const createTech = useCreateResponsibleTechnician();
  const updateTech = useUpdateResponsibleTechnician();
  const deleteTech = useDeleteResponsibleTechnician();

  // ── Operator helpers ───────────────────────────────────────────────────────
  const handleCreate = async (data: { name: string; email: string; password: string }) => {
    await createOperator.mutateAsync(data);
    setIsFormOpen(false);
  };

  const handleUpdate = async (data: { name: string }) => {
    if (editingOperator) {
      await updateOperator.mutateAsync({ userId: editingOperator.id, name: data.name });
      setEditingOperator(null);
    }
  };

  const handleDelete = () => {
    if (deletingOperator) {
      deleteOperator.mutate(deletingOperator.id, { onSuccess: () => setDeletingOperator(null) });
    }
  };

  const handleToggleStatus = (operator: Operator) => {
    toggleStatus.mutate({ userId: operator.id, is_active: !operator.is_active });
  };

  const getOperatorMetrics = (operatorId: string) => {
    const operatorServices = services.filter(
      (s: any) => s.operator_id === operatorId && s.status === 'completed'
    );
    const byDemandType: Record<string, { name: string; count: number }> = {};
    operatorServices.forEach((s: any) => {
      const dt = demandTypes.find(d => d.id === s.demand_type_id);
      const name = dt?.name || s.demand_types?.name || 'Desconhecido';
      if (!byDemandType[s.demand_type_id]) byDemandType[s.demand_type_id] = { name, count: 0 };
      byDemandType[s.demand_type_id].count++;
    });
    return {
      total: operatorServices.length,
      byDemandType: Object.values(byDemandType).sort((a, b) => b.count - a.count),
    };
  };

  // ── Technician helpers ─────────────────────────────────────────────────────
  const getTechnicianServiceCount = (techId: string) =>
    (services as any[]).filter((s: any) => s.responsible_technician_id === techId).length;

  const handleTechCreate = (data: { name: string; cpf: string; cargo: string }) => {
    createTech.mutate(
      { name: data.name, cpf: data.cpf || null, cargo: data.cargo || null },
      { onSuccess: () => setTechFormOpen(false) }
    );
  };

  const handleTechUpdate = (data: { name: string; cpf: string; cargo: string }) => {
    if (!editingTech) return;
    updateTech.mutate(
      { id: editingTech.id, name: data.name, cpf: data.cpf || null, cargo: data.cargo || null },
      { onSuccess: () => setEditingTech(null) }
    );
  };

  const handleTechDelete = () => {
    if (deletingTech) {
      deleteTech.mutate(deletingTech.id, { onSuccess: () => setDeletingTech(null) });
    }
  };

  // ── Operator columns ───────────────────────────────────────────────────────
  const operatorColumns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: Operator) => (
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      className: 'hidden sm:table-cell',
      render: (row: Operator) => <span className="truncate max-w-[200px] block">{row.email}</span>,
    },
    {
      key: 'completed',
      header: 'Atendimentos',
      render: (row: Operator) => {
        const metrics = getOperatorMetrics(row.id);
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {metrics.total}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Operator) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.is_active}
            onCheckedChange={() => handleToggleStatus(row)}
            disabled={toggleStatus.isPending}
          />
          <Badge variant="outline" className={row.is_active ? 'status-completed' : ''}>
            {row.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: Operator) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setMetricsOperator(row); }} title="Ver métricas">
            <BarChart3 className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingOperator(row); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingOperator(row); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Technician columns ─────────────────────────────────────────────────────
  const technicianColumns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row: ResponsibleTechnician) => (
        <div className="flex items-center gap-2">
          <HardHat className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'cpf',
      header: 'CPF',
      className: 'hidden sm:table-cell',
      render: (row: ResponsibleTechnician) => <span>{row.cpf || '—'}</span>,
    },
    {
      key: 'cargo',
      header: 'Cargo',
      className: 'hidden md:table-cell',
      render: (row: ResponsibleTechnician) => (
        <span className="text-muted-foreground">{row.cargo || '—'}</span>
      ),
    },
    {
      key: 'atendimentos',
      header: 'Atendimentos',
      render: (row: ResponsibleTechnician) => (
        <Badge variant="secondary" className="gap-1">
          <ClipboardList className="h-3 w-3" />
          {getTechnicianServiceCount(row.id)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: ResponsibleTechnician) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.is_active}
            onCheckedChange={() =>
              updateTech.mutate({ id: row.id, is_active: !row.is_active })
            }
            disabled={updateTech.isPending}
          />
          <Badge variant="outline" className={row.is_active ? 'status-completed' : ''}>
            {row.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: ResponsibleTechnician) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingTech(row); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingTech(row); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const metricsData = metricsOperator ? getOperatorMetrics(metricsOperator.id) : null;

  return (
    <AppLayout>
      <PageHeader
        title="Colaboradores"
        description="Gerencie operadores e responsáveis técnicos"
        action={
          activeTab === 'operators'
            ? { label: 'Novo Operador', onClick: () => setIsFormOpen(true), icon: <Plus className="h-4 w-4 mr-2" /> }
            : { label: 'Novo Responsável', onClick: () => setTechFormOpen(true), icon: <Plus className="h-4 w-4 mr-2" /> }
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="operators" className="gap-2">
            <UserCog className="h-4 w-4" />
            Operadores
          </TabsTrigger>
          <TabsTrigger value="technicians" className="gap-2">
            <HardHat className="h-4 w-4" />
            Responsáveis Técnicos
          </TabsTrigger>
        </TabsList>

        {/* ── Operadores tab ── */}
        <TabsContent value="operators">
          <DataTable
            data={operators || []}
            columns={operatorColumns}
            keyExtractor={(row) => row.id}
            isLoading={opLoading}
            emptyMessage="Nenhum operador cadastrado"
          />
        </TabsContent>

        {/* ── Responsáveis Técnicos tab ── */}
        <TabsContent value="technicians">
          <DataTable
            data={(technicians as ResponsibleTechnician[]) || []}
            columns={technicianColumns}
            keyExtractor={(row) => row.id}
            isLoading={techLoading}
            emptyMessage="Nenhum responsável técnico cadastrado"
          />
        </TabsContent>
      </Tabs>

      {/* ── Operator Metrics Sheet ─────────────────────────────────────────── */}
      <Sheet open={!!metricsOperator} onOpenChange={(open) => !open && setMetricsOperator(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Métricas do Operador</SheetTitle>
          </SheetHeader>
          {metricsOperator && metricsData && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <UserCog className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{metricsOperator.name}</p>
                  <p className="text-sm text-muted-foreground">{metricsOperator.email}</p>
                </div>
              </div>
              <Separator />
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/20">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Atendimentos Finalizados</p>
                    <p className="text-4xl font-black text-foreground">{metricsData.total}</p>
                  </div>
                </CardContent>
              </Card>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Atendimentos por Tipo de Serviço
                </h3>
                {metricsData.byDemandType.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Nenhum atendimento finalizado</p>
                ) : (
                  <div className="space-y-2">
                    {metricsData.byDemandType.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="secondary" className="text-base px-3">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Operator Dialogs ────────────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Operador</DialogTitle></DialogHeader>
          <OperatorForm
            onSubmit={handleCreate}
            onCancel={() => setIsFormOpen(false)}
            isLoading={createOperator.isPending}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOperator} onOpenChange={(open) => !open && setEditingOperator(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Operador</DialogTitle></DialogHeader>
          {editingOperator && (
            <OperatorForm
              defaultValues={{ name: editingOperator.name, email: editingOperator.email }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingOperator(null)}
              isLoading={updateOperator.isPending}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingOperator}
        onOpenChange={(open) => !open && setDeletingOperator(null)}
        title="Excluir Operador"
        description={`Tem certeza que deseja excluir o operador "${deletingOperator?.name}"?`}
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* ── Technician Dialogs ───────────────────────────────────────────────── */}
      <Dialog open={techFormOpen} onOpenChange={setTechFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Responsável Técnico</DialogTitle></DialogHeader>
          <TechnicianForm
            onSubmit={handleTechCreate}
            onCancel={() => setTechFormOpen(false)}
            isPending={createTech.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTech} onOpenChange={(open) => !open && setEditingTech(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Responsável Técnico</DialogTitle></DialogHeader>
          {editingTech && (
            <TechnicianForm
              initial={editingTech}
              onSubmit={handleTechUpdate}
              onCancel={() => setEditingTech(null)}
              isPending={updateTech.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingTech}
        onOpenChange={(open) => !open && setDeletingTech(null)}
        title="Excluir Responsável Técnico"
        description={`Tem certeza que deseja excluir "${deletingTech?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleTechDelete}
        variant="destructive"
      />
    </AppLayout>
  );
}
