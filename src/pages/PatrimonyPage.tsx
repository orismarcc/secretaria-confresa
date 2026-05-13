import { useState, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  ImageIcon, X, AlertTriangle, ShieldCheck, Filter,
} from 'lucide-react';
import { openWhatsApp } from '@/lib/phone';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  usePatrimony,
  useCreatePatrimony,
  useUpdatePatrimony,
  useDeletePatrimony,
} from '@/hooks/useSupabaseData';

// ─── Types ───────────────────────────────────────────────────────────────────

type Condition = 'otimo' | 'bom' | 'ruim' | 'pessimo';

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
  condition: Condition | null;
  written_off: boolean;
  image_url: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Veículo', 'Equipamento', 'Imóvel', 'Móvel', 'Implemento', 'Outro'] as const;

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

function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,\.]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function uploadPatrimonyImage(file: File, itemId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${itemId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('patrimony-images').upload(path, file, { upsert: true });
  if (error) {
    console.error('Image upload error:', error);
    return null;
  }
  const { data } = supabase.storage.from('patrimony-images').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatrimonyPage() {
  const { data: patrimony = [], isLoading } = usePatrimony();
  const createPatrimony = useCreatePatrimony();
  const updatePatrimony = useUpdatePatrimony();
  const deletePatrimony = useDeletePatrimony();

  // Filters
  const [search, setSearch]       = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [filterCond, setFilterCond] = useState<string>('all');

  // Dialog state
  const [formOpen, setFormOpen]               = useState(false);
  const [editing, setEditing]                 = useState<PatrimonyItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete]               = useState<PatrimonyItem | null>(null);

  // Form fields
  const [formName, setFormName]                     = useState('');
  const [formPatrimonyNumber, setFormPatrimonyNumber] = useState('');
  const [formDescription, setFormDescription]       = useState('');
  const [formValue, setFormValue]                   = useState('');
  const [formCategory, setFormCategory]             = useState('');
  const [formAcquisitionDate, setFormAcquisitionDate] = useState('');
  const [formLocation, setFormLocation]             = useState('');
  const [formResponsibleName, setFormResponsibleName] = useState('');
  const [formResponsiblePhone, setFormResponsiblePhone] = useState('');
  const [formCondition, setFormCondition]           = useState<Condition | ''>('');
  const [formWrittenOff, setFormWrittenOff]         = useState(false);
  const [formImageFile, setFormImageFile]           = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview]     = useState<string | null>(null);
  const [formExistingImageUrl, setFormExistingImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting]             = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Filtered list ──────────────────────────────────────────────────────────

  const filtered = (patrimony as PatrimonyItem[]).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.patrimony_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase());

    const dateStr = p.acquisition_date?.substring(0, 10) ?? '';
    const matchesFrom = !dateFrom || dateStr >= dateFrom;
    const matchesTo   = !dateTo   || dateStr <= dateTo;

    const matchesCond = filterCond === 'all' || p.condition === filterCond;

    return matchesSearch && matchesFrom && matchesTo && matchesCond;
  });

  const hasFilters = search || dateFrom || dateTo || filterCond !== 'all';

  // ─── Form helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName(''); setFormPatrimonyNumber(''); setFormDescription('');
    setFormValue(''); setFormCategory(''); setFormAcquisitionDate('');
    setFormLocation(''); setFormResponsibleName(''); setFormResponsiblePhone('');
    setFormCondition(''); setFormWrittenOff(false);
    setFormImageFile(null); setFormImagePreview(null); setFormExistingImageUrl(null);
  };

  const openCreateForm = () => {
    setEditing(null);
    resetForm();
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
    setFormLocation(item.location ?? '');
    setFormResponsibleName(item.responsible_name ?? '');
    setFormResponsiblePhone(item.responsible_phone ?? '');
    setFormCondition((item.condition ?? '') as Condition | '');
    setFormWrittenOff(item.written_off ?? false);
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormExistingImageUrl(item.image_url ?? null);
    setFormOpen(true);
  };

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setFormImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const clearImage = () => {
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = formExistingImageUrl;

      // If there's a new file to upload, we need an ID first
      if (formImageFile) {
        // For new items, use a temp UUID; for edits, use the existing ID
        const uploadId = editing?.id ?? crypto.randomUUID();
        imageUrl = await uploadPatrimonyImage(formImageFile, uploadId);
      }

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
        condition: (formCondition || null) as Condition | null,
        written_off: formWrittenOff,
        image_url: imageUrl,
      };

      if (editing) {
        updatePatrimony.mutate({ id: editing.id, ...payload });
      } else {
        createPatrimony.mutate(payload);
      }

      setFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (toDelete) {
      deletePatrimony.mutate(toDelete.id);
      setToDelete(null);
      setDeleteDialogOpen(false);
    }
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
        action={{ label: 'Novo Bem', onClick: openCreateForm, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

      {/* Filters */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar bem, nº, categoria..." className="flex-1" />
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
            placeholder="De"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40 text-sm"
            placeholder="Até"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterCond('all'); }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
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
            const colors    = CATEGORY_COLORS[p.category ?? ''] ?? CATEGORY_COLORS['Outro'];
            const condCfg   = p.condition ? CONDITION_CONFIG[p.condition] : null;

            return (
              <div
                key={p.id}
                className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* Photo strip */}
                {p.image_url ? (
                  <div className="w-full h-40 overflow-hidden bg-muted">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : null}

                {/* Card header */}
                <div className={`px-4 py-3 flex items-start justify-between gap-2 border-b ${colors.bg}`}>
                  <div className="min-w-0 flex-1">
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
                    <span className="text-muted-foreground text-xs">Nº</span>
                    <span className="font-medium text-sm">{p.patrimony_number}</span>
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

      {/* ── Form Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Bem' : 'Novo Bem'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Image upload ── */}
            <div className="space-y-2">
              <Label>Foto do Bem</Label>
              {(formImagePreview || formExistingImageUrl) ? (
                <div className="relative w-full h-44 rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={formImagePreview ?? formExistingImageUrl!}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm">Clique para adicionar foto</span>
                  <span className="text-xs">JPG, PNG, WebP — max 5 MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* ── Name & Number ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="pat-name">Nome do Bem *</Label>
                <Input id="pat-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Veículo Hilux" required />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="pat-number">Nº do Patrimônio *</Label>
                <Input id="pat-number" value={formPatrimonyNumber} onChange={(e) => setFormPatrimonyNumber(e.target.value)} placeholder="PAT-001" required />
              </div>
            </div>

            {/* ── Category & Condition ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pat-category">Categoria</Label>
                <select
                  id="pat-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Selecionar</option>
                  {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pat-condition">Estado de Conservação</Label>
                <select
                  id="pat-condition"
                  value={formCondition}
                  onChange={(e) => {
                    const val = e.target.value as Condition | '';
                    setFormCondition(val);
                    if (val !== 'pessimo') setFormWrittenOff(false);
                  }}
                  className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium
                    ${formCondition === 'otimo'   ? 'bg-green-50 border-green-300 text-green-800' :
                      formCondition === 'bom'     ? 'bg-blue-50  border-blue-300  text-blue-800'  :
                      formCondition === 'ruim'    ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                      formCondition === 'pessimo' ? 'bg-red-50   border-red-300   text-red-800'   :
                      'bg-background border-input text-foreground'}`}
                >
                  <option value="">Selecionar</option>
                  <option value="otimo">✓ Ótimo</option>
                  <option value="bom">◎ Bom</option>
                  <option value="ruim">⚠ Ruim</option>
                  <option value="pessimo">✕ Péssimo</option>
                </select>
              </div>
            </div>

            {/* ── Conditional: Foi dado baixa? ── */}
            {formCondition === 'pessimo' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Este bem está em estado Péssimo
                </div>
                <Label className="text-sm text-red-700">Foi dado baixa neste bem?</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormWrittenOff(true)}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                      formWrittenOff
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-red-300 text-red-700 hover:bg-red-50'
                    }`}
                  >
                    Sim, baixa dada
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormWrittenOff(false)}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                      !formWrittenOff
                        ? 'bg-gray-600 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Não, ainda em uso
                  </button>
                </div>
              </div>
            )}

            {/* ── Value & Date ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pat-value">Valor (R$)</Label>
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
            </div>

            {/* ── Description ── */}
            <div className="space-y-2">
              <Label htmlFor="pat-description">Descrição</Label>
              <Input id="pat-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição do bem" />
            </div>

            {/* ── Location ── */}
            <div className="space-y-2">
              <Label htmlFor="pat-location">Localização</Label>
              <Input id="pat-location" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Ex: Depósito Municipal" />
            </div>

            {/* ── Responsible ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="pat-resp-name">Responsável</Label>
                <Input id="pat-resp-name" value={formResponsibleName} onChange={(e) => setFormResponsibleName(e.target.value)} placeholder="Nome do responsável" />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="pat-resp-phone">WhatsApp</Label>
                <Input id="pat-resp-phone" value={formResponsiblePhone} onChange={(e) => setFormResponsiblePhone(e.target.value)} placeholder="(66) 99999-9999" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete ── */}
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
