import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
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
import { Plus, Pencil, Trash2, Building2, MessageCircle } from 'lucide-react';
import { openWhatsApp } from '@/lib/phone';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import {
  usePatrimony,
  useCreatePatrimony,
  useUpdatePatrimony,
  useDeletePatrimony,
} from '@/hooks/useSupabaseData';

interface PatrimonyItem {
  id: string;
  name: string;
  patrimony_number: string;
  description: string | null;
  value: number | null;
  category: string | null;
  acquisition_date: string | null;
  is_active: boolean;
  created_at: string | null;
  location: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
}

const CATEGORIES = ['Veículo', 'Equipamento', 'Imóvel', 'Móvel', 'Implemento', 'Outro'] as const;

function formatBRL(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

export default function PatrimonyPage() {
  const { data: patrimony = [], isLoading } = usePatrimony();
  const createPatrimony = useCreatePatrimony();
  const updatePatrimony = useUpdatePatrimony();
  const deletePatrimony = useDeletePatrimony();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PatrimonyItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PatrimonyItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPatrimonyNumber, setFormPatrimonyNumber] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formAcquisitionDate, setFormAcquisitionDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formResponsibleName, setFormResponsibleName] = useState('');
  const [formResponsiblePhone, setFormResponsiblePhone] = useState('');

  const filtered = (patrimony as PatrimonyItem[]).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.patrimony_number.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreateForm = () => {
    setEditing(null);
    setFormName('');
    setFormPatrimonyNumber('');
    setFormDescription('');
    setFormValue('');
    setFormCategory('');
    setFormAcquisitionDate('');
    setFormLocation('');
    setFormResponsibleName('');
    setFormResponsiblePhone('');
    setFormOpen(true);
  };

  const openEditForm = (item: PatrimonyItem) => {
    setEditing(item);
    setFormName(item.name);
    setFormPatrimonyNumber(item.patrimony_number);
    setFormDescription(item.description ?? '');
    setFormValue(item.value != null ? String(item.value) : '');
    setFormCategory(item.category ?? '');
    setFormAcquisitionDate(item.acquisition_date ?? '');
    setFormLocation(item.location || '');
    setFormResponsibleName(item.responsible_name || '');
    setFormResponsiblePhone(item.responsible_phone || '');
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formName,
      patrimony_number: formPatrimonyNumber,
      description: formDescription || null,
      value: formValue !== '' ? parseFloat(formValue) : null,
      category: formCategory || null,
      acquisition_date: formAcquisitionDate || null,
      location: formLocation || null,
      responsible_name: formResponsibleName || null,
      responsible_phone: formResponsiblePhone || null,
    };
    if (editing) {
      updatePatrimony.mutate({ id: editing.id, ...payload });
    } else {
      createPatrimony.mutate(payload);
    }
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (toDelete) {
      deletePatrimony.mutate(toDelete.id);
      setToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleActive = (item: PatrimonyItem) => {
    updatePatrimony.mutate({ id: item.id, is_active: !item.is_active });
  };

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (p: PatrimonyItem) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <span className="font-medium">{p.name}</span>
            {p.category && (
              <div className="mt-0.5">
                <Badge variant="secondary" className="text-xs font-normal">
                  {p.category}
                </Badge>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'patrimony_number',
      header: 'Nº Patrimônio',
      render: (p: PatrimonyItem) => p.patrimony_number,
    },
    {
      key: 'value',
      header: 'Valor',
      className: 'hidden sm:table-cell',
      render: (p: PatrimonyItem) => formatBRL(p.value),
    },
    {
      key: 'acquisition_date',
      header: 'Data Aquisição',
      className: 'hidden md:table-cell',
      render: (p: PatrimonyItem) => formatDate(p.acquisition_date),
    },
    {
      key: 'responsible',
      header: 'Responsável',
      className: 'hidden lg:table-cell',
      render: (m: PatrimonyItem) => {
        if (!m.responsible_name && !m.responsible_phone) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            {m.responsible_name && <span className="text-sm font-medium">{m.responsible_name}</span>}
            {m.responsible_phone && (
              <button
                onClick={() => openWhatsApp(m.responsible_phone!)}
                className="flex items-center gap-1 text-xs text-success hover:text-success/80 w-fit"
              >
                <MessageCircle className="h-3 w-3" />
                {m.responsible_phone}
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: PatrimonyItem) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={p.is_active}
            onCheckedChange={() => handleToggleActive(p)}
          />
          <Badge variant="outline" className={p.is_active ? 'status-completed' : ''}>
            {p.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: PatrimonyItem) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditForm(p)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setToDelete(p); setDeleteDialogOpen(true); }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Patrimônio" description="Gerenciar bens e patrimônio municipal" />
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
        title="Patrimônio"
        description="Gerenciar bens e patrimônio municipal"
        action={{ label: 'Novo Bem', onClick: openCreateForm, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar bem..." className="max-w-md" />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(p) => p.id}
        emptyMessage="Nenhum bem cadastrado"
      />

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Bem' : 'Novo Bem'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pat-name">Nome do Bem *</Label>
              <Input
                id="pat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Veículo Hilux"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-number">Nº do Patrimônio *</Label>
              <Input
                id="pat-number"
                value={formPatrimonyNumber}
                onChange={(e) => setFormPatrimonyNumber(e.target.value)}
                placeholder="Ex: PAT-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-category">Categoria</Label>
              <select
                id="pat-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecionar categoria</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-value">Valor do Bem</Label>
              <Input
                id="pat-value"
                type="number"
                step="0.01"
                min="0"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="Ex: 45000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-date">Data de Aquisição</Label>
              <Input
                id="pat-date"
                type="date"
                value={formAcquisitionDate}
                onChange={(e) => setFormAcquisitionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-description">Descrição (opcional)</Label>
              <Input
                id="pat-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descrição do bem"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Localização do Bem</Label>
              <Input
                id="location"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="Ex: Depósito Municipal, Rua X"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável (opcional)</Label>
              <Input
                id="responsible"
                value={formResponsibleName}
                onChange={(e) => setFormResponsibleName(e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resp-phone">WhatsApp do Responsável (opcional)</Label>
              <Input
                id="resp-phone"
                value={formResponsiblePhone}
                onChange={(e) => setFormResponsiblePhone(e.target.value)}
                placeholder="(66) 99999-9999"
              />
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
        title="Excluir Bem"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
