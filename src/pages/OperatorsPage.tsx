import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OperatorsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [deletingOperator, setDeletingOperator] = useState<Operator | null>(null);

  const { data: operators, isLoading } = useOperators();
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
      key: 'created_at',
      header: 'Cadastrado em',
      render: (row: Operator) => format(new Date(row.created_at), "dd/MM/yyyy", { locale: ptBR }),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: Operator) => (
        <div className="flex gap-2">
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
