import { useState, useMemo } from 'react';
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
  Check as CheckIcon,
  BarChart2,
  MapPin,
  Phone,
  CreditCard,
  TrendingUp,
  Box,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useDeliveries,
  useCreateDelivery,
  useUpdateDelivery,
  useDeleteDelivery,
  useProducers,
  useDemandTypes,
  useSettlements,
} from '@/hooks/useSupabaseData';

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
    const t = searchTerm.toLowerCase();
    return producers.filter(
      (p) =>
        p.name?.toLowerCase().includes(t) ||
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

  // Completed deliveries only
  const completed = useMemo(
    () => deliveries.filter((d) => d.status === 'completed'),
    [deliveries],
  );

  // Available years derived from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const d of completed) {
      const raw = d.completed_at || d.created_at;
      if (raw) years.add(new Date(raw.replace(' ', 'T')).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [completed]);

  // Apply all filters
  const filtered = useMemo(() => {
    return completed
      .filter((d) => {
        const raw = d.completed_at || d.created_at;
        const date = raw ? new Date(raw.replace(' ', 'T')) : null;

        if (filterYear !== 'all' && date?.getFullYear() !== parseInt(filterYear, 10))
          return false;
        if (
          filterMonth !== 'all' &&
          date &&
          String(date.getMonth() + 1) !== filterMonth
        )
          return false;

        const settlementId = d.settlement_id || d.producers?.settlement_id;
        if (filterSettlement !== 'all' && settlementId !== filterSettlement)
          return false;

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
        return (
          new Date(bRaw.replace(' ', 'T')).getTime() -
          new Date(aRaw.replace(' ', 'T')).getTime()
        );
      });
  }, [completed, filterYear, filterMonth, filterSettlement, filterType, filterProducer]);

  // Totals
  const totalCount = filtered.length;
  const totalQty = filtered.reduce((acc, d) => acc + (d.quantity || 0), 0);
  const uniqueProducers = new Set(filtered.map((d) => d.producer_id)).size;
  const uniqueSettlements = new Set(
    filtered
      .map((d) => d.settlement_id || d.producers?.settlement_id)
      .filter(Boolean),
  ).size;

  // Stats grouped by delivery type — for bar chart
  const statsByType = useMemo(() => {
    const map = new Map<string, { name: string; entregas: number; quantidade: number }>();
    for (const d of filtered) {
      const key = d.demand_type_id || 'unknown';
      const name = d.demand_types?.name || 'Desconhecido';
      if (!map.has(key)) map.set(key, { name, entregas: 0, quantidade: 0 });
      const entry = map.get(key)!;
      entry.entregas++;
      entry.quantidade += d.quantity || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.entregas - a.entregas);
  }, [filtered]);

  // Monthly timeline — last 12 months (uses all completed, not filtered, for the full timeline)
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; entregas: number; quantidade: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = {
        month: format(d, 'MMM/yy', { locale: ptBR }),
        entregas: 0,
        quantidade: 0,
      };
    }
    for (const d of completed) {
      const raw = d.completed_at || d.created_at;
      if (!raw) continue;
      const date = new Date(raw.replace(' ', 'T'));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        months[key].entregas++;
        months[key].quantidade += d.quantity || 0;
      }
    }
    return Object.values(months);
  }, [completed]);

  const hasActiveFilters =
    filterYear !== 'all' ||
    filterMonth !== 'all' ||
    filterSettlement !== 'all' ||
    filterType !== 'all' ||
    filterProducer !== '';

  const clearFilters = () => {
    setFilterYear('all');
    setFilterMonth('all');
    setFilterSettlement('all');
    setFilterType('all');
    setFilterProducer('');
  };

  return (
    <div className="space-y-5">
      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Year */}
        <div className="space-y-1.5 w-[100px]">
          <label className="text-xs font-medium text-muted-foreground">Ano</label>
          <Select
            value={filterYear}
            onValueChange={(v) => {
              setFilterYear(v);
              if (v === 'all') setFilterMonth('all');
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month — only visible when year is selected */}
        {filterYear !== 'all' && (
          <div className="space-y-1.5 w-[130px]">
            <label className="text-xs font-medium text-muted-foreground">Mês</label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {[
                  'Janeiro', 'Fevereiro', 'Março', 'Abril',
                  'Maio', 'Junho', 'Julho', 'Agosto',
                  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
                ].map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Settlement */}
        <div className="space-y-1.5 w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">Assentamento</label>
          <Select value={filterSettlement} onValueChange={setFilterSettlement}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {settlements.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div className="space-y-1.5 w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">Tipo de Entrega</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {demandTypes.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Producer text search */}
        <div className="space-y-1.5 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-muted-foreground">Produtor</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar produtor..."
              value={filterProducer}
              onChange={(e) => setFilterProducer(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStatCard
          title="Entregas Realizadas"
          value={totalCount}
          icon={Package}
          colorClass="bg-success/10 text-success"
        />
        <MiniStatCard
          title="Quantidade Total"
          value={totalQty > 0 ? totalQty.toLocaleString('pt-BR') : '—'}
          icon={Box}
          colorClass="bg-primary/10 text-primary"
        />
        <MiniStatCard
          title="Produtores Atendidos"
          value={uniqueProducers}
          icon={User}
          colorClass="bg-info/10 text-info"
        />
        <MiniStatCard
          title="Assentamentos"
          value={uniqueSettlements}
          icon={MapPin}
          colorClass="bg-warning/10 text-warning"
        />
      </div>

      {/* ── No data state ── */}
      {filtered.length === 0 && completed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Package className="h-12 w-12 opacity-30" />
          <p className="text-sm">Nenhuma entrega finalizada ainda.</p>
          <p className="text-xs">Finalize entregas para visualizar as estatísticas.</p>
        </div>
      )}

      {filtered.length === 0 && completed.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Search className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma entrega encontrada com os filtros aplicados.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* ── Charts ── */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Bar chart — deliveries by type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Entregas por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={statsByType}
                    margin={{ top: 4, right: 8, bottom: statsByType.some(d => d.name.length > 10) ? 50 : 20, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={statsByType.length > 3 ? -30 : 0}
                      textAnchor={statsByType.length > 3 ? 'end' : 'middle'}
                      interval={0}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="entregas" name="Entregas" fill={GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Area chart — monthly evolution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Evolução Mensal — últimos 12 meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={monthlyData}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="qtyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN2} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={GREEN2} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="entregas"
                      name="Entregas"
                      stroke={GREEN}
                      fill="url(#delivGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ── Grouped by type summary ── */}
          {statsByType.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {statsByType.map((typeData) => (
                <Card key={typeData.name} className="border-success/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{typeData.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Tipo de entrega</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-success bg-success/10 border-success/20">
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
              ))}
            </div>
          )}

          {/* ── Individual records table ── */}
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
                      const settlementName =
                        d.settlements?.name ||
                        d.producers?.settlements?.name ||
                        '—';
                      const rawDate = d.completed_at || d.created_at;
                      const dateLabel = rawDate
                        ? (() => {
                            try {
                              return format(
                                new Date(rawDate.replace(' ', 'T')),
                                'dd/MM/yyyy',
                                { locale: ptBR },
                              );
                            } catch {
                              return '—';
                            }
                          })()
                        : '—';

                      return (
                        <tr
                          key={d.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 font-medium">
                            {d.producers?.name || '—'}
                          </td>
                          <td className="p-3 text-muted-foreground hidden sm:table-cell text-xs tabular-nums">
                            {d.producers?.cpf || '—'}
                          </td>
                          <td className="p-3 text-muted-foreground hidden md:table-cell">
                            {settlementName}
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {d.demand_types?.name || '—'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {d.quantity ?? '—'}
                          </td>
                          <td className="p-3 text-right text-muted-foreground text-xs whitespace-nowrap">
                            {dateLabel}
                          </td>
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

export default function DeliveriesPage() {
  const { data: deliveries = [], isLoading } = useDeliveries();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const deleteDelivery = useDeleteDelivery();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'completed' | 'stats'>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DeliveryFormData>(EMPTY_FORM);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');

  // Realize (finalize) existing pending delivery
  const [realizeDialogOpen, setRealizeDialogOpen] = useState(false);
  const [realizeId, setRealizeId] = useState<string | null>(null);
  const [realizeName, setRealizeName] = useState('');
  const [realizeDate, setRealizeDate] = useState('');

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Only delivery-category demand types
  const deliveryDemandTypes = useMemo(
    () =>
      (demandTypes as any[]).filter(
        (d) => d.category === 'entregas' && d.is_active !== false,
      ),
    [demandTypes],
  );

  // Selected producer (for form summary card)
  const selectedProducer = useMemo(
    () => (producers as any[]).find((p) => p.id === formData.producer_id),
    [producers, formData.producer_id],
  );

  // Is the delivery being edited already completed?
  const isEditingCompleted = useMemo(
    () =>
      editingId !== null &&
      (deliveries as any[]).find((d) => d.id === editingId)?.status === 'completed',
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

  // Filtered list for Pendentes / Realizadas tabs
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (deliveries as any[])
      .filter((d) => {
        const isPending = !d.status || d.status === 'pending';
        const matchesTab =
          tab === 'pending' ? isPending : d.status === 'completed';
        const matchesSearch =
          (d.producers?.name || '').toLowerCase().includes(q) ||
          (d.demand_types?.name || '').toLowerCase().includes(q);
        return matchesTab && matchesSearch;
      })
      .sort((a: any, b: any) => {
        const aDate =
          (tab === 'completed' ? a.completed_at : null) || a.created_at || '';
        const bDate =
          (tab === 'completed' ? b.completed_at : null) || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [deliveries, search, tab]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (d: any) => {
    setEditingId(d.id);
    setFormData({
      producer_id: d.producer_id || '',
      demand_type_id: d.demand_type_id || '',
      quantity: d.quantity != null ? String(d.quantity) : '',
      notes: d.notes || '',
      delivery_date_start: d.delivery_date_start
        ? d.delivery_date_start.slice(0, 10)
        : '',
      delivery_date_end: d.delivery_date_end
        ? d.delivery_date_end.slice(0, 10)
        : '',
      finalize_now: false,
      completed_at: d.completed_at
        ? d.completed_at.slice(0, 10)
        : format(new Date(), 'yyyy-MM-dd'),
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

  const handleSubmit = () => {
    if (!formData.producer_id || !formData.demand_type_id) return;

    // Settlement is always derived from the producer — never manual
    const settlementId = selectedProducer?.settlement_id || null;

    const payload: Record<string, unknown> = {
      producer_id: formData.producer_id,
      demand_type_id: formData.demand_type_id,
      settlement_id: settlementId,
      quantity: formData.quantity ? Number(formData.quantity) : null,
      notes: formData.notes || null,
      delivery_date_start: formData.delivery_date_start || null,
      delivery_date_end: formData.delivery_date_end || null,
    };

    // Finalize now (create) or update completion date (edit completed)
    const shouldFinalize = formData.finalize_now || isEditingCompleted;
    if (shouldFinalize) {
      payload.status = 'completed';
      payload.completed_at = formData.completed_at
        ? `${formData.completed_at}T12:00:00.000Z`
        : new Date().toISOString();
    }

    if (editingId) {
      updateDelivery.mutate({ id: editingId, ...payload });
    } else {
      createDelivery.mutate(payload as any);
    }
    setFormOpen(false);
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
    const completedAt = realizeDate
      ? `${realizeDate}T12:00:00.000Z`
      : new Date().toISOString();
    updateDelivery.mutate({
      id: realizeId,
      status: 'completed',
      completed_at: completedAt,
    });
    setRealizeId(null);
    setRealizeDialogOpen(false);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
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

  return (
    <AppLayout>
      <PageHeader
        title="Entregas"
        description="Controle de entregas aos produtores"
        action={
          tab !== 'stats'
            ? {
                label: 'Nova Entrega',
                onClick: openCreate,
                icon: <Plus className="h-4 w-4 mr-2" />,
              }
            : undefined
        }
      />

      {/* ── Tabs ── */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'pending' | 'completed' | 'stats')}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Pendentes
            <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded-full text-xs font-medium">
              {pendingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            <CalendarCheck className="h-4 w-4" />
            Realizadas
            <span className="bg-success/20 text-success px-1.5 py-0.5 rounded-full text-xs font-medium">
              {completedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart2 className="h-4 w-4" />
            Estatísticas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Pending / Completed tab content ── */}
      {tab !== 'stats' && (
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
                {tab === 'pending'
                  ? 'Nenhuma entrega pendente'
                  : 'Nenhuma entrega realizada'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((d: any) => {
                const startDate = formatDate(d.delivery_date_start);
                const endDate = formatDate(d.delivery_date_end);
                const completedDate = d.completed_at
                  ? formatDate(d.completed_at.slice(0, 10))
                  : null;
                const isCompleted = d.status === 'completed';

                // Settlement: delivery's own, or fall back to producer's
                const settlementLabel =
                  d.settlements?.name ||
                  d.producers?.settlements?.name ||
                  null;

                return (
                  <div
                    key={d.id}
                    className={cn(
                      'rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow',
                      isCompleted && 'border-success/30 bg-success/5',
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium text-sm">
                            {d.producers?.name || '—'}
                          </span>
                        </div>
                        <Badge
                          variant={isCompleted ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs',
                            isCompleted &&
                              'bg-success/10 text-success border-success/20 hover:bg-success/20',
                          )}
                        >
                          {d.demand_types?.name || '—'}
                        </Badge>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1 shrink-0">
                        {!isCompleted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            title="Marcar como realizada"
                            onClick={() => openRealize(d)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover"
                          onClick={() => openDelete(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Completed date badge */}
                    {isCompleted && completedDate && (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>Realizada em {completedDate}</span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-1.5 text-sm">
                      {d.producers?.cpf && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5 shrink-0" />
                          <span className="tabular-nums">{d.producers.cpf}</span>
                        </div>
                      )}
                      {d.producers?.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{d.producers.phone}</span>
                        </div>
                      )}
                      {d.quantity != null && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Hash className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Quantidade:{' '}
                            <span className="text-foreground font-medium">
                              {d.quantity}
                            </span>
                          </span>
                        </div>
                      )}
                      {(startDate || endDate) && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {startDate && endDate
                              ? `${startDate} → ${endDate}`
                              : startDate || endDate}
                          </span>
                        </div>
                      )}
                      {d.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t">
                          {d.notes}
                        </p>
                      )}
                    </div>

                    {/* Footer: settlement */}
                    {settlementLabel && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{settlementLabel}</span>
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

      {/* ── Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Entrega' : 'Nova Entrega'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Producer — searchable combobox */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Produtor *</label>
              <ProducerCombobox
                producers={producers as any[]}
                value={formData.producer_id}
                onChange={(v) => setFormData((f) => ({ ...f, producer_id: v }))}
              />
            </div>

            {/* Producer summary card — auto-populated, read-only */}
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
                  {(selectedProducer.locations?.name ||
                    selectedProducer.location_name) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 opacity-0" />
                      <span className="text-xs">
                        <strong>Localidade:</strong>{' '}
                        {selectedProducer.locations?.name ||
                          selectedProducer.location_name}
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
                onValueChange={(v) =>
                  setFormData((f) => ({ ...f, demand_type_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryDemandTypes.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Quantidade</label>
              <Input
                type="number"
                placeholder="Ex: 500"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data Início</label>
                <Input
                  type="date"
                  value={formData.delivery_date_start}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      delivery_date_start: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data Fim</label>
                <Input
                  type="date"
                  value={formData.delivery_date_end}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      delivery_date_end: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                placeholder="Informações adicionais..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
              />
            </div>

            <Separator />

            {/* ── Finalization section ── */}
            {!isEditingCompleted ? (
              /* Creating or editing a pending delivery — offer "finalize now" toggle */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="finalize_now"
                    checked={formData.finalize_now}
                    onCheckedChange={(checked) =>
                      setFormData((f) => ({
                        ...f,
                        finalize_now: !!checked,
                        completed_at:
                          !!checked && !f.completed_at
                            ? format(new Date(), 'yyyy-MM-dd')
                            : f.completed_at,
                      }))
                    }
                  />
                  <label
                    htmlFor="finalize_now"
                    className="text-sm font-medium cursor-pointer select-none flex items-center gap-1.5"
                  >
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
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          completed_at: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Editing a completed delivery — always show the date field */
              <div className="space-y-1.5">
                <Label
                  htmlFor="completed-at-edit"
                  className="flex items-center gap-1.5"
                >
                  <CalendarCheck className="h-4 w-4 text-success" />
                  Data de Realização
                </Label>
                <Input
                  id="completed-at-edit"
                  type="date"
                  value={formData.completed_at}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      completed_at: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !formData.producer_id ||
                  !formData.demand_type_id ||
                  createDelivery.isPending ||
                  updateDelivery.isPending
                }
              >
                {editingId
                  ? 'Salvar'
                  : formData.finalize_now
                    ? 'Cadastrar e Finalizar'
                    : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Realize dialog (finalize existing pending delivery) ── */}
      <Dialog open={realizeDialogOpen} onOpenChange={setRealizeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar Entrega como Realizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Produtor: <strong>{realizeName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="realize-date">Data de Realização</Label>
              <Input
                id="realize-date"
                type="date"
                value={realizeDate}
                onChange={(e) => setRealizeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRealizeDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-success hover:bg-success/90 text-white"
              onClick={handleRealize}
              disabled={!realizeDate || updateDelivery.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover Entrega"
        description={`Deseja remover a entrega de "${deleteName}"?`}
        onConfirm={handleDelete}
        confirmLabel="Remover"
        variant="destructive"
      />
    </AppLayout>
  );
}
