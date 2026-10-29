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
  Paperclip,
  FileText,
} from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { normalizeText, phoneMatches } from '@/lib/text';
import { openWhatsApp } from '@/lib/phone';
import { downloadVCard } from '@/lib/vcard';
import { getUserColorClass } from '@/lib/userColors';
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
  useTermosEntrega,
  type TermoEntrega,
} from '@/hooks/useSupabaseData';
import { TermoEntregaDialog } from '@/components/entregas/TermoEntregaDialog';
import { baixarTermoPdf } from '@/lib/termoEntregaPdf';

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
        phoneMatches(p.phone, searchTerm),
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
                    <p className="min-w-0 text-sm font-medium break-words">{lot.name}</p>
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

// ─── Outro tipo de entrega no mesmo cadastro ─────────────────────────────────
// Só facilita o cadastro: cada tipo vira uma ENTREGA SEPARADA (mesmo produtor,
// datas, observações e finalização), igual a cadastrar uma por vez.

interface EntregaExtra { key: string; demand_type_id: string; quantity: string; lots: LotItem[] }

function EntregaAdicional({
  item, numero, tipos, onChange, onRemove,
}: {
  item: EntregaExtra;
  numero: number;
  tipos: any[];
  onChange: (item: EntregaExtra) => void;
  onRemove: () => void;
}) {
  const { data: lots = [], isLoading } = useDeliveryLots(item.demand_type_id || undefined);
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Entrega {numero}</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" /> Remover
        </Button>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Tipo de Entrega *</label>
        <Select
          value={item.demand_type_id}
          onValueChange={(v) => onChange({ ...item, demand_type_id: v, lots: [], quantity: '' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {tipos.map((d: any) => {
              const color = getTypeColor(d.id, tipos);
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
      {item.demand_type_id && (lots as any[]).length > 0 && (
        <LotPicker lots={lots as any[]} selectedLots={item.lots} onChange={(l) => onChange({ ...item, lots: l })} />
      )}
      {item.demand_type_id && !isLoading && (lots as any[]).length === 0 && (
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
            value={item.quantity}
            onChange={(e) => onChange({ ...item, quantity: e.target.value })}
          />
        </div>
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
  /** Termo de compromisso pelo modelo padrão (só o objeto muda). */
  usa_termo_padrao: boolean;
  termo_objeto: string;
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
  usa_termo_padrao: false,
  termo_objeto: '',
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
              usa_termo_padrao: editing.usa_termo_padrao === true,
              termo_objeto: editing.termo_objeto || '',
            }
          : EMPTY_LOT,
      );
    }
  }, [open, editing]);

  const valid = form.demand_type_id && form.name && form.initial_quantity && Number(form.initial_quantity) > 0
    && (!form.usa_termo_padrao || form.termo_objeto.trim().length > 0);

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
          {/* Termo de compromisso pelo modelo padrão */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={form.usa_termo_padrao}
                onCheckedChange={(v) => setForm((f) => ({ ...f, usa_termo_padrao: v === true }))}
                className="mt-0.5"
              />
              <span className="text-sm">
                Usar modelo padrão de termo
                <span className="block text-xs text-muted-foreground">
                  Permite gerar, para cada produtor, o termo de compromisso com os dados dele e a quantidade. Só o objeto muda.
                </span>
              </span>
            </label>
            {form.usa_termo_padrao && (
              <div className="space-y-1.5">
                <Label>Objeto do termo *</Label>
                <Input
                  placeholder="Ex.: mudas de açaí"
                  value={form.termo_objeto}
                  onChange={(e) => setForm((f) => ({ ...f, termo_objeto: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Aparece no título ("Termo de compromisso de entrega e uso de …") e na quantidade ("Serão entregues 50 …").
                </p>
              </div>
            )}
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

const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
/** Unidade no plural quando faz sentido ("80 unidades", "1 unidade"); demais como cadastradas. */
const unidadeTxt = (qtd: number, unit?: string | null) =>
  unit === 'unidade' ? (Number(qtd) === 1 ? 'unidade' : 'unidades') : (unit || '');

/** Barra única do estoque do lote: entregue (verde) · reservado (âmbar) · disponível (cinza). */
function StockBar({ total, finalized, reserved, className }: { total: number; finalized: number; reserved: number; className?: string }) {
  const pct = (v: number) => (total > 0 ? Math.min(100, Math.max(0, (v / total) * 100)) : 0);
  const pFin = pct(finalized);
  const pRes = Math.min(100 - pFin, pct(reserved));
  return (
    <div className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full bg-emerald-500" style={{ width: `${pFin}%` }} />
      <div className="h-full bg-amber-400" style={{ width: `${pRes}%` }} />
    </div>
  );
}

function StockLegend({ finalized, reserved, remaining, unit }: { finalized: number; reserved: number; remaining: number; unit?: string }) {
  const u = (v: number) => (unit ? ` ${unidadeTxt(v, unit)}` : '');
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />Entregue <strong className="text-foreground tabular-nums">{fmtNum(finalized)}{u(finalized)}</strong>
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-amber-400" />Reservado <strong className="text-foreground tabular-nums">{fmtNum(reserved)}{u(reserved)}</strong>
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />Disponível{' '}
        <strong className={cn('tabular-nums', remaining > 0 ? 'text-success' : 'text-destructive')}>{fmtNum(remaining)}{u(remaining)}</strong>
      </span>
    </div>
  );
}

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
  // Situação: todos, com saldo (disponível > 0) ou esgotados.
  const [situacao, setSituacao] = useState<'all' | 'saldo' | 'esgotado'>('all');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const lots = (allLots as any[]);

  const displayed = useMemo(() =>
    lots.filter((l: any) => {
      if (filterType !== 'all' && l.demand_type_id !== filterType) return false;
      const rem = Number(l.remaining_quantity ?? 0);
      if (situacao === 'saldo' && rem <= 0) return false;
      if (situacao === 'esgotado' && rem > 0) return false;
      return true;
    }),
    [lots, filterType, situacao],
  );

  // Lotes agrupados pelo tipo de entrega (seções), mais recentes primeiro.
  const porTipo = useMemo(() => {
    const map = new Map<string, { id: string; name: string; lots: any[] }>();
    displayed.forEach((l: any) => {
      const g = map.get(l.demand_type_id) ?? { id: l.demand_type_id, name: l.demand_type_name || '—', lots: [] };
      g.lots.push(l);
      map.set(l.demand_type_id, g);
    });
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        lots: g.lots.sort((a, b) => String(b.lot_date || '').localeCompare(String(a.lot_date || ''))),
        total: g.lots.reduce((s, l) => s + Number(l.initial_quantity || 0), 0),
        finalized: g.lots.reduce((s, l) => s + Number(l.finalized_quantity || 0), 0),
        reserved: g.lots.reduce((s, l) => s + Number(l.reserved_quantity || 0), 0),
        remaining: g.lots.reduce((s, l) => s + Number(l.remaining_quantity || 0), 0),
        units: Array.from(new Set(g.lots.map((l) => l.unit).filter(Boolean))) as string[],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [displayed]);

  const contagem = useMemo(() => ({
    total: lots.length,
    saldo: lots.filter((l: any) => Number(l.remaining_quantity ?? 0) > 0).length,
    esgotado: lots.filter((l: any) => Number(l.remaining_quantity ?? 0) <= 0).length,
  }), [lots]);

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
      usa_termo_padrao: form.usa_termo_padrao,
      termo_objeto: form.usa_termo_padrao ? form.termo_objeto.trim() : (editing?.termo_objeto ?? null),
    };
    if (editing) {
      updateLot.mutate({ id: editing.id, ...payload });
    } else {
      createLot.mutate(payload);
    }
    setEditing(null);
  };

  const alternar = (id: string) => setAbertos((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Barra de ferramentas: tipo · situação · novo lote */}
      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="min-w-0 flex-1 sm:flex-none border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todos os tipos</option>
            {demandTypes.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <Button
            className="gap-1.5 sm:ml-auto"
            onClick={() => { setEditing(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4" /> Novo Lote
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['all', `Todos (${contagem.total})`],
            ['saldo', `Com saldo (${contagem.saldo})`],
            ['esgotado', `Esgotados (${contagem.esgotado})`],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setSituacao(v)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                situacao === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="font-medium">Como ler a barra:</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />entregue</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />reservado (pendente)</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />disponível</span>
        </div>
      </div>

      {porTipo.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Warehouse className="h-12 w-12 opacity-30" />
          <p className="text-sm">{lots.length === 0 ? 'Nenhum lote cadastrado' : 'Nenhum lote neste filtro'}</p>
          {lots.length === 0 && (
            <p className="text-xs text-center max-w-xs">
              Cadastre lotes de insumos para controlar o estoque e rastrear cada entrega.
            </p>
          )}
        </div>
      ) : (
        porTipo.map((g) => {
          const color = getTypeColor(g.id, demandTypes);
          const unidade = g.units.length === 1 ? g.units[0] : undefined;
          return (
            <section key={g.id} className="space-y-2.5">
              {/* Cabeçalho da seção: tipo + resumo do estoque somado */}
              <div className={cn('rounded-xl border p-3', color.border, color.bg)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', color.dot)} />
                    <h3 className={cn('text-sm font-semibold break-words', color.text)}>{g.name}</h3>
                    <span className="text-xs text-muted-foreground shrink-0">· {g.lots.length} lote{g.lots.length !== 1 ? 's' : ''}</span>
                  </div>
                  {unidade && g.lots.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      Total <strong className="text-foreground tabular-nums">{fmtNum(g.total)} {unidadeTxt(g.total, unidade)}</strong>
                    </span>
                  )}
                </div>
                {unidade && g.lots.length > 1 && (
                  <div className="mt-2 space-y-1.5">
                    <StockBar total={g.total} finalized={g.finalized} reserved={g.reserved} />
                    <StockLegend finalized={g.finalized} reserved={g.reserved} remaining={g.remaining} unit={unidade} />
                  </div>
                )}
              </div>

              {/* Lotes do tipo */}
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {g.lots.map((lot: any) => {
                  const remaining = Number(lot.remaining_quantity ?? 0);
                  const finalized = Number(lot.finalized_quantity ?? 0);
                  const reserved = Number(lot.reserved_quantity ?? 0);
                  const total = Number(lot.initial_quantity);
                  const pctFin = total > 0 ? Math.round((finalized / total) * 100) : 0;
                  const depleted = remaining <= 0;
                  const technician = (technicians as any[]).find((t: any) => t.id === lot.responsible_technician_id);
                  const aberto = abertos.has(lot.id);
                  const temDetalhes = !!(technician || lot.supplier || lot.lot_date || lot.notes || lot.usa_termo_padrao);
                  return (
                    <div key={lot.id} className="rounded-xl border bg-card p-3.5 space-y-2.5">
                      {/* Nome + situação + ações */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug break-words">{lot.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmtNum(total)} {unidadeTxt(total, lot.unit)}
                            {lot.lot_date && <> · recebido em {format(new Date(lot.lot_date + 'T12:00:00'), 'dd/MM/yyyy')}</>}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {depleted ? (
                            <Badge variant="destructive" className="text-[11px] gap-1 mr-1">
                              <AlertTriangle className="h-3 w-3" />Esgotado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] mr-1 text-success border-success/30 bg-success/5">
                              Com saldo
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar lote"
                            onClick={() => { setEditing(lot); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remover lote"
                            onClick={() => { setToDelete(lot); setDeleteOpen(true); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Estoque: barra única + legenda */}
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-muted-foreground">Andamento</span>
                          <span className="font-semibold tabular-nums">{pctFin}% entregue</span>
                        </div>
                        <StockBar total={total} finalized={finalized} reserved={reserved} />
                        <StockLegend finalized={finalized} reserved={reserved} remaining={remaining} unit={lot.unit} />
                      </div>

                      {/* Detalhes (recolhidos para não poluir) */}
                      {temDetalhes && (
                        <div className="border-t pt-2">
                          <button
                            type="button"
                            onClick={() => alternar(lot.id)}
                            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Detalhes do lote
                            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', aberto && 'rotate-180')} />
                          </button>
                          {aberto && (
                            <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                              {technician && (<><dt className="text-muted-foreground">Responsável</dt><dd className="font-medium break-words">{technician.name}</dd></>)}
                              {lot.supplier && (<><dt className="text-muted-foreground">Fornecedor</dt><dd className="font-medium break-words">{lot.supplier}</dd></>)}
                              {lot.lot_date && (<><dt className="text-muted-foreground">Recebido</dt><dd className="font-medium">{format(new Date(lot.lot_date + 'T12:00:00'), 'dd/MM/yyyy')}</dd></>)}
                              {lot.usa_termo_padrao && (<><dt className="text-muted-foreground">Termo</dt><dd className="font-medium break-words">Modelo padrão{lot.termo_objeto ? ` — ${lot.termo_objeto}` : ''}</dd></>)}
                              {lot.notes && (<><dt className="text-muted-foreground">Observações</dt><dd className="break-words">{lot.notes}</dd></>)}
                            </dl>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
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

/** Cartão de número em destaque (estatísticas). */
function KpiCard({ title, value, hint, icon: Icon, tone }: {
  title: string; value: number | string; hint?: string; icon: React.ElementType;
  tone: 'green' | 'blue' | 'amber' | 'violet';
}) {
  const tones = {
    green: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/25 text-emerald-700 dark:text-emerald-400',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/25 text-blue-700 dark:text-blue-400',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/25 text-amber-700 dark:text-amber-400',
    violet: 'from-violet-500/15 to-violet-500/5 border-violet-500/25 text-violet-700 dark:text-violet-400',
  } as const;
  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br p-4', tones[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium leading-tight">{title}</p>
        <span className="rounded-lg bg-background/70 p-1.5"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-3xl font-bold leading-none tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground leading-tight">{hint}</p>}
    </div>
  );
}

const STATS_BAR_COLORS = ['#2f6b2a', '#2563eb', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#ea580c', '#4f46e5'];

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
  const [verRegistros, setVerRegistros] = useState(false);

  const GREEN = 'hsl(113 38% 26%)';

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

  const temFiltro = filterYear !== 'all' || filterMonth !== 'all' || filterSettlement !== 'all' || filterType !== 'all' || !!filterProducer;
  const limpar = () => { setFilterYear('all'); setFilterMonth('all'); setFilterSettlement('all'); setFilterType('all'); setFilterProducer(''); };

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

  const porAssentamento = useMemo(() => {
    const map = new Map<string, { name: string; entregas: number; pessoas: Set<string> }>();
    filtered.forEach((d) => {
      const name = d.settlements?.name || d.producers?.settlements?.name || 'Sem assentamento';
      const g = map.get(name) ?? { name, entregas: 0, pessoas: new Set<string>() };
      g.entregas += 1;
      if (d.producer_id) g.pessoas.add(d.producer_id);
      map.set(name, g);
    });
    return Array.from(map.values()).sort((a, b) => b.entregas - a.entregas);
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = subMonths(now, 11 - i);
      const key = format(startOfMonth(monthDate), 'yyyy-MM');
      const label = format(monthDate, 'MMM/yy', { locale: ptBR });
      const count = filtered.filter((d) => {
        const raw = d.completed_at || d.created_at;
        return raw && raw.startsWith(key);
      }).length;
      return { month: label.charAt(0).toUpperCase() + label.slice(1), entregas: count };
    });
  }, [filtered]);

  const melhorMes = monthlyData.reduce((m, x) => (x.entregas > m.entregas ? x : m), { month: '', entregas: 0 });
  const ultima = filtered[0];
  const ultimaData = ultima ? formatStatDate(ultima.completed_at || ultima.created_at) : null;

  const selectCls = 'w-full border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Filtros</p>
          {temFiltro && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limpar}>Limpar filtros</Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectCls}>
            <option value="all">Todos os anos</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={selectCls}>
            <option value="all">Todos os meses</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {format(new Date(2000, i, 1), 'MMMM', { locale: ptBR })}
              </option>
            ))}
          </select>
          <select value={filterSettlement} onChange={(e) => setFilterSettlement(e.target.value)} className={selectCls}>
            <option value="all">Todos os assentamentos</option>
            {(settlements as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
            <option value="all">Todos os tipos</option>
            {(demandTypes as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Input
            placeholder="Filtrar por produtor..."
            value={filterProducer}
            onChange={(e) => setFilterProducer(e.target.value)}
            className="col-span-2 h-9 lg:col-span-1"
          />
        </div>
      </div>

      {/* Números principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard tone="green" title="Entregas realizadas" value={totalCount} icon={Package}
          hint={ultimaData ? `Última em ${ultimaData}` : undefined} />
        <KpiCard tone="blue" title="Itens entregues" value={totalQty.toLocaleString('pt-BR')} icon={Hash}
          hint={totalCount > 0 ? `Média de ${(totalQty / totalCount).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por entrega` : undefined} />
        <KpiCard tone="amber" title="Produtores atendidos" value={uniqueProducers} icon={User}
          hint={uniqueProducers > 0 ? `${(totalCount / uniqueProducers).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} entrega(s) por produtor` : undefined} />
        <KpiCard tone="violet" title="Assentamentos" value={uniqueSettlements} icon={MapPin}
          hint={porAssentamento[0] ? `Mais atendido: ${porAssentamento[0].name}` : undefined} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <TrendingUp className="h-10 w-10 opacity-30" />
          <p>Nenhuma entrega encontrada para os filtros selecionados</p>
        </div>
      ) : (
        <>
          {/* Destaques */}
          <div className="flex flex-wrap gap-2">
            {statsByType[0] && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs">
                🏆 Tipo mais entregue: <strong>{statsByType[0].name}</strong> ({statsByType[0].entregas})
              </span>
            )}
            {melhorMes.entregas > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs">
                📅 Mês com mais entregas: <strong>{melhorMes.month}</strong> ({melhorMes.entregas})
              </span>
            )}
            {porAssentamento[0] && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs">
                📍 Assentamento com mais entregas: <strong>{porAssentamento[0].name}</strong> ({porAssentamento[0].entregas})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Evolução mensal */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Entregas por mês</CardTitle>
                <p className="text-xs text-muted-foreground">Últimos 12 meses (com os filtros)</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="entregas" name="Entregas" stroke={GREEN} fill="url(#delivGrad)" strokeWidth={2.5} dot={{ r: 2.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Por tipo — barras horizontais coloridas */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Por tipo de entrega</CardTitle>
                <p className="text-xs text-muted-foreground">Quantidade de entregas de cada tipo</p>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                {statsByType.map((t, i) => {
                  const pct = statsByType[0].entregas > 0 ? (t.entregas / statsByType[0].entregas) * 100 : 0;
                  return (
                    <div key={t.name} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 break-words font-medium">{t.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          <strong className="text-foreground">{t.entregas}</strong> entrega{t.entregas !== 1 ? 's' : ''}
                          {t.quantidade > 0 && <> · {t.quantidade.toLocaleString('pt-BR')} itens</>}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STATS_BAR_COLORS[i % STATS_BAR_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Assentamentos — ranking */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">Assentamentos atendidos</CardTitle>
              <p className="text-xs text-muted-foreground">Entregas e pessoas atendidas em cada assentamento</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2.5 pt-2 md:grid-cols-2">
              {porAssentamento.slice(0, 12).map((a, i) => {
                const pct = porAssentamento[0].entregas > 0 ? (a.entregas / porAssentamento[0].entregas) * 100 : 0;
                return (
                  <div key={a.name} className="flex items-center gap-2.5">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      i === 0 ? 'bg-amber-400 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-300 text-orange-900' : 'bg-muted text-muted-foreground',
                    )}>{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 break-words font-medium">{a.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          <strong className="text-foreground">{a.entregas}</strong> · {a.pessoas.size} pessoa{a.pessoas.size !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {porAssentamento.length > 12 && (
                <p className="text-xs text-muted-foreground md:col-span-2">
                  E mais {porAssentamento.length - 12} assentamento(s).
                </p>
              )}
            </CardContent>
          </Card>

          {/* Registros individuais — recolhidos por padrão */}
          <Card className="rounded-2xl">
            <button
              type="button"
              onClick={() => setVerRegistros((v) => !v)}
              className="flex w-full items-center justify-between gap-2 p-4 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" />
                Registros individuais
                <Badge variant="secondary">{filtered.length}</Badge>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {verRegistros ? 'Ocultar' : 'Mostrar'}
                <ChevronDown className={cn('h-4 w-4 transition-transform', verRegistros && 'rotate-180')} />
              </span>
            </button>
            {verRegistros && (
              <CardContent className="p-0 border-t">
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
                        const dateLabel = formatStatDate(d.completed_at || d.created_at) ?? '—';
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
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function formatStatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try { return format(new Date(String(raw).replace(' ', 'T')), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return null; }
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
  // Termo / comprovante de entrega anexado (por entrega = por produtor)
  const { data: termos = [] } = useTermosEntrega();
  const termosPorEntrega = useMemo(() => {
    const m = new Map<string, TermoEntrega[]>();
    termos.forEach((t) => { const l = m.get(t.delivery_id) ?? []; l.push(t); m.set(t.delivery_id, l); });
    return m;
  }, [termos]);
  const [termoDe, setTermoDe] = useState<any | null>(null);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabType>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DeliveryFormData>(EMPTY_FORM);
  const [selectedLots, setSelectedLots] = useState<LotItem[]>([]);
  // Outros tipos no mesmo cadastro (só em "Nova Entrega") — cada um vira uma entrega.
  const [extras, setExtras] = useState<EntregaExtra[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [realizeDialogOpen, setRealizeDialogOpen] = useState(false);
  const [realizeId, setRealizeId] = useState<string | null>(null);
  const [realizeName, setRealizeName] = useState('');
  const [realizeDate, setRealizeDate] = useState('');
  // Lotes expandidos na aba de pendentes (agrupamento por lote)
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  // Realizadas: agrupar por lote (padrão — mostra quando cada lote foi fechado) ou por tipo.
  const [agruparRealizadas, setAgruparRealizadas] = useState<'lote' | 'tipo'>('lote');

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
          normalizeText(d.demand_types?.name).includes(q) ||
          d.producers?.cpf?.includes(search) ||
          phoneMatches(d.producers?.phone, search);
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
    setExtras([]);
    setFormOpen(true);
  };

  const openEdit = (d: any) => {
    setEditingId(d.id);
    setSelectedLots([]); // will be populated by useEffect
    setExtras([]);
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
    const extrasAtivas = editingId ? [] : extras;
    if (extrasAtivas.some((x) => !x.demand_type_id)) {
      toast({ title: 'Selecione o tipo de cada entrega', description: 'Ou remova a entrega adicional que ficou sem tipo.', variant: 'destructive' });
      return;
    }
    // O mesmo lote não pode aparecer em duas entregas do mesmo cadastro.
    const todosLotes = [...selectedLots, ...extrasAtivas.flatMap((x) => x.lots)].filter((l) => l.lot_id);
    const repetidos = todosLotes.filter((l, i) => todosLotes.findIndex((o) => o.lot_id === l.lot_id) !== i);
    const nomeLote = (id: string) =>
      ((lotsForType as any[]).find((l) => l.id === id) ?? (allLotsSummary as any[]).find((l) => l.id === id))?.name || 'lote';
    if (repetidos.length > 0) {
      toast({
        title: 'Lote repetido no cadastro',
        description: `O lote ${nomeLote(repetidos[0].lot_id)} foi escolhido em mais de uma entrega. Use um lote por entrega.`,
        variant: 'destructive',
      });
      return;
    }
    const conflitos = todosLotes.filter((l) => producerLotIds.has(l.lot_id));
    if (conflitos.length > 0) {
      const nomes = conflitos
        .map((c) => nomeLote(c.lot_id))
        .join(', ');
      toast({
        title: 'Produtor já cadastrado neste lote',
        description: `Este produtor já está registrado no(s) lote(s): ${nomes}. Edite a entrega existente desse lote em vez de cadastrar de novo.`,
        variant: 'destructive',
      });
      return;
    }

    const settlementId = selectedProducer?.settlement_id || null;
    // Quando há lotes selecionados, o total dos lotes é a fonte da verdade da
    // quantidade da entrega. O campo manual pode estar com valor antigo ao editar
    // duas entregas do mesmo tipo em sequência (efeito que o limpa só dispara
    // quando o tipo muda), o que fazia o card não atualizar. Sem lotes, usa o manual.
    const resolvedQty = lotsTotal > 0 ? lotsTotal : (formData.quantity ? Number(formData.quantity) : null);

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

    // Evita cadastro duplicado por duplo clique.
    if (salvando) return;
    setSalvando(true);
    let criadas = 0;
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
      criadas = 1;

      // Outros tipos do mesmo cadastro: uma entrega para cada (mesmos dados gerais).
      for (const x of extrasAtivas) {
        const lotesX = x.lots.filter((l) => l.lot_id && l.quantity > 0);
        const totalX = lotesX.reduce((acc, l) => acc + l.quantity, 0);
        const r = await createDelivery.mutateAsync({
          ...payload,
          demand_type_id: x.demand_type_id,
          quantity: totalX > 0 ? totalX : (x.quantity ? Number(x.quantity) : null),
        } as any);
        if (lotesX.length > 0) {
          await saveDeliveryItems.mutateAsync({ deliveryId: (r as any).id, items: lotesX });
        }
        criadas += 1;
      }

      setFormOpen(false);
    } catch {
      // errors are handled by the mutation's onError
      if (criadas > 0 && extrasAtivas.length > 0) {
        // Parte já foi salva: fecha para não cadastrar de novo ao tentar outra vez.
        toast({
          title: `${criadas} de ${extrasAtivas.length + 1} entregas cadastradas`,
          description: 'Confira a lista e cadastre a que faltou.',
          variant: 'destructive',
        });
        setFormOpen(false);
      }
    } finally {
      setSalvando(false);
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

  const toggleType = (id: string) =>
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Quantidade total de uma entrega (soma dos itens de lote; senão, o campo direto).
  const deliveryTotalQty = (d: any): number => {
    const items = (d.delivery_items ?? []) as any[];
    if (items.length > 0) return items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    return Number(d.quantity) || 0;
  };

  // Realizadas agrupadas por título (tipo de entrega) — cards de resumo clicáveis.
  const completedByType = useMemo(() => {
    if (tab !== 'completed') return [] as { id: string; name: string; deliveries: any[] }[];
    const groups = new Map<string, { name: string; deliveries: any[] }>();
    (filtered as any[]).forEach((d) => {
      const key = d.demand_type_id || '__none__';
      const name = d.demand_types?.name || 'Sem tipo';
      const g = groups.get(key) ?? { name, deliveries: [] };
      g.deliveries.push(d);
      groups.set(key, g);
    });
    return Array.from(groups.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.deliveries.length - a.deliveries.length || a.name.localeCompare(b.name, 'pt-BR'));
  }, [filtered, tab]);

  // Realizadas por LOTE: primeira e última entrega de cada lote; os lotes com
  // entrega mais recente vêm primeiro (dá para ver quando cada um foi fechado).
  const completedByLot = useMemo(() => {
    if (tab !== 'completed') return [] as { id: string; name: string; deliveries: any[]; primeira: number; ultima: number }[];
    const groups = new Map<string, { name: string; deliveries: any[] }>();
    (filtered as any[]).forEach((d) => {
      const items = (d.delivery_items ?? []) as any[];
      const keys = items.length === 0
        ? [['__none__', 'Sem lote específico']]
        : Array.from(new Map(items.map((it) => [it.lot_id || '__none__', it.delivery_lots?.name || 'Sem lote específico'])).entries());
      keys.forEach(([key, name]) => {
        const g = groups.get(key) ?? { name, deliveries: [] };
        g.deliveries.push(d);
        groups.set(key, g);
      });
    });
    const ts = (d: any) => parseISO(String(d.completed_at || d.created_at || '').replace(' ', 'T')).getTime() || 0;
    return Array.from(groups.entries())
      .map(([id, g]) => {
        const deliveries = g.deliveries.slice().sort((a, b) => ts(b) - ts(a));
        const tempos = deliveries.map(ts).filter((t) => t > 0);
        return { id, ...g, deliveries, primeira: tempos.length ? Math.min(...tempos) : 0, ultima: tempos.length ? Math.max(...tempos) : 0 };
      })
      .sort((a, b) => b.ultima - a.ultima);
  }, [filtered, tab]);

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

  const seletorAgrupamento = (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Agrupar por:</span>
      {([['lote', 'Lote (data de fechamento)'], ['tipo', 'Tipo de entrega']] as const).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => setAgruparRealizadas(v)}
          className={cn(
            'rounded-full border px-3 py-1 font-medium transition-colors',
            agruparRealizadas === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const renderDeliveryCard = (d: any) => {
    const startDate = formatDate(d.delivery_date_start);
    const endDate = formatDate(d.delivery_date_end);
    const completedDate = d.completed_at ? formatDate(d.completed_at.slice(0, 10)) : null;
    const registeredDate = d.created_at ? formatDate(d.created_at.slice(0, 10)) : null;
    const creatorName = d.creator?.name || null;
    const isCompleted = d.status === 'completed';
    const settlementLabel = d.settlements?.name || d.producers?.settlements?.name || null;
    const color = getTypeColor(d.demand_type_id, deliveryDemandTypes);
    // Realizadas: dias entre o cadastro e a realização.
    const prazoDias = (() => {
      if (!isCompleted || !d.completed_at || !d.created_at) return null;
      const ini = parseISO(d.created_at.slice(0, 10)).getTime();
      const fim = parseISO(d.completed_at.slice(0, 10)).getTime();
      const dias = Math.round((fim - ini) / 86400000);
      return Number.isFinite(dias) && dias >= 0 ? dias : null;
    })();

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
              className={cn('text-xs max-w-full whitespace-normal', isCompleted ? 'bg-success/10 text-success border-success/20' : color.badge)}
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

        {/* Termo / comprovante de entrega */}
        {(() => {
          const n = termosPorEntrega.get(d.id)?.length ?? 0;
          // Itens de lote que usam o modelo padrão de termo
          const itensComModelo = ((d.delivery_items ?? []) as any[]).filter((it) => it.delivery_lots?.usa_termo_padrao && it.delivery_lots?.termo_objeto);
          const gerarTermo = () => {
            itensComModelo.forEach((it) => baixarTermoPdf({
              objeto: it.delivery_lots.termo_objeto,
              quantidade: Number(it.quantity) || 0,
              unidade: it.delivery_lots.unit,
              produtor: d.producers?.name || '',
              cpf: d.producers?.cpf || null,
            }));
          };
          return (
            <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTermoDe(d)}
              className={cn(
                'flex-1 min-w-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-left transition-colors',
                n > 0
                  ? 'border-success/30 bg-success/10 text-success hover:bg-success/15'
                  : isCompleted
                    ? 'border-amber-400/60 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300'
                    : 'border-dashed text-muted-foreground hover:bg-muted/50',
              )}
              title={n > 0 ? 'Ver / anexar termo de entrega' : 'Anexar termo de entrega'}
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                {n > 0 ? `Termo de entrega anexado${n > 1 ? ` (${n} arquivos)` : ''}` : 'Sem termo de entrega — anexar'}
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto shrink-0 gap-1 px-2 py-1.5 text-xs"
              disabled={itensComModelo.length === 0}
              title={itensComModelo.length === 0
                ? 'O lote desta entrega não usa o modelo padrão de termo'
                : 'Gerar o termo de compromisso com os dados do produtor e a quantidade'}
              onClick={gerarTermo}
            >
              <FileText className="h-3.5 w-3.5" /> Gerar termo
            </Button>
            </div>
          );
        })()}

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
          {/* Lote(s) e quantidade com a unidade do lote */}
          {((d.delivery_items ?? []) as any[]).length > 0 ? (
            ((d.delivery_items ?? []) as any[]).map((it: any, i: number) => (
              <div key={`${it.lot_id}-${i}`} className="flex items-start gap-1.5 text-muted-foreground">
                <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">
                  <span className="text-foreground font-medium">{fmtQty(it.quantity)} {unidadeTxt(Number(it.quantity), it.delivery_lots?.unit)}</span>
                  {it.delivery_lots?.name && <> · {it.delivery_lots.name}</>}
                </span>
              </div>
            ))
          ) : d.quantity != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span>Quantidade: <span className="text-foreground font-medium">{d.quantity}</span></span>
            </div>
          )}
          {(d.producers?.locations?.name || d.producers?.location_name) && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">Localidade: {d.producers?.locations?.name || d.producers?.location_name}</span>
            </div>
          )}
          {isCompleted && prazoDias != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {prazoDias === 0 ? 'Entregue no mesmo dia do cadastro' : `Entregue ${prazoDias} dia${prazoDias !== 1 ? 's' : ''} após o cadastro`}
              </span>
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

        {(settlementLabel || registeredDate || creatorName) && (
          <div className="flex items-start justify-between gap-2 pt-1 border-t text-xs text-muted-foreground">
            {settlementLabel ? (
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{settlementLabel}</span>
              </span>
            ) : <span />}
            {(registeredDate || creatorName) && (
              <span className="shrink-0 text-right text-[11px] leading-tight">
                {registeredDate && <span className="block">Cadastro: {registeredDate}</span>}
                {creatorName && <span className={cn('block font-medium', getUserColorClass(creatorName))}>por {creatorName}</span>}
              </span>
            )}
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
          ) : tab === 'completed' && agruparRealizadas === 'lote' ? (
            /* Realizadas agrupadas por LOTE — mais recente primeiro, com primeira/última entrega */
            <div className="space-y-3">
              {seletorAgrupamento}
              {completedByLot.map((group) => {
                const isOpen = expandedLots.has('c:' + group.id);
                const pessoas = new Set(group.deliveries.map((d) => d.producer_id)).size;
                const summary = group.id !== '__none__' ? lotSummaryById.get(group.id) : null;
                const unit = summary?.unit || '';
                const total = group.deliveries.reduce((s, d) => s + ((d.delivery_items ?? []) as any[])
                  .filter((it) => (it.lot_id || '__none__') === group.id)
                  .reduce((a: number, it: any) => a + (Number(it.quantity) || 0), 0), 0) || group.deliveries.reduce((s, d) => s + deliveryTotalQty(d), 0);
                const encerrado = !!summary && Number(summary.remaining_quantity ?? 0) <= 0 && Number(summary.reserved_quantity ?? 0) <= 0;
                const semTermo = group.deliveries.filter((d) => !termosPorEntrega.has(d.id)).length;
                const fmtDia = (t: number) => (t > 0 ? format(new Date(t), 'dd/MM/yyyy') : '—');
                const tipos = Array.from(new Set(group.deliveries.map((d) => d.demand_types?.name).filter(Boolean)));
                return (
                  <div key={group.id} className="rounded-xl border bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleLot('c:' + group.id)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-sm leading-snug break-words">{group.name}</span>
                            <Badge variant="secondary" className="shrink-0 bg-success/10 text-success border-success/20">
                              {group.deliveries.length} realizada{group.deliveries.length !== 1 ? 's' : ''}
                            </Badge>
                            {encerrado && (
                              <Badge variant="outline" className="shrink-0 gap-1 border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300">
                                <CheckCircle className="h-3 w-3" /> Lote encerrado
                              </Badge>
                            )}
                            {semTermo > 0 && (
                              <Badge variant="outline" className="shrink-0 gap-1 border-amber-400/60 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                                <Paperclip className="h-3 w-3" /> {semTermo} sem termo
                              </Badge>
                            )}
                          </div>
                        </div>
                        {tipos.length > 0 && (
                          <p className="pl-6 text-xs text-muted-foreground break-words">{tipos.join(' · ')}</p>
                        )}
                        {/* Quando o lote foi entregue: primeira → última entrega */}
                        <div className="ml-6 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-muted/60 px-2 py-1 text-xs">
                          <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          {group.primeira === group.ultima ? (
                            <span>Entregue em <strong>{fmtDia(group.ultima)}</strong></span>
                          ) : (
                            <span>
                              <strong>{fmtDia(group.primeira)}</strong> → <strong>{fmtDia(group.ultima)}</strong>
                              <span className="text-muted-foreground"> {encerrado ? '(fechamento)' : '(última entrega)'}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="font-medium text-foreground">{pessoas}</span> {pessoas === 1 ? 'pessoa' : 'pessoas'}
                          </span>
                          {total > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Package className="h-3 w-3" />
                              <span className="font-semibold">{fmtQty(total)}{unit ? ` ${unidadeTxt(total, unit)}` : ''}</span> entregues
                            </span>
                          )}
                          {summary && !encerrado && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Warehouse className="h-3 w-3" />
                              Restam <span className="font-medium text-foreground">{fmtQty(summary.remaining_quantity)}{unit ? ` ${unidadeTxt(Number(summary.remaining_quantity), unit)}` : ''}</span>
                            </span>
                          )}
                        </div>
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
                        <div className="p-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {group.deliveries.map(renderDeliveryCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : tab === 'completed' ? (
            /* Realizadas agrupadas por título (tipo) — cards de resumo clicáveis */
            <div className="space-y-3">
              {seletorAgrupamento}
              {completedByType.map((group) => {
                const isOpen = expandedTypes.has(group.id);
                const pessoas = new Set(group.deliveries.map((d) => d.producer_id)).size;
                const total = group.deliveries.reduce((s, d) => s + deliveryTotalQty(d), 0);
                const assentSet = new Set<string>();
                group.deliveries.forEach((d) => {
                  const n = d.settlements?.name || d.producers?.settlements?.name;
                  if (n) assentSet.add(n);
                });
                const color = getTypeColor(group.deliveries[0]?.demand_type_id, deliveryDemandTypes);
                return (
                  <div key={group.id} className="rounded-xl border bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleType(group.id)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color.dot)} />
                          <span className="font-semibold text-sm leading-snug break-words">{group.name}</span>
                          <Badge variant="secondary" className="shrink-0 bg-success/10 text-success border-success/20">
                            {group.deliveries.length} realizada{group.deliveries.length !== 1 ? 's' : ''}
                          </Badge>
                          {(() => {
                            const semTermo = group.deliveries.filter((d) => !termosPorEntrega.has(d.id)).length;
                            return semTermo > 0 ? (
                              <Badge variant="outline" className="shrink-0 gap-1 border-amber-400/60 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                                <Paperclip className="h-3 w-3" /> {semTermo} sem termo
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pl-6 text-xs">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="font-medium text-foreground">{pessoas}</span> {pessoas === 1 ? 'pessoa' : 'pessoas'}
                          </span>
                          {total > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Package className="h-3 w-3" />
                              <span className="font-semibold">{fmtQty(total)}</span> entregues
                            </span>
                          )}
                          {assentSet.size > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="font-medium text-foreground">{assentSet.size}</span>{' '}
                              {assentSet.size === 1 ? 'assentamento' : 'assentamentos'}
                            </span>
                          )}
                        </div>
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
                        <div className="p-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {group.deliveries.map(renderDeliveryCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {/* Nome inteiro (quebra linha no celular em vez de cortar) */}
                          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-sm leading-snug break-words">{group.name}</span>
                            <Badge variant="secondary" className="shrink-0">
                              {group.deliveries.length} pendente{group.deliveries.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                        {summary && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pl-6 text-xs">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Warehouse className="h-3 w-3" />
                              Inicial: <span className="font-medium text-foreground">{fmtQty(summary.initial_quantity)} {unidadeTxt(Number(summary.initial_quantity), unit)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <Box className="h-3 w-3" />
                              Reservado: <span className="font-semibold">{fmtQty(summary.reserved_quantity)} {unidadeTxt(Number(summary.reserved_quantity), unit)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <TrendingUp className="h-3 w-3" />
                              Restante: <span className="font-semibold">{fmtQty(summary.remaining_quantity)} {unidadeTxt(Number(summary.remaining_quantity), unit)}</span>
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
                        <div className="p-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            {/* Outros tipos no mesmo cadastro — cada um vira uma entrega separada */}
            {!editingId && extras.map((x, i) => (
              <EntregaAdicional
                key={x.key}
                item={x}
                numero={i + 2}
                tipos={deliveryDemandTypes}
                onChange={(novo) => setExtras((lista) => lista.map((e) => (e.key === x.key ? novo : e)))}
                onRemove={() => setExtras((lista) => lista.filter((e) => e.key !== x.key))}
              />
            ))}
            {!editingId && formData.demand_type_id && (
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-dashed"
                  onClick={() => setExtras((lista) => [...lista, { key: crypto.randomUUID(), demand_type_id: '', quantity: '', lots: [] }])}
                >
                  <Plus className="h-4 w-4" /> Adicionar outro tipo / lote para este produtor
                </Button>
                {extras.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Cada tipo é salvo como uma entrega separada, com as observações e a finalização abaixo.
                  </p>
                )}
              </div>
            )}

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
              disabled={!formData.producer_id || !formData.demand_type_id || salvando || createDelivery.isPending || updateDelivery.isPending}
            >
              {editingId ? 'Salvar' : extras.length > 0 ? `Cadastrar ${extras.length + 1} entregas` : 'Cadastrar'}
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

      <TermoEntregaDialog
        open={!!termoDe}
        onOpenChange={(o) => { if (!o) setTermoDe(null); }}
        deliveryId={termoDe?.id ?? null}
        producerName={termoDe?.producers?.name}
        demandName={termoDe?.demand_types?.name}
        arquivos={termoDe ? termosPorEntrega.get(termoDe.id) ?? [] : []}
      />

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
