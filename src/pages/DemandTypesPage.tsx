import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { DemandType } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function DemandTypesPage() {
  const { demandTypes } = useData();

  const columns = [
    { key: 'name', header: 'Nome' },
    { key: 'description', header: 'Descrição', render: (d: DemandType) => d.description || '-' },
    { key: 'isActive', header: 'Status', render: (d: DemandType) => d.isActive ? <Badge variant="outline" className="bg-success/10 text-success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge> },
  ];

  return (
    <AppLayout>
      <PageHeader title="Tipos de Demanda" description="Categorias de atendimento" />
      <DataTable data={demandTypes} columns={columns} keyExtractor={(d) => d.id} emptyMessage="Nenhum tipo cadastrado" />
    </AppLayout>
  );
}
