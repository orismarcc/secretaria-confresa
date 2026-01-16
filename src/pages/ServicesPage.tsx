import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchInput } from '@/components/SearchInput';
import { Service } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServicesPage() {
  const { services, producers, demandTypes } = useData();
  const [search, setSearch] = useState('');

  const filteredServices = services.filter(s => {
    const producer = producers.find(p => p.id === s.producerId);
    return producer?.name.toLowerCase().includes(search.toLowerCase()) || producer?.cpf.includes(search);
  });

  const columns = [
    { key: 'producer', header: 'Produtor', render: (s: Service) => producers.find(p => p.id === s.producerId)?.name || 'N/A' },
    { key: 'demandType', header: 'Tipo', render: (s: Service) => demandTypes.find(d => d.id === s.demandTypeId)?.name || 'N/A' },
    { key: 'scheduledDate', header: 'Data', render: (s: Service) => format(new Date(s.scheduledDate), 'dd/MM/yyyy', { locale: ptBR }) },
    { key: 'status', header: 'Status', render: (s: Service) => <StatusBadge status={s.status} /> },
  ];

  return (
    <AppLayout>
      <PageHeader title="Atendimentos" description="Gerenciar atendimentos">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por produtor..." className="max-w-sm" />
      </PageHeader>
      <DataTable data={filteredServices} columns={columns} keyExtractor={(s) => s.id} emptyMessage="Nenhum atendimento encontrado" />
    </AppLayout>
  );
}
