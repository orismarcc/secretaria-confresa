import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  CalendarRange,
  User,
  Hash,
  CheckCircle,
  Clock,
  CalendarCheck,
  Search,
  ChevronsUpDown,
  ChevronDown,
  Check as CheckIcon,
  BarChart2,
  MapPin,
  Phone,
  CreditCard,
  Box,
  AlertTriangle,
  Layers,
  Warehouse,
  TrendingUp,
  MinusCircle,
  Download,
} from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/text';
import { openWhatsApp } from '@/lib/phone';
import { downloadVCard } from '@/lib/vcard';
import { useToast } from '@/hooks/use-toast';
import {
  useDeliveries,
  useCreateDelivery,
  useUpdateDelivery,
  useDeleteDelivery,
  useProducers,
  useDemandTypes,
  useSettlements,
  useDeliveryLots,
  useCreateDeliveryLot,
  useUpdateDeliveryLot,
  useDeleteDeliveryLot,
  useDeliveryItems,
  useSaveDeliveryItems,
  useResponsibleTechnicians,
} from '@/hooks/useSupabaseData';

// ─── Delivery type color palette ─────────────────────────────────────────────

const TYPE_COLORS = [
  { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-500',    text: 'text-blue-700'   },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-800',  dot: 'bg-violet-500',  text: 'text-violet-700' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-800',    dot: 'bg-amber-500',   text: 'text-amber-700'  },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800',dot: 'bg-emerald-500', text: 'text-emerald-700'},
  { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-800',      dot: 'bg-rose-500',    text: 'text-rose-700'   },
  { bg: 'bg-cyan-50',    border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-800',      dot: 'bg-cyan-500',    text: 'text-cyan-700'   },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-500',  text: 'text-orange-700' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-800',  dot: 'bg-indigo-500',  text: 'text-indigo-700' },
] as const;

function getTypeColor(demandTypeId: string, allTypes: any[]) {
  const idx = allTypes.findIndex((t: any) => t.id === demandTypeId);
  return TYPE_COLORS[idx >= 0 ? idx % TYPE_COLORS.length : 0];
}

// ─── Producer searchable combobox ─────────────────────────────────────────────

function ProducerCombobox({
  producers,
  value,
  onChange,
}: {
  producers: any[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm) return producers;
    const t = normalizeText(searchTerm);
    return producers.filter(
      (p) =>
        normalizeText(p.name).includes(t) ||
        p.cpf?.includes(t) ||
        p.phone?.includes(t),
    );
  }, [producers, searchTerm]);

  const selected = producers.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className="truncate">
            {selected ? selected.name : 'Selecione o produtor'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum produtor encontrado
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setSearchTerm('');
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent text-left',
                  value === p.id && 'bg-accent',
                )}
              >
                <CheckIcon
                  className={cn('h-4 w-4 shrink-0', value === p.id ? 'opacity-100' : 'opacity-0')}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  {p.cpf && (
                    <p className="text-xs text-muted-foreground truncate">{p.cpf}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Lot picker — shown in delivery form when lots exist for a demand type ────

interface LotItem { lot_id: string; quantity: number }

function LotPicker({
  lots,
  selectedLots,
  onChange,
}: {
  lots: any[];
  selectedLots: LotItem[];
  onChange: (items: LotItem[]) => void;
}) {
  const toggle = (lotId: string) => {
    const exists = selectedLots.find((l) => l.lot_id === lotId);
    if (exists) {
      onChange(selectedLots.filter((l) => l.lot_id !== lotId));
    } else {
      onChange([...selectedLots, { lot_id: lotId, quantity: 0 }]);
    }
  };

  const setQty = (lotId: string, qty: number) => {
    onChange(selectedLots.map((l) => (l.lot_id === lotId ? { ...l, quantity: qty } : l)));
  };

  if (lots.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Warehouse className="h-4 w-4 text-primary" />
        <label className="text-sm font-medium">Lotes disponíveis</label>
      </div>
      <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
        {lots.map((lot: any) => {
          const remaining = Number(lot.remaining_quantity ?? 0);
          const isSelected = !!selectedLots.find((l) => l.lot_id === lot.id);
          const pct = lot.initial_quantity > 0
            ? Math.round(((lot.initial_quantity - remaining) / lot.initial_quantity) * 100)
            : 0;
          const depleted = remaining <= 0;

          const finalized  = Number(lot.finalized_quantity  ?? 0);
          const reserved   = Number(lot.reserved_quantity   ?? 0);
          const total      = Number(lot.initial_quantity);
          const pctFin     = total > 0 ? Math.round((finalized / total) * 100) : 0;
          const pctRes     = total > 0 ? Math.round((reserved  / total) * 100) : 0;

          return (
            <div
              key={lot.id}
              className={cn(
                'rounded-lg border bg-card p-3 transition-colors',
                isSelected && 'border-primary/40 bg-primary/5',
                depleted && 'opacity-60',
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => !depleted && toggle(lot.id)}
                  disabled={depleted}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{lot.name}</p>
                    {depleted ? (
                      <Badge variant="destructive" className="text-xs shrink-0 gap-1">
                        <AlertTriangle className="h-3 w-3" />Esgotado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs shrink-0 gap-1">
                        <MinusCircle className="h-3 w-3 text-success" />
                        {remaining.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {lot.unit} disp.
                      </Badge>
                    )}
                  </div>
                  {lot.supplier && (
                    <p className="text-xs text-muted-foreground">Fornecedor: {lot.supplier}</p>
                  )}

                  {/* Finalizado bar (green) */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400">
                      <span>Finalizado: {finalized.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} / {total.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {lot.unit}</span>
                      <span>{pctFin}%</span>
                    </div>
                    <Progress value={pctFin} className="h-1.5 [&>div]:bg-emerald-500" />
                  </div>

                  {/* Reservado bar (amber) */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                      <span>Reservado: {reserved.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {lot.unit}</span>
                      <span>{pctRes}%</span>
                    </div>
                    <Progress value={pctRes} className="h-1.5 [&>div]:bg-amber-500" />
                  </div>

                  {isSelected && !depleted && (
                    <div className="pt-1">
                      <Input
                        type="number"
                        min="0.001"
                        max={remaining}
                        step="0.001"
                        placeholder={`Qtd. (máx ${remaining.toLocaleString('pt-BR', { maximumFractionDigits: 3 })})`}
                        value={selectedLots.find((l) => l.lot_id === lot.id)?.quantity || ''}
                        onChange={(e) => setQty(lot.id, Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {selectedLots.length > 0 && (
        <p className="text-xs text-muted-foreground pl-1">
          Total selecionado:{' '}
          <strong>
            {selectedLots
              .reduce((s, l) => s + (l.quantity || 0), 0)
              .toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          </strong>{' '}
          {lots[0]?.unit || 'unidade(s)'}
        </p>
      )}
    </div>
  );
}

// ─── Lot form dialog ───────────────────────────────────────────────────────────

const UNITS = ['unidade', 'kg', 'g', 'ton', 'saco', 'caixa', 'litro', 'ml', 'dose'];

interface LotFormState {
  demand_type_id: string;
  name: string;
  initial_quantity: string;
  unit: string;
  supplier: string;
  lot_date: string;
  notes: string;
  responsible_technician_id: string;
}

const EMPTY_LOT: LotFormState = {
  demand_type_id: '',
  name: '',
  initial_quantity: '',
  unit: 'unidade',
  supplier: '',
  lot_date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
  responsible_technician_id: '',
};

function LotFormDialog({
  open,
  onOpenChange,
  demandTypes,
  technicians,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demandTypes: any[];
  technicians: any[];
  editing: any | null;
  onSubmit: (data: LotFormState) => void;
}) {
  const [form, setForm] = useState<LotFormState>(EMPTY_LOT);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              demand_type_id: editing.demand_type_id || '',
              name: editing.name || '',
              initial_quantity: editing.initial_quantity != null ? String(editing.initial_quantity) : '',
              unit: editing.unit || 'unidade',
              supplier: editing.supplier || '',
              lot_date: editing.lot_date || format(new Date(), 'yyyy-MM-dd'),
              notes: editing.notes || '',
              responsible_technician_id: editing.responsible_technician_id || '',
            }
          : EMPTY_LOT,
      );
    }
  }, [open, editing]);

  const valid = form.demand_type_id && form.name && form.initial_quantity && Number(form.initial_quantity) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Lote' : 'Novo Lote de Estoque'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Tipo de Entrega *</Label>
            <Select
              value={form.demand_type_id}
              onValueChange={(v) => setForm((f) => ({ ...f, demand_type_id: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {demandTypes.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nome / Identificação do Lote *</Label>
            <Input
              placeholder="Ex: Calcário Lote 01/2026"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade Inicial *</Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                placeholder="0"
                value={form.initial_quantity}
                onChange={(e) => setForm((f) => ({ ...f, initial_quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fornecedor / Origem</Label>
              <Input
                placeholder="Nome do fornecedor"
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Recebimento</Label>
              <Input
                type="date"
                value={form.lot_date}
                onChange={(e) => setForm((f) => ({ ...f, lot_date: e.target.value }))}
              />
            </div>
          </div>
          {technicians.length > 0 && (
            <div className="space-y-1.5">
              <Label>Responsável Técnico</Label>
              <Select
                value={form.responsible_technician_id || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, responsible_technician_id: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais do lote..."
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid} onClick={() => { if (valid) { onSubmit(form); onOpenChange(false); } }}>
            {editing ? 'Salvar' : 'Cadastrar Lote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lots management tab ───────────────────────────────────────────────────────

function LotsTab({ demandTypes }: { demandTypes: any[] }) {
  const { data: allLots = [], isLoading } = useDeliveryLots();
  const { data: technicians = [] } = useResponsibleTechnicians();
  const createLot = useCreateDeliveryLot();
  const updateLot = useUpdateDeliveryLot();
  const deleteLot = useDeleteDeliveryLot();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [filterType, setFilterType] = useState('all');

  const lots = (allLots as any[]);

  const displayed = useMemo(() =>
    filterType === 'all' ? lots : lots.filter((l: any) => l.demand_type_id === filterType),
    [lots, filterType],
  );

  // Group by demand type for summary cards
  const summaryByType = useMemo(() => {
    const map: Record<string, { name: string; total: number; finalized: number; reserved: number; remaining: number; count: number }> = {};
    lots.forEach((l: any) => {
      if (!map[l.demand_type_id]) {
        map[l.demand_type_id] = {
          name: l.demand_type_name || '—',
          total: 0, finalized: 0, reserved: 0, remaining: 0, count: 0,
        };
      }
      map[l.demand_type_id].total     += Number(l.initial_quantity   || 0);
      map[l.demand_type_id].finalized += Number(l.finalized_quantity || 0);
      map[l.demand_type_id].reserved  += Number(l.reserved_quantity  || 0);
      map[l.demand_type_id].remaining += Number(l.remaining_quantity || 0);
      map[l.demand_type_id].count += 1;
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }, [lots]);

  const handleSubmit = (form: LotFormState) => {
    const payload = {
      demand_type_id: form.demand_type_id,
      name: form.name,
      initial_quantity: Number(form.initial_quantity),
      unit: form.unit,
      supplier: form.supplier || null,
      lot_date: form.lot_date || null,
      notes: form.notes || null,
      responsible_technician_id: form.responsible_technician_id || null,
    };
    if (editing) {
      updateLot.mutate({ id: editing.id, ...payload });
    } else {
      createLot.mutate(payload);
    }
    setEditing(null);
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards by type */}
      {summaryByType.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaryByType.map((s, idx) => {
            const color = TYPE_COLORS[idx % TYPE_COLORS.length];
            const pctFin = s.total > 0 ? Math.round((s.finalized / s.total) * 100) : 0;
            const pctRes = s.total > 0 ? Math.round((s.reserved  / s.total) * 100) : 0;
            return (
              <Card key={s.id} className={cn('border', color.border)}>
                <CardContent className={cn('p-4', color.bg)}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className={cn('font-semibold text-sm truncate', color.text)}>{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.count} lote{s.count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className={cn('p-2 rounded-lg', color.bg)}>
                      <Warehouse className={cn('h-4 w-4', color.text)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{s.total.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-400">Finalizado</span>
                      <span className="font-medium text-emerald-600">{s.finalized.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-600">Reservado</span>
                      <span className="font-medium text-amber-600">{s.reserved.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Disponível</span>
                      <span className={s.remaining > 0 ? 'text-success' : 'text-destructive'}>
                        {s.remaining.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </span>
                    </div>
                    <Progress value={pctFin} className="h-1 mt-1 [&>div]:bg-emerald-500" />
                    <Progress value={pctRes} className="h-1 [&>div]:bg-amber-500" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter + New Lot button */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todos os tipos</option>
          {demandTypes.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <Button
          className="gap-1.5 ml-auto"
          onClick={() => { setEditing(null); setFormOpen(true); }}
        >
          <Plus className="h-4 w-4" /> Novo Lote
        </Button>
      </div>

      {/* Lots list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Warehouse className="h-12 w-12 opacity-30" />
          <p className="text-sm">Nenhum lote cadastrado</p>
          <p className="text-xs text-center max-w-xs">
            Cadastre lotes de insumos para controlar o estoque e rastrear cada entrega.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((lot: any, idx: number) => {
            const remaining  = Number(lot.remaining_quantity  ?? 0);
            const finalized  = Number(lot.finalized_quantity  ?? 0);
            const reserved   = Number(lot.reserved_quantity   ?? 0);
            const total      = Number(lot.initial_quantity);
            const pctFin     = total > 0 ? Math.round((finalized / total) * 100) : 0;
            const pctRes     = total > 0 ? Math.round((reserved  / total) * 100) : 0;
            const depleted   = remaining <= 0;
            const color      = getTypeColor(lot.demand_type_id, demandTypes);
            const technician = (technicians as any[]).find((t: any) => t.id === lot.responsible_technician_id);

            return (
              <div
                key={lot.id}
                className={cn('rounded-xl border p-4 bg-card', color.border)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{lot.name}</span>
                      <Badge className={cn('text-xs', color.badge)} variant="secondary">
                        {lot.demand_type_name || '—'}
                      </Badge>
                      {depleted ? (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />Esgotado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-success border-success/30 bg-success/5">
                          Disponível
                        </Badge>
                      )}
                    </div>

                    {/* Quantities — 4 columns */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-bold text-sm tabular-nums">{total.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 p-2">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Finalizado</p>
                        <p className="font-bold text-sm tabular-nums text-emerald-600">{finalized.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2">
                        <p className="text-xs text-amber-600">Reservado</p>
                        <p className="font-bold text-sm tabular-nums text-amber-600">{reserved.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</p>
                      </div>
                      <div className={cn('rounded-lg p-2', depleted ? 'bg-destructive/10' : 'bg-success/10')}>
                        <p className="text-xs text-muted-foreground">Disponível</p>
                        <p className={cn('font-bold text-sm tabular-nums', depleted ? 'text-destructive' : 'text-success')}>
                          {remaining.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        </p>
                      </div>
                    </div>

                    {/* Progress bars — finalizado (green) + reservado (amber) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400">
                        <span>{lot.unit} · {pctFin}% finalizado</span>
                        {pctRes > 0 && <span className="text-amber-600">{pctRes}% reservado</span>}
                      </div>
                      <Progress value={pctFin} className="h-2 [&>div]:bg-emerald-500" />
                      {reserved > 0 && (
                        <Progress value={pctRes} className="h-1.5 [&>div]:bg-amber-500" />
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {technician && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          <strong>{technician.name}</strong>
                        </span>
                      )}
                      {lot.supplier && <span>Fornecedor: <strong>{lot.supplier}</strong></span>}
                      {lot.lot_date && (
                        <span>
                          Recebido:{' '}
                          <strong>
                            {format(new Date(lot.lot_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </strong>
                        </span>
                      )}
                    </div>
                    {lot.notes && (
                      <p className="text-xs text-muted-foreground border-t pt-1.5 line-clamp-2">{lot.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { setEditing(lot); setFormOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { setToDelete(lot); setDeleteOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <LotFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        demandTypes={demandTypes}
        technicians={technicians as any[]}
        editing={editing}
        onSubmit={handleSubmit}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remover Lote"
        description={`Remover o lote "${toDelete?.name}"? Esta ação não pode ser desfeita. O lote não pode ser removido se houver entregas vinculadas.`}
        onConfirm={() => {
          if (toDelete) {
            deleteLot.mutate(toDelete.id);
            setToDelete(null);
            setDeleteOpen(false);
          }
        }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </div>
  );
}

// ─── Form data type ───────────────────────────────────────────────────────────

interface DeliveryFormData {
  producer_id: string;
  demand_type_id: string;
  quantity: string;
  notes: string;
  delivery_date_start: string;
  delivery_date_end: string;
  finalize_now: boolean;
  completed_at: string;
}

const EMPTY_FORM: DeliveryFormData = {
  producer_id: '',
  demand_type_id: '',
  quantity: '',
  notes: '',
  delivery_date_start: '',
  delivery_date_end: '',
  finalize_now: false,
  completed_at: format(new Date(), 'yyyy-MM-dd'),
};

// ─── Mini stat card for statistics tab ───────────────────────────────────────

function MiniStatCard({
  title,
  value,
  icon: Icon,
  colorClass = 'bg-primary/10 text-primary',
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg shrink-0', colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-3">
      <p className="font-semibold text-foreground mb-1 text-sm">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Statistics tab ───────────────────────────────────────────────────────────

function DeliveryStats({
  deliveries,
  demandTypes,
  settlements,
}: {
  deliveries: any[];
  demandTypes: any[];
  settlements: any[];
}) {
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterSettlement, setFilterSettlement] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterProducer, setFilterProducer] = useState('');

  const GREEN = 'hsl(113 38% 26%)';
  const GREEN2 = 'hsl(142 55% 40%)';

  const completed = useMemo(
    () => deliveries.filter((d) => d.status === 'completed'),
    [deliveries],
  );

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const d of completed) {
      const raw = d.completed_at || d.created_at;
      if (raw) years.add(new Date(raw.replace(' ', 'T')).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [completed]);

  const filtered = useMemo(() => {
    return completed
      .filter((d) => {
        const raw = d.completed_at || d.created_at;
        const date = raw ? new Date(raw.replace(' ', 'T')) : null;
        if (filterYear !== 'all' && date?.getFullYear() !== parseInt(filterYear, 10)) return false;
        if (filterMonth !== 'all' && date && String(date.getMonth() + 1) !== filterMonth) return false;
        const settlementId = d.settlement_id || d.producers?.settlement_id;
        if (filterSettlement !== 'all' && settlementId !== filterSettlement) return false;
        if (filterType !== 'all' && d.demand_type_id !== filterType) return false;
        if (filterProducer) {
          const name = (d.producers?.name || '').toLowerCase();
          if (!name.includes(filterProducer.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aRaw = a.completed_at || a.created_at || '';
        const bRaw = b.completed_at || b.created_at || '';
        return new Date(bRaw.replace(' ', 'T')).getTime() - new Date(aRaw.replace(' ', 'T')).getTime();
      });
  }, [completed, filterYear, filterMonth, filterSettlement, filterType, filterProducer]);

  const totalCount = filtered.length;
  const totalQty = filtered.reduce((acc, d) => acc + (d.quantity || 0), 0);
  const uniqueProducers = new Set(filtered.map((d) => d.producer_id)).size;
  const uniqueSettlements = new Set(
    filtered.map((d) => d.settlement_id || d.producers?.settlement_id).filter(Boolean),
  ).size;

  const statsByType = useMemo(() => {
    const map: Record<string, { name: string; entregas: number; quantidade: number }> = {};
    filtered.forEach((d) => {
      const name = d.demand_types?.name || '—';
      if (!map[name]) map[name] = { name, entregas: 0, quantidade: 0 };
      map[name].entregas += 1;
      map[name].quantidade += Number(d.quantity || 0);
    });
    return Object.values(map).sort((a, b) => b.entregas - a.entregas);
  }, [filtered]);

  const barData = useMemo(() => {
    return statsByType.slice(0, 8).map((s) => ({ name: s.name, Entregas: s.entregas }));
  }, [statsByType]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = subMonths(now, 11 - i);
      const key = format(startOfMonth(monthDate), 'yyyy-MM');
      const label = format(monthDate, 'MMM/yy', { locale: ptBR });
      const count = completed.filter((d) => {
        const raw = d.completed_at || d.created_at;
        return raw && raw.startsWith(key);
      }).length;
      return { month: label.charAt(0).toUpperCase() + label.slice(1), entregas: count };
    });
  }, [completed]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os anos</option>
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os meses</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {format(new Date(2000, i, 1), 'MMMM', { locale: ptBR })}
            </option>
          ))}
        </select>
        <select value={filterSettlement} onChange={(e) => setFilterSettlement(e.target.value)} className="border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os assentamentos</option>
          {(settlements as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os tipos</option>
          {(demandTypes as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <Input
          placeholder="Filtrar por produtor..."
          value={filterProducer}
          onChange={(e) => setFilterProducer(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStatCard title="Entregas realizadas" value={totalCount} icon={Package} colorClass="bg-primary/10 text-primary" />
        <MiniStatCard title="Total de itens" value={totalQty.toLocaleString('pt-BR')} icon={Hash} colorClass="bg-blue-500/10 text-blue-600" />
        <MiniStatCard title="Produtores atendidos" value={uniqueProducers} icon={User} colorClass="bg-success/10 text-success" />
        <MiniStatCard title="Assentamentos" value={uniqueSettlements} icon={MapPin} colorClass="bg-amber-500/10 text-amber-600" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <TrendingUp className="h-10 w-10 opacity-30" />
          <p>Nenhuma entrega encontrada para os filtros selecionados</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {barData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Por tipo de entrega</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="Entregas" fill={GREEN} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Evolução mensal (12 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="entregas" name="Entregas" stroke={GREEN} fill="url(#delivGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* By type summary */}
          {statsByType.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {statsByType.map((typeData, idx) => {
                const color = TYPE_COLORS[idx % TYPE_COLORS.length];
                return (
                  <Card key={typeData.name} className={cn('border', color.border)}>
                    <CardContent className={cn('p-4', color.bg)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn('font-medium text-sm truncate', color.text)}>{typeData.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Tipo de entrega</p>
                        </div>
                        <Badge className={cn('text-xs shrink-0', color.badge)} variant="secondary">
                          {typeData.entregas}
                        </Badge>
                      </div>
                      {typeData.quantidade > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          Total: <span className="font-semibold text-foreground">
                            {typeData.quantidade.toLocaleString('pt-BR')} unidades
                          </span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Records table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Registros Individuais
                <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Produtor</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">CPF</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Assentamento</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">Tipo</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs">Qtd.</th>
                      <th className="text-right p-3 font-medium text-muted-foreground text-xs whitespace-nowrap">Realizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d: any) => {
                      const settlementName = d.settlements?.name || d.producers?.settlements?.name || '—';
                      const rawDate = d.completed_at || d.created_at;
                      const dateLabel = rawDate
                        ? (() => {
                            try { return format(new Date(rawDate.replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR }); }
                            catch { return '—'; }
                          })()
                        : '—';
                      const typeIdx = demandTypes.findIndex((dt: any) => dt.id === d.demand_type_id);
                      const color = TYPE_COLORS[typeIdx >= 0 ? typeIdx % TYPE_COLORS.length : 0];
                      return (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{d.producers?.name || '—'}</td>
                          <td className="p-3 text-muted-foreground hidden sm:table-cell text-xs tabular-nums">{d.producers?.cpf || '—'}</td>
                          <td className="p-3 text-muted-foreground hidden md:table-cell">{settlementName}</td>
                          <td className="p-3">
                            <Badge className={cn('text-xs whitespace-nowrap', color.badge)} variant="secondary">
                              {d.demand_types?.name || '—'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right tabular-nums">{d.quantity ?? '—'}</td>
                          <td className="p-3 text-right text-muted-foreground text-xs whitespace-nowrap">{dateLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabType = 'pending' | 'completed' | 'stats' | 'lots';

export default function DeliveriesPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { data: deliveries = [], isLoading } = useDeliveries();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const deleteDelivery = useDeleteDelivery();
  const saveDeliveryItems = useSaveDeliveryItems();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabType>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DeliveryFormData>(EMPTY_FORM);
  const [selectedLots, setSelectedLots] = useState<LotItem[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [realizeDialogOpen, setRealizeDialogOpen] = useState(false);
  const [realizeId, setRealizeId] = useState<string | null>(null);
  const [realizeName, setRealizeName] = useState('');
  const [realizeDate, setRealizeDate] = useState('');
  // Lotes expandidos na aba de pendentes (agrupamento por lote)
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());

  // Lots for selected demand type (in form)
  const { data: lotsForType = [], isLoading: lotsLoading } = useDeliveryLots(formData.demand_type_id || undefined);
  // Resumo de TODOS os lotes (reservado/restante) — para os cards de resumo por lote
  const { data: allLotsSummary = [] } = useDeliveryLots();
  // Existing items when editing
  const { data: editingItems = [] } = useDeliveryItems(editingId ?? undefined);

  // Pre-populate lots when editing
  useEffect(() => {
    if (editingId && (editingItems as any[]).length > 0) {
      setSelectedLots(
        (editingItems as any[]).map((item: any) => ({
          lot_id: item.lot_id,
          quantity: Number(item.quantity),
        })),
      );
    }
  }, [editingId, editingItems]);

  // Reset lot selection and manual quantity when demand type changes
  useEffect(() => {
    setSelectedLots([]);
    setFormData((f) => ({ ...f, quantity: '' }));
  }, [formData.demand_type_id]);

  // Auto-open edit form when ?detail=ID is in the URL (navigated from producer history)
  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId && (deliveries as any[]).length > 0) {
      const found = (deliveries as any[]).find((d) => d.id === detailId);
      if (found) {
        openEdit(found);
        // Switch to the right tab so the delivery is visible in the background
        setTab(found.status === 'completed' ? 'completed' : 'pending');
      }
    }
    // Only run when deliveries first load or URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, (deliveries as any[]).length]);


  // ── Derived data ─────────────────────────────────────────────────────────────

  const deliveryDemandTypes = useMemo(
    () => (demandTypes as any[]).filter((d) => d.category === 'entregas' && d.is_active !== false),
    [demandTypes],
  );

  const selectedProducer = useMemo(
    () => (producers as any[]).find((p) => p.id === formData.producer_id),
    [producers, formData.producer_id],
  );

  const isEditingCompleted = useMemo(
    () => editingId !== null && (deliveries as any[]).find((d) => d.id === editingId)?.status === 'completed',
    [editingId, deliveries],
  );

  const pendingCount = useMemo(
    () => (deliveries as any[]).filter((d) => !d.status || d.status === 'pending').length,
    [deliveries],
  );
  const completedCount = useMemo(
    () => (deliveries as any[]).filter((d) => d.status === 'completed').length,
    [deliveries],
  );

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return (deliveries as any[])
      .filter((d) => {
        const isPending = !d.status || d.status === 'pending';
        const matchesTab = tab === 'pending' ? isPending : d.status === 'completed';
        const matchesSearch =
          normalizeText(d.producers?.name).includes(q) ||
          normalizeText(d.demand_types?.name).includes(q);
        return matchesTab && matchesSearch;
      })
      .sort((a: any, b: any) => {
        const aDate = (tab === 'completed' ? a.completed_at : null) || a.created_at || '';
        const bDate = (tab === 'completed' ? b.completed_at : null) || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [deliveries, search, tab]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setSelectedLots([]);
    setFormOpen(true);
  };

  const openEdit = (d: any) => {
    setEditingId(d.id);
    setSelectedLots([]); // will be populated by useEffect
    setFormData({
      producer_id: d.producer_id || '',
      demand_type_id: d.demand_type_id || '',
      quantity: d.quantity != null ? String(d.quantity) : '',
      notes: d.notes || '',
      delivery_date_start: d.delivery_date_start ? d.delivery_date_start.slice(0, 10) : '',
      delivery_date_end: d.delivery_date_end ? d.delivery_date_end.slice(0, 10) : '',
      finalize_now: false,
      completed_at: d.completed_at ? d.completed_at.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
    });
    setFormOpen(true);
  };

  const openDelete = (d: any) => {
    setDeleteId(d.id);
    setDeleteName(d.producers?.name || 'esta entrega');
    setDeleteDialogOpen(true);
  };

  const openRealize = (d: any) => {
    setRealizeId(d.id);
    setRealizeName(d.producers?.name || 'este produtor');
    setRealizeDate(format(new Date(), 'yyyy-MM-dd'));
    setRealizeDialogOpen(true);
  };

  // Derived total quantity from lot selections (used as fallback if manual qty is empty)
  const lotsTotal = selectedLots.reduce((s, l) => s + (l.quantity || 0), 0);

  const handleSubmit = async () => {
    if (!formData.producer_id || !formData.demand_type_id) return;

    // Regra: um produtor não pode estar cadastrado duas vezes no MESMO lote.
    // Pode receber o mesmo tipo novamente em OUTRO lote (novo exercício/remessa).
    const producerLotIds = new Set<string>();
    (deliveries as any[]).forEach((d) => {
      if (d.producer_id !== formData.producer_id) return;
      if (editingId && d.id === editingId) return; // ignora a própria entrega em edição
      (d.delivery_items ?? []).forEach((it: any) => { if (it.lot_id) producerLotIds.add(it.lot_id); });
    });
    const conflitos = selectedLots.filter((l) => l.lot_id && producerLotIds.has(l.lot_id));
    if (conflitos.length > 0) {
      const nomes = conflitos
        .map((c) => (lotsForType as any[]).find((l) => l.id === c.lot_id)?.name || 'lote')
        .join(', ');
      toast({
        title: 'Produtor já cadastrado neste lote',
        description: `Este produtor já está registrado no(s) lote(s): ${nomes}. Edite a entrega existente desse lote em vez de cadastrar de novo.`,
        variant: 'destructive',
      });
      return;
    }

    const settlementId = selectedProducer?.settlement_id || null;
    const resolvedQty = formData.quantity ? Number(formData.quantity) : (lotsTotal > 0 ? lotsTotal : null);

    const payload: Record<string, unknown> = {
      producer_id: formData.producer_id,
      demand_type_id: formData.demand_type_id,
      settlement_id: settlementId,
      quantity: resolvedQty,
      notes: formData.notes || null,
      delivery_date_start: formData.delivery_date_start || null,
      delivery_date_end: formData.delivery_date_end || null,
    };

    const shouldFinalize = formData.finalize_now || isEditingCompleted;
    if (shouldFinalize) {
      payload.status = 'completed';
      payload.completed_at = formData.completed_at
        ? `${formData.completed_at}T12:00:00.000Z`
        : new Date().toISOString();
    }

    try {
      let deliveryId: string;
      if (editingId) {
        await updateDelivery.mutateAsync({ id: editingId, ...payload });
        deliveryId = editingId;
      } else {
        const result = await createDelivery.mutateAsync(payload as any);
        deliveryId = (result as any).id;
      }

      // Save lot items
      const validLots = selectedLots.filter((l) => l.lot_id && l.quantity > 0);
      if (validLots.length > 0 || editingId) {
        await saveDeliveryItems.mutateAsync({ deliveryId, items: validLots });
      }

      setFormOpen(false);
    } catch {
      // errors are handled by the mutation's onError
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteDelivery.mutate(deleteId);
      setDeleteId(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleRealize = () => {
    if (!realizeId) return;
    const completedAt = realizeDate ? `${realizeDate}T12:00:00.000Z` : new Date().toISOString();
    updateDelivery.mutate({ id: realizeId, status: 'completed', completed_at: completedAt });
    setRealizeId(null);
    setRealizeDialogOpen(false);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try { return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR }); }
    catch { return dateStr; }
  };

  const toggleLot = (id: string) =>
    setExpandedLots((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Agrupa as entregas (filtradas) por lote. Uma entrega em vários lotes aparece
  // em cada grupo; sem itens de lote → "Sem lote específico".
  const deliveriesByLot = useMemo(() => {
    const groups = new Map<string, { name: string; deliveries: any[] }>();
    (filtered as any[]).forEach((d) => {
      const items = (d.delivery_items ?? []) as any[];
      if (items.length === 0) {
        const g = groups.get('__none__') ?? { name: 'Sem lote específico', deliveries: [] };
        g.deliveries.push(d);
        groups.set('__none__', g);
      } else {
        const seen = new Set<string>();
        items.forEach((it) => {
          const key = it.lot_id || '__none__';
          if (seen.has(key)) return;
          seen.add(key);
          const name = it.delivery_lots?.name || 'Sem lote específico';
          const g = groups.get(key) ?? { name, deliveries: [] };
          g.deliveries.push(d);
          groups.set(key, g);
        });
      }
    });
    return Array.from(groups.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => (a.id === '__none__' ? 1 : b.id === '__none__' ? -1 : a.name.localeCompare(b.name, 'pt-BR')));
  }, [filtered]);

  // Resumo por lote: reservado/restante (da view) + assentamentos atendidos (todas as entregas)
  const lotSummaryById = useMemo(() => {
    const m = new Map<string, any>();
    (allLotsSummary as any[]).forEach((l) => m.set(l.id, l));
    return m;
  }, [allLotsSummary]);

  const lotSettlements = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (deliveries as any[]).forEach((d) => {
      const settName = d.settlements?.name || d.producers?.settlements?.name;
      if (!settName) return;
      (d.delivery_items ?? []).forEach((it: any) => {
        if (!it.lot_id) return;
        if (!m.has(it.lot_id)) m.set(it.lot_id, new Set());
        m.get(it.lot_id)!.add(settName);
      });
    });
    return m;
  }, [deliveries]);

  const fmtQty = (n: any) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  // Exporta os contatos (produtores) de um lote como .vcf para montar grupo no WhatsApp
  const exportLotContacts = (lotName: string, groupDeliveries: any[]) => {
    // Contatos únicos por produtor (evita repetição se o produtor tiver +1 entrega no lote)
    const seen = new Set<string>();
    const contatos: { name: string; phone: string | null }[] = [];
    groupDeliveries.forEach((d) => {
      const pid = d.producer_id;
      if (pid && seen.has(pid)) return;
      if (pid) seen.add(pid);
      // Prefixa o nome com o tipo de entrega (ex.: "ENTREGA DE ALEVINOS - Fulano")
      // para identificar facilmente os contatos ao montar o grupo.
      const prefixo = (d.demand_types?.name || '').trim().toUpperCase();
      const nomeProdutor = (d.producers?.name || '').trim();
      const nome = prefixo ? `${prefixo} - ${nomeProdutor}` : nomeProdutor;
      contatos.push({ name: nome, phone: d.producers?.phone || null });
    });
    const safeName = lotName.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'lote';
    const r = downloadVCard(contatos, `contatos-${safeName}.vcf`);
    if (r.exported === 0) {
      toast({
        title: 'Nenhum contato exportável',
        description: 'Os produtores deste lote não têm número de celular válido cadastrado.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: `${r.exported} contato(s) exportado(s)`,
        description: r.skipped > 0
          ? `${r.skipped} sem número válido foram ignorados. Importe o arquivo .vcf no celular e crie o grupo.`
          : 'Importe o arquivo .vcf no celular e crie o grupo no WhatsApp selecionando-os.',
      });
    }
  };

  const renderDeliveryCard = (d: any) => {
    const startDate = formatDate(d.delivery_date_start);
    const endDate = formatDate(d.delivery_date_end);
    const completedDate = d.completed_at ? formatDate(d.completed_at.slice(0, 10)) : null;
    const isCompleted = d.status === 'completed';
    const settlementLabel = d.settlements?.name || d.producers?.settlements?.name || null;
    const color = getTypeColor(d.demand_type_id, deliveryDemandTypes);

    return (
      <div
        key={d.id}
        className={cn(
          'rounded-xl border p-4 space-y-3 hover:shadow-sm transition-shadow',
          isCompleted ? 'border-success/30 bg-success/5' : cn('bg-card', color.border),
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color.dot)} />
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-sm">{d.producers?.name || '—'}</span>
            </div>
            <Badge
              variant="secondary"
              className={cn('text-xs', isCompleted ? 'bg-success/10 text-success border-success/20' : color.badge)}
            >
              {d.demand_types?.name || '—'}
            </Badge>
          </div>
          <div className="flex gap-1 shrink-0">
            {!isCompleted && (
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                title="Marcar como realizada"
                onClick={() => openRealize(d)}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(d)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remover"
              onClick={() => openDelete(d)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isCompleted && completedDate && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>Realizada em {completedDate}</span>
          </div>
        )}

        <div className="space-y-1.5 text-sm">
          {d.producers?.cpf && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">{d.producers.cpf}</span>
            </div>
          )}
          {d.producers?.phone && (
            <button
              type="button"
              onClick={() => openWhatsApp(d.producers.phone)}
              className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{d.producers.phone}</span>
            </button>
          )}
          {d.quantity != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span>Quantidade: <span className="text-foreground font-medium">{d.quantity}</span></span>
            </div>
          )}
          {(startDate || endDate) && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              <span>{startDate && endDate ? `${startDate} → ${endDate}` : startDate || endDate}</span>
            </div>
          )}
          {d.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t">{d.notes}</p>
          )}
        </div>

        {settlementLabel && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{settlementLabel}</span>
          </div>
        )}
      </div>
    );
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Entregas" description="Controle de entregas aos produtores" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const pageAction = tab === 'pending' || tab === 'completed'
    ? { label: 'Nova Entrega', onClick: openCreate, icon: <Plus className="h-4 w-4 mr-2" /> }
    : undefined;

  return (
    <AppLayout>
      <PageHeader
        title="Entregas"
        description="Controle de entregas aos produtores"
        action={pageAction}
      />

      {/* ── Tabs ── */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabType)}
        className="mb-4"
      >
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1 gap-1 px-2 sm:gap-1.5 sm:px-3">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Pendentes</span>
            <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded-full text-xs font-medium">
              {pendingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 gap-1 px-2 sm:gap-1.5 sm:px-3">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Realizadas</span>
            <span className="bg-success/20 text-success px-1.5 py-0.5 rounded-full text-xs font-medium">
              {completedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex-1 gap-1 px-2 sm:gap-1.5 sm:px-3">
            <BarChart2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Estatísticas</span>
          </TabsTrigger>
          <TabsTrigger value="lots" className="flex-1 gap-1 px-2 sm:gap-1.5 sm:px-3">
            <Warehouse className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Lotes</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Pending / Completed tab content ── */}
      {(tab === 'pending' || tab === 'completed') && (
        <>
          <div className="mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por produtor ou tipo..."
              className="max-w-sm"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Package className="h-12 w-12 opacity-30" />
              <p className="text-sm">
                {tab === 'pending' ? 'Nenhuma entrega pendente' : 'Nenhuma entrega realizada'}
              </p>
            </div>
          ) : tab === 'completed' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(renderDeliveryCard)}
            </div>
          ) : (
            /* Pendentes agrupadas por lote — cards de resumo clicáveis */
            <div className="space-y-3">
              {deliveriesByLot.map((group) => {
                const isOpen = expandedLots.has(group.id);
                const summary = group.id !== '__none__' ? lotSummaryById.get(group.id) : null;
                const settlementsList = group.id !== '__none__'
                  ? Array.from(lotSettlements.get(group.id) ?? []).sort((a, b) => a.localeCompare(b, 'pt-BR'))
                  : [];
                const unit = summary?.unit || 'un';
                return (
                  <div key={group.id} className="rounded-xl border bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleLot(group.id)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Layers className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm truncate">{group.name}</span>
                          <Badge variant="secondary" className="shrink-0">
                            {group.deliveries.length} pendente{group.deliveries.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        {summary && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pl-6 text-xs">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Warehouse className="h-3 w-3" />
                              Inicial: <span className="font-medium text-foreground">{fmtQty(summary.initial_quantity)} {unit}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <Box className="h-3 w-3" />
                              Reservado: <span className="font-semibold">{fmtQty(summary.reserved_quantity)} {unit}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <TrendingUp className="h-3 w-3" />
                              Restante: <span className="font-semibold">{fmtQty(summary.remaining_quantity)} {unit}</span>
                            </span>
                          </div>
                        )}
                        {settlementsList.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 pl-6 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>
                              <span className="font-medium text-foreground">{settlementsList.length}</span>{' '}
                              {settlementsList.length === 1 ? 'assentamento atendido' : 'assentamentos atendidos'}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronDown
                        className={cn('h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform', isOpen && 'rotate-180')}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t bg-muted/20">
                        <div className="flex justify-end px-3 pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => exportLotContacts(group.name, group.deliveries)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Exportar contatos (WhatsApp)
                          </Button>
                        </div>
                        <div className="p-3 grid gap-3 sm:grid-cols-2">
                          {group.deliveries.map(renderDeliveryCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Statistics tab ── */}
      {tab === 'stats' && (
        <DeliveryStats
          deliveries={deliveries as any[]}
          demandTypes={deliveryDemandTypes}
          settlements={settlements as any[]}
        />
      )}

      {/* ── Lots tab ── */}
      {tab === 'lots' && (
        <LotsTab demandTypes={deliveryDemandTypes} />
      )}

      {/* ── Delivery Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Entrega' : 'Nova Entrega'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Producer */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Produtor *</label>
              <ProducerCombobox
                producers={producers as any[]}
                value={formData.producer_id}
                onChange={(v) => setFormData((f) => ({ ...f, producer_id: v }))}
              />
            </div>

            {/* Producer summary card */}
            {selectedProducer && (
              <div className="p-3 rounded-lg bg-muted/60 border text-sm space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Dados do Produtor
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {selectedProducer.cpf && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5 shrink-0" />
                      <span className="tabular-nums text-xs">{selectedProducer.cpf}</span>
                    </div>
                  )}
                  {selectedProducer.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">{selectedProducer.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">
                      <strong>Assentamento:</strong>{' '}
                      {selectedProducer.settlements?.name || '—'}
                    </span>
                  </div>
                  {(selectedProducer.locations?.name || selectedProducer.location_name) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 opacity-0" />
                      <span className="text-xs">
                        <strong>Localidade:</strong>{' '}
                        {selectedProducer.locations?.name || selectedProducer.location_name}
                      </span>
                    </div>
                  )}
                </div>
                {selectedProducer.settlements?.name && (
                  <p className="text-xs text-muted-foreground/70 border-t pt-1.5">
                    Assentamento vinculado automaticamente ao produtor
                  </p>
                )}
              </div>
            )}

            {/* Demand type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de Entrega *</label>
              <Select
                value={formData.demand_type_id}
                onValueChange={(v) => setFormData((f) => ({ ...f, demand_type_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryDemandTypes.map((d: any) => {
                    const color = getTypeColor(d.id, deliveryDemandTypes);
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
                          {d.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Lot picker — shown when demand type selected and lots exist */}
            {formData.demand_type_id && (lotsForType as any[]).length > 0 && (
              <LotPicker
                lots={lotsForType as any[]}
                selectedLots={selectedLots}
                onChange={setSelectedLots}
              />
            )}

            {/* Manual quantity — shown when demand type selected but no lots exist for it */}
            {formData.demand_type_id && !lotsLoading && (lotsForType as any[]).length === 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  Quantidade
                </label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Informe a quantidade entregue"
                  value={formData.quantity}
                  onChange={(e) => setFormData((f) => ({ ...f, quantity: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Este tipo de entrega não possui lotes cadastrados. Informe a quantidade manualmente ou crie um lote na aba <strong>Lotes</strong>.
                </p>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data Início</label>
                <Input
                  type="date"
                  value={formData.delivery_date_start}
                  onChange={(e) => setFormData((f) => ({ ...f, delivery_date_start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data Fim</label>
                <Input
                  type="date"
                  value={formData.delivery_date_end}
                  onChange={(e) => setFormData((f) => ({ ...f, delivery_date_end: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                placeholder="Informações adicionais..."
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <Separator />

            {/* Finalization section */}
            {!isEditingCompleted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="finalize_now"
                    checked={formData.finalize_now}
                    onCheckedChange={(checked) =>
                      setFormData((f) => ({
                        ...f,
                        finalize_now: !!checked,
                        completed_at: !!checked && !f.completed_at ? format(new Date(), 'yyyy-MM-dd') : f.completed_at,
                      }))
                    }
                  />
                  <label htmlFor="finalize_now" className="text-sm font-medium cursor-pointer select-none flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-success" />
                    Finalizar entrega agora
                  </label>
                </div>
                {formData.finalize_now && (
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="completed-at-new">Data de Realização</Label>
                    <Input
                      id="completed-at-new"
                      type="date"
                      value={formData.completed_at}
                      onChange={(e) => setFormData((f) => ({ ...f, completed_at: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="completed-at-edit" className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Data de Realização
                </Label>
                <Input
                  id="completed-at-edit"
                  type="date"
                  value={formData.completed_at}
                  onChange={(e) => setFormData((f) => ({ ...f, completed_at: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.producer_id || !formData.demand_type_id || createDelivery.isPending || updateDelivery.isPending}
            >
              {editingId ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Realize dialog ── */}
      <Dialog open={realizeDialogOpen} onOpenChange={setRealizeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como Realizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Confirmar entrega para <strong>{realizeName}</strong>?
            </p>
            <div className="space-y-1.5">
              <Label>Data de Realização</Label>
              <Input
                type="date"
                value={realizeDate}
                onChange={(e) => setRealizeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRealizeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRealize} className="gap-1.5">
              <CheckCircle className="h-4 w-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover Entrega"
        description={`Remover entrega de "${deleteName}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmLabel="Remover"
        variant="destructive"
      />
    </AppLayout>
  );
}
