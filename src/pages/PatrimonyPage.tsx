import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import {
  Plus, Pencil, Trash2, Building2, MessageCircle,
  MapPin, User, DollarSign, Calendar, Hash,
  AlertTriangle, Filter, ArrowRightLeft, Eye,
} from 'lucide-react';
import { openWhatsApp } from '@/lib/phone';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import {
  usePatrimony,
  useCreatePatrimony,
  useUpdatePatrimony,
  useDeletePatrimony,
  useCreatePatrimonyTransfer,
} from '@/hooks/useSupabaseData';
import { PatrimonyForm, type PatrimonyFormPayload, type PatrimonyFormItem } from '@/components/forms/PatrimonyForm';
import { PatrimonyTransferDialog, type PatrimonyTransferItem } from '@/components/PatrimonyTransferDialog';
import { PatrimonyDetailSheet, type PatrimonyDetailItem } from '@/components/PatrimonyDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { textIncludes } from '@/lib/text';

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition = 'otimo' | 'bom' | 'ruim' | 'pessimo';

interface PatrimonyItem {
  id: string;
  name: string;
  patrimony_number: string;
  patrimony_number_state?: string | null;
  description: string | null;
  value: number | null;
  category: string | null;
  acquisition_date: string | null;
  is_active: boolean;
  created_at: string | null;
  location: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  condition: Condition | null;
  written_off: boolean;
  image_url: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Veículo:     { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  Equipamento: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  Imóvel:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Móvel:       { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  Implemento:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  Outro:       { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
};

const CONDITION_CONFIG: Record<Condition, { label: string; bg: string; text: string; border: string; icon: string }> = {
  otimo:   { label: 'Ótimo',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300',  icon: '✓' },
  bom:     { label: 'Bom',     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',   icon: '◎' },
  ruim:    { label: 'Ruim',    bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', icon: '⚠' },
  pessimo: { label: 'Péssimo', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',    icon: '✕' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy'); }
  catch { return '—'; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatrimonyPage() {
  const { data: patrimony = [], isLoading } = usePatrimony();
  const createPatrimony      = useCreatePatrimony();
  const updatePatrimony      = useUpdatePatrimony();
  const deletePatrimony      = useDeletePatrimony();
  const createTransfer       = useCreatePatrimonyTransfer();

  // Filters
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [filterCond, setFilterCond] = useState<string>('all');

  // Dialog / sheet state
  const [formOpen, setFormOpen]                   = useState(false);
  const [editingItem, setEditingItem]             = useState<PatrimonyItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen]   = useState(false);
  const [toDelete, setToDelete]                   = useState<PatrimonyItem | null>(null);
  const [transferOpen, setTransferOpen]           = useState(false);
  const [transferItem, setTransferItem]           = useState<PatrimonyItem | null>(null);
  const [detailOpen, setDetailOpen]               = useState(false);
  const [detailItem, setDetailItem]               = useState<PatrimonyItem | null>(null);

  // ─── Filtered list ──────────────────────────────────────────────────────────

  const filtered = (patrimony as PatrimonyItem[]).filter((p) => {
    const matchesSearch =
      textIncludes(p.name, search) ||
      textIncludes(p.patrimony_number, search) ||
      textIncludes(p.patrimony_number_state, search) ||
      textIncludes(p.category, search);

    const dateStr = p.acquisition_date?.substring(0, 10) ?? '';
    const matchesFrom = !dateFrom || dateStr >= dateFrom;
    const matchesTo   = !dateTo   || dateStr <= dateTo;
    const matchesCond = filterCond === 'all' || p.condition === filterCond;

    return matchesSearch && matchesFrom && matchesTo && matchesCond;
  });

  const hasFilters = search || dateFrom || dateTo || filterCond !== 'all';

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleCreate = (data: PatrimonyFormPayload) => {
    createPatrimony.mutate(
      {
        name: data.name,
        patrimony_number: data.patrimony_number,
        patrimony_number_state: data.patrimony_number_state,
        description: data.description,
        value: data.value,
        category: data.category,
        acquisition_date: data.acquisition_date,
        written_off: data.written_off,
        condition: data.condition,
        location: data.location,
        responsible_name: data.responsible_name,
        responsible_phone: data.responsible_phone,
        image_url: data.image_url,
        image_url_2: data.image_url_2,
        image_url_3: data.image_url_3,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      {
        onSuccess: async (created: any) => {
          // Seed initial transfer if operational fields were provided
          if (
            created?.id &&
            (data.location || data.responsible_name || data.condition)
          ) {
            const { data: { user } } = await supabase.auth.getUser();
            createTransfer.mutate({
              transfer: {
                patrimony_id: created.id,
                transferred_at: data.acquisition_date ?? format(new Date(), 'yyyy-MM-dd'),
                location: data.location ?? null,
                responsible_name: data.responsible_name ?? null,
                responsible_phone: data.responsible_phone ?? null,
                condition: data.condition,
                notes: 'Registro inicial do bem',
                created_by: user?.id ?? null,
              },
              patrimonyId: created.id,
            });
          }
        },
      },
    );
  };

  const handleEdit = (data: PatrimonyFormPayload) => {
    if (!editingItem) return;
    updatePatrimony.mutate({
      id: editingItem.id,
      name: data.name,
      patrimony_number: data.patrimony_number,
      patrimony_number_state: data.patrimony_number_state,
      description: data.description,
      value: data.value,
      category: data.category,
      acquisition_date: data.acquisition_date,
      written_off: data.written_off,
      image_url: data.image_url,
      image_url_2: data.image_url_2,
      image_url_3: data.image_url_3,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    // Sync detail sheet if open on the same item
    if (detailItem?.id === editingItem.id) {
      setDetailItem((prev) => prev ? { ...prev, ...data } : prev);
    }
  };

  const handleDelete = () => {
    if (toDelete) {
      deletePatrimony.mutate(toDelete.id);
      if (detailItem?.id === toDelete.id) setDetailOpen(false);
      setToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openEditForm = (item: PatrimonyItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const openTransfer = (item: PatrimonyItem) => {
    setTransferItem(item);
    setTransferOpen(true);
  };

  const openDetail = (item: PatrimonyItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  // ─── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Patrimônio" description="Gerenciar bens e patrimônio municipal" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <PageHeader
        title="Patrimônio"
        description="Gerenciar bens e patrimônio municipal"
        action={{
          label: 'Novo Bem',
          onClick: () => { setEditingItem(null); setFormOpen(true); },
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Filters */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar bem, nº municipal, estadual, categoria..."
            className="flex-1"
          />
          <select
            value={filterCond}
            onChange={(e) => setFilterCond(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-44"
          >
            <option value="all">Todas as condições</option>
            {(Object.keys(CONDITION_CONFIG) as Condition[]).map((c) => (
              <option key={c} value={c}>{CONDITION_CONFIG[c].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Aquisição:</span>
          </div>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-40 text-sm"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40 text-sm"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterCond('all'); }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Count summary */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? 'bem encontrado' : 'bens encontrados'}
        {(patrimony as PatrimonyItem[]).length !== filtered.length && ` de ${(patrimony as PatrimonyItem[]).length} total`}
      </p>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Building2 className="h-12 w-12 opacity-30" />
          <p>{hasFilters ? 'Nenhum bem encontrado com os filtros aplicados' : 'Nenhum bem cadastrado'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const colors  = CATEGORY_COLORS[p.category ?? ''] ?? CATEGORY_COLORS['Outro'];
            const condCfg = p.condition ? CONDITION_CONFIG[p.condition] : null;

            return (
              <div
                key={p.id}
                className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* Photo strip — clickable to open detail */}
                <button
                  type="button"
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => openDetail(p)}
                  aria-label={`Ver detalhes de ${p.name}`}
                >
                  {p.image_url ? (
                    <div className="w-full h-40 overflow-hidden bg-muted">
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-20 bg-muted/40 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                  )}
                </button>

                {/* Card header */}
                <div className={`px-4 py-3 flex items-start justify-between gap-2 border-b ${colors.bg}`}>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left focus-visible:outline-none"
                    onClick={() => openDetail(p)}
                  >
                    <h3 className="font-semibold text-sm leading-snug">{p.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {p.category && (
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                          {p.category}
                        </span>
                      )}
                      {condCfg && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${condCfg.bg} ${condCfg.text} ${condCfg.border}`}>
                          {condCfg.icon} {condCfg.label}
                        </span>
                      )}
                      {p.written_off && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-300">
                          <AlertTriangle className="h-3 w-3" /> Baixa
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Ver detalhes"
                      onClick={() => openDetail(p)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:text-primary"
                      title="Registrar movimentação"
                      onClick={() => openTransfer(p)}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Editar"
                      onClick={() => openEditForm(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Excluir"
                      onClick={() => { setToDelete(p); setDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Card body */}
                <button
                  type="button"
                  className="px-4 py-3 space-y-2 flex-1 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => openDetail(p)}
                >
                  {/* Numbers */}
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground text-xs">Mun.</span>
                    <span className="font-medium text-sm">{p.patrimony_number}</span>
                    {p.patrimony_number_state && (
                      <>
                        <span className="text-muted-foreground/40 mx-0.5">·</span>
                        <span className="text-muted-foreground text-xs">Est.</span>
                        <span className="font-medium text-sm">{p.patrimony_number_state}</span>
                      </>
                    )}
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
                </button>

                {/* Responsible footer */}
                {(p.responsible_name || p.responsible_phone) && (
                  <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {p.responsible_name && (
                      <span className="text-xs font-medium truncate flex-1">{p.responsible_name}</span>
                    )}
                    {p.responsible_phone && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(p.responsible_phone!); }}
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

      {/* ── Patrimony Form (create / edit) ─── */}
      <PatrimonyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editingItem as PatrimonyFormItem | null}
        onSubmit={editingItem ? handleEdit : handleCreate}
      />

      {/* ── Transfer dialog ─── */}
      <PatrimonyTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        item={transferItem as PatrimonyTransferItem | null}
      />

      {/* ── Detail sheet ─── */}
      <PatrimonyDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={detailItem as PatrimonyDetailItem | null}
        onEdit={(it) => { setDetailOpen(false); openEditForm(it as PatrimonyItem); }}
        onTransfer={(it) => { openTransfer(it as PatrimonyItem); }}
      />

      {/* ── Confirm Delete ─── */}
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
