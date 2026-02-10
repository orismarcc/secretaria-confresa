import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Operator 
} from '@/hooks/useOperatorData';
import { useServices, useDemandTypes } from '@/hooks/useSupabaseData';
import { Plus, Pencil, Trash2, UserCog, BarChart3, CheckCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OperatorsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [deletingOperator, setDeletingOperator] = useState<Operator | null>(null);
  const [metricsOperator, setMetricsOperator] = useState<Operator | null>(null);

  const { data: operators, isLoading } = useOperators();
  const { data: services = [] } = useServices();
  const { data: demandTypes = [] } = useDemandTypes();
  const createOperator = useCreateOperator();
  const updateOperator = useUpdateOperator();
  const deleteOperator = useDeleteOperator();
  const toggleStatus = useToggleOperatorStatus();

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
      deleteOperator.mutate(deletingOperator.id, {
        onSuccess: () => setDeletingOperator(null),
      });
    }
  };

  const handleToggleStatus = (operator: Operator) => {
    toggleStatus.mutate({ userId: operator.id, is_active: !operator.is_active });
  };

  // Calculate operator metrics
  const getOperatorMetrics = (operatorId: string) => {
    const operatorServices = services.filter(
      (s: any) => s.operator_id === operatorId && s.status === 'completed'
    );
    
    const byDemandType: Record<string, { name: string; count: number }> = {};
    operatorServices.forEach((s: any) => {
      const dt = demandTypes.find(d => d.id === s.demand_type_id);
      const name = dt?.name || s.demand_types?.name || 'Desconhecido';
      if (!byDemandType[s.demand_type_id]) {
        byDemandType[s.demand_type_id] = { name, count: 0 };
      }
      byDemandType[s.demand_type_id].count++;
    });

    return {
      total: operatorServices.length,
      byDemandType: Object.values(byDemandType).sort((a, b) => b.count - a.count),
    };
  };

  const columns = [
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
      render: (row: Operator) => row.email,
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
          <Badge variant={row.is_active ? 'default' : 'secondary'}>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setMetricsOperator(row);
            }}
            title="Ver métricas"
          >
            <BarChart3 className="h-4 w-4 text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setEditingOperator(row);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingOperator(row);
            }}
          >
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
        title="Operadores"
        description="Gerencie os operadores de campo do sistema"
        action={{
          label: 'Novo Operador',
          onClick: () => setIsFormOpen(true),
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      <DataTable
        data={operators || []}
        columns={columns}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="Nenhum operador cadastrado"
      />

      {/* Metrics Sheet */}
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
                  Atendimentos por Tipo de Demanda
                </h3>
                
                {metricsData.byDemandType.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">
                    Nenhum atendimento finalizado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {metricsData.byDemandType.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                      >
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="secondary" className="text-base px-3">
                          {item.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Operador</DialogTitle>
          </DialogHeader>
          <OperatorForm
            onSubmit={handleCreate}
            onCancel={() => setIsFormOpen(false)}
            isLoading={createOperator.isPending}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingOperator} onOpenChange={(open) => !open && setEditingOperator(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Operador</DialogTitle>
          </DialogHeader>
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingOperator}
        onOpenChange={(open) => !open && setDeletingOperator(null)}
        title="Excluir Operador"
        description={`Tem certeza que deseja excluir o operador "${deletingOperator?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </AppLayout>
  );
}
