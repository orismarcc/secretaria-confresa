import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';

export default function SettlementsPage() {
  const { settlements } = useData();
  const columns = [{ key: 'name', header: 'Nome do Assentamento' }];

  return (
    <AppLayout>
      <PageHeader title="Assentamentos" description="Gerenciar assentamentos" />
      <DataTable data={settlements} columns={columns} keyExtractor={(s) => s.id} emptyMessage="Nenhum assentamento cadastrado" />
    </AppLayout>
  );
}
