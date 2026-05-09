import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus, Pencil, Trash2, Building2, MessageCircle,
  MapPin, User, DollarSign, Calendar, Hash,
} from 'lucide-react';
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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Veículo:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  Equipamento: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  Imóvel:      { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
  Móvel:       { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  Implemento:  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Outro:       { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200' },
};

function formatBRL(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy'); }
  catch { return '—'; }
}

function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,\.]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
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
    setFormName(''); setFormPatrimonyNumber(''); setFormDescription('');
    setFormValue(''); setFormCategory(''); setFormAcquisitionDate('');
    setFormLocation(''); setFormResponsibleName(''); setFormResponsiblePhone('');
    setFormOpen(true);
  };

  const openEditForm = (item: PatrimonyItem) => {
    setEditing(item);
    setFormName(item.name);
    setFormPatrimonyNumber(item.patrimony_number);
    setFormDescription(item.description ?? '');
    setFormValue(item.value != null
      ? item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '');
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
      value: parseCurrencyInput(formValue),
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

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Patrimônio" description="Gerenciar bens e patrimônio municipal" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Building2 className="h-12 w-12 opacity-30" />
          <p>{search ? 'Nenhum bem encontrado' : 'Nenhum bem cadastrado'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const colors = CATEGORY_COLORS[p.category ?? ''] ?? CATEGORY_COLORS['Outro'];
            return (
              <div
                key={p.id}
                className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* Card header */}
                <div className={`px-4 py-3 flex items-start justify-between gap-2 border-b ${colors.bg}`}>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm leading-snug truncate">{p.name}</h3>
                    {p.category && (
                      <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {p.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { setToDelete(p); setDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-2 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Nº</span>
                    <span className="font-medium">{p.patrimony_number}</span>
                  </div>

                  {p.value != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-emerald-700">{formatBRL(p.value)}</span>
                    </div>
                  )}

                  {p.acquisition_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Aquisição: {formatDate(p.acquisition_date)}</span>
                    </div>
                  )}

                  {p.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.location}</span>
                    </div>
                  )}

                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                </div>

                {/* Responsible footer */}
                {(p.responsible_name || p.responsible_phone) && (
                  <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {p.responsible_name && (
                      <span className="text-xs font-medium truncate flex-1">{p.responsible_name}</span>
                    )}
                    {p.responsible_phone && (
                      <button
                        onClick={() => openWhatsApp(p.responsible_phone!)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium shrink-0"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Bem' : 'Novo Bem'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pat-name">Nome do Bem *</Label>
              <Input id="pat-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Veículo Hilux" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-number">Nº do Patrimônio *</Label>
              <Input id="pat-number" value={formPatrimonyNumber} onChange={(e) => setFormPatrimonyNumber(e.target.value)} placeholder="Ex: PAT-001" required />
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
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-value">Valor do Bem (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">R$</span>
                <Input
                  id="pat-value"
                  type="text"
                  inputMode="decimal"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="0,00"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-date">Data de Aquisição</Label>
              <Input id="pat-date" type="date" value={formAcquisitionDate} onChange={(e) => setFormAcquisitionDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-description">Descrição (opcional)</Label>
              <Input id="pat-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição do bem" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Localização do Bem</Label>
              <Input id="location" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Ex: Depósito Municipal, Rua X" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável (opcional)</Label>
              <Input id="responsible" value={formResponsibleName} onChange={(e) => setFormResponsibleName(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resp-phone">WhatsApp do Responsável (opcional)</Label>
              <Input id="resp-phone" value={formResponsiblePhone} onChange={(e) => setFormResponsiblePhone(e.target.value)} placeholder="(66) 99999-9999" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Salvar' : 'Cadastrar'}</Button>
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
