import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { Location } from '@/types';

export default function LocationsPage() {
  const { locations, settlements } = useData();
  const columns = [
    { key: 'name', header: 'Localidade' },
    { key: 'settlement', header: 'Assentamento', render: (l: Location) => settlements.find(s => s.id === l.settlementId)?.name || 'N/A' },
  ];

  return (
    <AppLayout>
      <PageHeader title="Localidades" description="Gerenciar localidades" />
      <DataTable data={locations} columns={columns} keyExtractor={(l) => l.id} emptyMessage="Nenhuma localidade cadastrada" />
    </AppLayout>
  );
}
