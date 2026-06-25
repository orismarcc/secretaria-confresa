import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Plus, Pencil, Trash2, User, Phone, MapPin, FileText,
  ClipboardList, CheckSquare, Square, CalendarDays, BarChart3,
  Users, TrendingUp,
} from 'lucide-react';
import { format, startOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  formatDocument,
  formatCpf,
  formatCnpj,
  detectDocType,
  documentPlaceholder,
  onlyDigits,
  type DocType,
} from '@/lib/documents';
import { normalizeText } from '@/lib/text';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  useSefazProducers, useCreateSefazProducer, useUpdateSefazProducer, useDeleteSefazProducer,
  useSefazServices, useCreateSefazService, useUpdateSefazService, useDeleteSefazService,
  useSettlements,
} from '@/hooks/useSupabaseData';

const SERVICE_TYPES = [
  'Nota Fiscal',
  'Declaração de Posse',
  'Outros',
] as const;

type ServiceType = typeof SERVICE_TYPES[number];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return {
    value: format(startOfMonth(d), 'yyyy-MM'),
    label: format(d, 'MMMM yyyy', { locale: ptBR }),
  };
});

// Custom tooltip for recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function SEFAZPage() {
  const { data: producers = [], isLoading: producersLoading } = useSefazProducers();
  const { data: allServices = [], isLoading: servicesLoading } = useSefazServices();
  const { data: rawSettlements = [] } = useSettlements();
  const settlements = (rawSettlements as any[]);
  const createProducer = useCreateSefazProducer();
  const updateProducer = useUpdateSefazProducer();
  const deleteProducer = useDeleteSefazProducer();
  const createService = useCreateSefazService();
  const updateService = useUpdateSefazService();
  const deleteService = useDeleteSefazService();

  const [mainTab, setMainTab] = useState<'producers' | 'analytics'>('producers');
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Producer CRUD
  const [producerFormOpen, setProducerFormOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<any | null>(null);
  const [deleteProducerOpen, setDeleteProducerOpen] = useState(false);
  const [toDeleteProducer, setToDeleteProducer] = useState<any | null>(null);

  // Producer form fields
  const [fName, setFName] = useState('');
  const [fCpf, setFCpf] = useState('');
  const [fDocType, setFDocType] = useState<DocType>('cpf');
  const [fPhone, setFPhone] = useState('');
  const [fSettlementId, setFSettlementId] = useState('');
  const [fLocation, setFLocation] = useState('');

  // Detail sheet (services for a producer)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProducer, setSheetProducer] = useState<any | null>(null);

  // Service CRUD (inside sheet)
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [deleteServiceOpen, setDeleteServiceOpen] = useState(false);
  const [toDeleteService, setToDeleteService] = useState<any | null>(null);
  const [sType, setSType] = useState<ServiceType>('Nota Fiscal');
  const [sDate, setSDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sSigned, setSSigned] = useState(false);
  const [sNotes, setSNotes] = useState('');

  // services for current sheet producer
  const { data: producerServices = [] } = useSefazServices(sheetProducer?.id);

  // Filtered producers list
  const filteredProducers = useMemo(() => {
    const q = normalizeText(search);
    return (producers as any[]).filter(p =>
      normalizeText(p.name).includes(q) ||
      p.cpf?.includes(q) ||
      normalizeText(p.settlement).includes(q) ||
      normalizeText(settlements.find((s: any) => s.id === p.settlement_id)?.name).includes(q)
    );
  }, [producers, search, settlements]);

  // Services for selected month (analytics tab)
  const monthlyServices = useMemo(() => {
    return (allServices as any[]).filter(s => {
      const d = s.service_date || s.created_at;
      return d && d.startsWith(selectedMonth);
    });
  }, [allServices, selectedMonth]);

  // Monthly chart data (last 6 months, by service type)
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const key = format(startOfMonth(d), 'yyyy-MM');
      const label = format(d, 'MMM yy', { locale: ptBR });
      const month = (allServices as any[]).filter(s => (s.service_date || s.created_at || '').startsWith(key));
      const byType: Record<string, number> = {};
      SERVICE_TYPES.forEach(t => { byType[t] = month.filter(s => s.service_type === t).length; });
      return {
        month: label.charAt(0).toUpperCase() + label.slice(1),
        ...byType,
        total: month.length,
      };
    });
  }, [allServices]);

  // By-type stats for selected month
  const typeStats = useMemo(() => {
    return SERVICE_TYPES.map(t => ({
      type: t,
      count: monthlyServices.filter(s => s.service_type === t).length,
    })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  }, [monthlyServices]);

  // Open producer form
  const openCreateProducer = () => {
    setEditingProducer(null);
    setFName(''); setFCpf(''); setFDocType('cpf'); setFPhone(''); setFSettlementId(''); setFLocation('');
    setProducerFormOpen(true);
  };
  const openEditProducer = (p: any) => {
    setEditingProducer(p);
    setFName(p.name || ''); setFCpf(p.cpf || ''); setFDocType(detectDocType(p.cpf)); setFPhone(p.phone || '');
    setFSettlementId(p.settlement_id || ''); setFLocation(p.location || '');
    setProducerFormOpen(true);
  };

  // Alterna CPF/CNPJ re-mascarando os dígitos já digitados
  const handleDocTypeChange = (type: DocType) => {
    if (type === fDocType) return;
    setFDocType(type);
    const digits = onlyDigits(fCpf);
    setFCpf(type === 'cnpj' ? formatCnpj(digits) : formatCpf(digits));
  };

  const handleSubmitProducer = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: fName.toUpperCase(),
      cpf: fCpf || null,
      phone: fPhone || null,
      settlement_id: fSettlementId || null,
      location: fLocation || null
    };
    if (editingProducer) {
      updateProducer.mutate({ id: editingProducer.id, ...data });
    } else {
      createProducer.mutate(data);
    }
    setProducerFormOpen(false);
  };

  // Open detail sheet
  const openSheet = (p: any) => {
    setSheetProducer(p);
    setSheetOpen(true);
  };

  // Service form
  const openCreateService = () => {
    setEditingService(null);
    setSType('Nota Fiscal'); setSDate(format(new Date(), 'yyyy-MM-dd')); setSSigned(false); setSNotes('');
    setServiceFormOpen(true);
  };
  const openEditService = (s: any) => {
    setEditingService(s);
    setSType(s.service_type as ServiceType);
    setSDate(s.service_date || format(new Date(), 'yyyy-MM-dd'));
    setSSigned(s.signed_list || false);
    setSNotes(s.notes || '');
    setServiceFormOpen(true);
  };

  const handleSubmitService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetProducer) return;
    const data = {
      sefaz_producer_id: sheetProducer.id,
      service_type: sType,
      service_date: sDate,
      signed_list: sSigned,
      notes: sNotes || null,
    };
    if (editingService) {
      updateService.mutate({ id: editingService.id, ...data });
    } else {
      createService.mutate(data);
    }
    setServiceFormOpen(false);
  };

  const yearServices = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    return (allServices as any[]).filter(s =>
      (s.service_date || s.created_at || '').startsWith(currentYear)
    );
  }, [allServices]);

  const yearTypeStats = useMemo(() => {
    return SERVICE_TYPES.map(t => ({
      type: t,
      count: yearServices.filter(s => s.service_type === t).length,
    })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  }, [yearServices]);

  const isLoading = producersLoading || servicesLoading;

  return (
    <AppLayout>
      <PageHeader
        title="SEFAZ"
        description="Controle de atendimentos tributários e fiscais"
        action={mainTab === 'producers' ? { label: 'Novo Produtor', onClick: openCreateProducer, icon: <Plus className="h-4 w-4 mr-2" /> } : undefined}
      />

      <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="producers" className="gap-1.5">
            <Users className="h-4 w-4" /> Produtores
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Análises
          </TabsTrigger>
        </TabsList>

        {/* ── PRODUCERS TAB ─────────────────────────────────────────────── */}
        <TabsContent value="producers">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold leading-none">{(producers as any[]).length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Produtores</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><ClipboardList className="h-5 w-5 text-success" /></div>
                <div>
                  <p className="text-2xl font-bold leading-none">{(allServices as any[]).length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Atendimentos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><CheckSquare className="h-5 w-5 text-warning" /></div>
                <div>
                  <p className="text-2xl font-bold leading-none">
                    {(allServices as any[]).filter(s => s.signed_list).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Assinaram lista</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, CPF ou assentamento..." className="max-w-md" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : filteredProducers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Users className="h-12 w-12 opacity-30" />
              <p>{search ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducers.map((p: any) => {
                const svcCount = (p.sefaz_services || []).length;
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => openSheet(p)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-semibold truncate">{p.name}</span>
                          {svcCount > 0 && (
                            <Badge variant="secondary" className="text-xs shrink-0">{svcCount} atend.</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {p.cpf && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{p.cpf}</span>}
                          {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                          {(p.settlement_id || p.settlement) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {settlements.find((s: any) => s.id === p.settlement_id)?.name || p.settlement || ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEditProducer(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => { setToDeleteProducer(p); setDeleteProducerOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
        <TabsContent value="analytics">
          {/* Month selector */}
          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <Label htmlFor="month-sel" className="shrink-0 text-sm font-semibold text-primary">Mês de referência:</Label>
            <select
              id="month-sel"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-primary/30 bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              {MONTH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label.charAt(0).toUpperCase() + o.label.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly stats — colored cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{monthlyServices.length}</p>
                  <p className="text-xs text-blue-600/80 mt-0.5 font-medium">No mês</p>
                </div>
              </CardContent>
            </Card>

            {/* Nota Fiscal */}
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-700">
                    {monthlyServices.filter(s => s.service_type === 'Nota Fiscal').length}
                  </p>
                  <p className="text-xs text-indigo-600/80 mt-0.5 font-medium">Nota Fiscal</p>
                </div>
              </CardContent>
            </Card>

            {/* Declaração de Posse */}
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <Square className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-violet-700">
                    {monthlyServices.filter(s => s.service_type === 'Declaração de Posse').length}
                  </p>
                  <p className="text-xs text-violet-600/80 mt-0.5 font-medium">Declaração</p>
                </div>
              </CardContent>
            </Card>

            {/* Outros */}
            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <ClipboardList className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700">
                    {monthlyServices.filter(s => s.service_type === 'Outros').length}
                  </p>
                  <p className="text-xs text-orange-600/80 mt-0.5 font-medium">Outros</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Year totals */}
          <Card className="mb-6 border-amber-200 overflow-hidden">
            <CardHeader className="border-b pb-3 bg-gradient-to-r from-amber-50 to-amber-100/50">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-amber-800">Total do Ano {new Date().getFullYear()}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 bg-gradient-to-b from-amber-50/30 to-transparent">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-amber-500 p-3 text-center text-white shadow-sm">
                  <p className="text-2xl font-bold">{yearServices.length}</p>
                  <p className="text-xs font-medium mt-0.5 opacity-90">Total</p>
                </div>
                {[
                  { type: 'Nota Fiscal', color: 'bg-indigo-500' },
                  { type: 'Declaração de Posse', color: 'bg-violet-500' },
                  { type: 'Outros', color: 'bg-orange-400' },
                ].map(({ type, color }) => {
                  const count = yearServices.filter(s => s.service_type === type).length;
                  return (
                    <div key={type} className={`rounded-lg ${color} p-3 text-center text-white shadow-sm`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs font-medium mt-0.5 opacity-90 leading-tight">{type}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* By service type breakdown — colored bars */}
          {typeStats.length > 0 && (
            <Card className="mb-6 overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100/50">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-slate-200">
                    <ClipboardList className="h-4 w-4 text-slate-600" />
                  </div>
                  Atendimentos por tipo —{' '}
                  <span className="text-primary">
                    {MONTH_OPTIONS.find(o => o.value === selectedMonth)?.label}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="space-y-4">
                  {typeStats.map(({ type, count }, idx) => {
                    const max = typeStats[0].count;
                    const pct = Math.round((count / max) * 100);
                    const barColors = [
                      { bar: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
                      { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
                      { bar: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700' },
                      { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700' },
                    ];
                    const c = barColors[idx % barColors.length];
                    return (
                      <div key={type}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium">{type}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                            {count} atend.
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bar chart - services per month */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/20"><TrendingUp className="h-5 w-5 text-white" /></div>
                <div>
                  <span className="text-lg text-white">Atendimentos por Mês</span>
                  <p className="text-sm font-normal text-white/70">Últimos 6 meses por tipo de serviço</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-2 sm:px-6 bg-gradient-to-b from-blue-50/30 to-transparent">
              <div className="h-[280px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} formatter={v => <span className="text-foreground text-xs">{v}</span>} />
                    <Bar dataKey="Nota Fiscal" name="Nota Fiscal" fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="Declaração de Posse" name="Declaração de Posse" fill="#8b5cf6" radius={[4,4,0,0]} />
                    <Bar dataKey="Outros" name="Outros" fill="#f97316" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Producer Form Dialog ──────────────────────────────────────────── */}
      <Dialog open={producerFormOpen} onOpenChange={setProducerFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProducer ? 'Editar Produtor' : 'Novo Produtor SEFAZ'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitProducer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Nome *</Label>
              <Input id="p-name" value={fName} onChange={e => setFName(e.target.value.toUpperCase())} placeholder="Nome completo" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="p-cpf">{fDocType === 'cnpj' ? 'CNPJ' : 'CPF'} *</Label>
                  <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                    {(['cpf', 'cnpj'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleDocTypeChange(t)}
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                          fDocType === t
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  id="p-cpf"
                  value={fCpf}
                  onChange={e => setFCpf(formatDocument(e.target.value, fDocType))}
                  placeholder={documentPlaceholder(fDocType)}
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Telefone</Label>
                <Input id="p-phone" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="(66) 99999-9999" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-settlement">Assentamento</Label>
                <select
                  id="p-settlement"
                  value={fSettlementId}
                  onChange={e => setFSettlementId(e.target.value)}
                  className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {settlements.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-location">Localidade</Label>
                <Input id="p-location" value={fLocation} onChange={e => setFLocation(e.target.value)} placeholder="Localidade" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setProducerFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingProducer ? 'Salvar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Producer Detail Sheet ─────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {sheetProducer && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">Atendimentos — {sheetProducer.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Producer mini info */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                  {sheetProducer.cpf && <p className="flex items-center gap-2 text-muted-foreground"><FileText className="h-3.5 w-3.5" />{sheetProducer.cpf}</p>}
                  {sheetProducer.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{sheetProducer.phone}</p>}
                  {(sheetProducer.settlement_id || sheetProducer.location) && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {settlements.find((s: any) => s.id === sheetProducer.settlement_id)?.name || ''}
                      {sheetProducer.location ? ` · ${sheetProducer.location}` : ''}
                    </p>
                  )}
                </div>

                <Button className="w-full gap-2" onClick={openCreateService}>
                  <Plus className="h-4 w-4" /> Adicionar Atendimento
                </Button>

                <Separator />

                {/* Services list */}
                {(producerServices as any[]).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum atendimento registrado</p>
                ) : (
                  <div className="space-y-2">
                    {(producerServices as any[]).map((s: any) => {
                      const date = s.service_date
                        ? format(new Date(s.service_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                        : '—';
                      return (
                        <div key={s.id} className="rounded-lg border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">{s.service_type}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{date}</span>
                                {s.signed_list ? (
                                  <span className="flex items-center gap-1 text-success font-medium"><CheckSquare className="h-3 w-3" />Assinou lista</span>
                                ) : (
                                  <span className="flex items-center gap-1 text-muted-foreground"><Square className="h-3 w-3" />Não assinou</span>
                                )}
                              </div>
                              {s.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{s.notes}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditService(s)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => { setToDeleteService(s); setDeleteServiceOpen(true); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Service Form Dialog (inside sheet) ──────────────────────────── */}
      <Dialog open={serviceFormOpen} onOpenChange={setServiceFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Atendimento' : 'Novo Atendimento SEFAZ'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitService} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-type">Tipo de Serviço *</Label>
              <select
                id="s-type"
                value={sType}
                onChange={e => setSType(e.target.value as ServiceType)}
                className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-date">Data do Atendimento *</Label>
              <Input id="s-date" type="date" value={sDate} onChange={e => setSDate(e.target.value)} required />
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch id="s-signed" checked={sSigned} onCheckedChange={setSSigned} />
              <Label htmlFor="s-signed" className="cursor-pointer">
                Produtor assinou a lista de presença
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-notes">Observações</Label>
              <Input id="s-notes" value={sNotes} onChange={e => setSNotes(e.target.value)} placeholder="Observações opcionais" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setServiceFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingService ? 'Salvar' : 'Registrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deleteProducerOpen}
        onOpenChange={setDeleteProducerOpen}
        title="Excluir Produtor"
        description={`Excluir "${toDeleteProducer?.name}"? Todos os atendimentos vinculados serão removidos. Esta ação não pode ser desfeita.`}
        onConfirm={() => { if (toDeleteProducer) { deleteProducer.mutate(toDeleteProducer.id); setToDeleteProducer(null); setDeleteProducerOpen(false); } }}
        confirmLabel="Excluir"
        variant="destructive"
      />
      <ConfirmDialog
        open={deleteServiceOpen}
        onOpenChange={setDeleteServiceOpen}
        title="Excluir Atendimento"
        description="Excluir este atendimento? Esta ação não pode ser desfeita."
        onConfirm={() => { if (toDeleteService) { deleteService.mutate(toDeleteService.id); setToDeleteService(null); setDeleteServiceOpen(false); } }}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
