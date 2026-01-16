import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { DataTable } from '@/components/DataTable';
import { SearchInput } from '@/components/SearchInput';
import { Producer } from '@/types';

export default function ProducersPage() {
  const { producers, settlements, locations } = useData();
  const [search, setSearch] = useState('');

  const filtered = producers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search));

  const columns = [
    { key: 'name', header: 'Nome' },
    { key: 'cpf', header: 'CPF' },
    { key: 'phone', header: 'Telefone' },
    { key: 'settlement', header: 'Assentamento', render: (p: Producer) => settlements.find(s => s.id === p.settlementId)?.name || 'N/A' },
  ];

  return (
    <AppLayout>
      <PageHeader title="Produtores" description="Gerenciar produtores">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou CPF..." className="max-w-sm" />
      </PageHeader>
      <DataTable data={filtered} columns={columns} keyExtractor={(p) => p.id} emptyMessage="Nenhum produtor encontrado" />
    </AppLayout>
  );
}
