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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  useSefazProducers, useCreateSefazProducer, useUpdateSefazProducer, useDeleteSefazProducer,
  useSefazServices, useCreateSefazService, useUpdateSefazService, useDeleteSefazService,
} from '@/hooks/useSupabaseData';

const SERVICE_TYPES = [
  'Nota Fiscal',
  'GTA',
  'Declaração de Posse',
  'Outros',
] as const;

type ServiceType = typeof SERVICE_TYPES[number];

function cpfMask(v: string) {
  return v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

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
  const [fPhone, setFPhone] = useState('');
  const [fSettlement, setFSettlement] = useState('');
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
    const q = search.toLowerCase();
    return (producers as any[]).filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.cpf?.includes(q) ||
      p.settlement?.toLowerCase().includes(q)
    );
  }, [producers, search]);

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
      const label = format(d, 'MMM/yy', { locale: ptBR });
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
    setFName(''); setFCpf(''); setFPhone(''); setFSettlement(''); setFLocation('');
    setProducerFormOpen(true);
  };
  const openEditProducer = (p: any) => {
    setEditingProducer(p);
    setFName(p.name || ''); setFCpf(p.cpf || ''); setFPhone(p.phone || '');
    setFSettlement(p.settlement || ''); setFLocation(p.location || '');
    setProducerFormOpen(true);
  };

  const handleSubmitProducer = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: fName.toUpperCase(), cpf: fCpf || null, phone: fPhone || null, settlement: fSettlement || null, location: fLocation || null };
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
                          {p.settlement && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.settlement}</span>}
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
          <div className="flex items-center gap-3 mb-6">
            <Label htmlFor="month-sel" className="shrink-0 text-sm font-medium">Mês de referência:</Label>
            <select
              id="month-sel"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MONTH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label.charAt(0).toUpperCase() + o.label.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{monthlyServices.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Atendimentos no mês</p>
              </CardContent>
            </Card>
            {typeStats.slice(0, 3).map(({ type, count }) => (
              <Card key={type}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* By service type breakdown */}
          {typeStats.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" />
                  Atendimentos por tipo — {MONTH_OPTIONS.find(o => o.value === selectedMonth)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {typeStats.map(({ type, count }) => {
                    const max = typeStats[0].count;
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{type}</span>
                          <span className="font-bold text-primary">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bar chart - services per month */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-primary/5">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <div>
                  <span className="text-lg">Atendimentos por Mês</span>
                  <p className="text-sm font-normal text-muted-foreground">Últimos 6 meses por tipo de serviço</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-2 sm:px-6">
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} formatter={v => <span className="text-foreground text-xs">{v}</span>} />
                    <Bar dataKey="Nota Fiscal" name="Nota Fiscal" fill="hsl(210 70% 45%)" radius={[4,4,0,0]} />
                    <Bar dataKey="GTA" name="GTA" fill="hsl(142 71% 45%)" radius={[4,4,0,0]} />
                    <Bar dataKey="Declaração de Posse" name="Declaração de Posse" fill="hsl(280 70% 55%)" radius={[4,4,0,0]} />
                    <Bar dataKey="Outros" name="Outros" fill="hsl(38 92% 50%)" radius={[4,4,0,0]} />
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
                <Label htmlFor="p-cpf">CPF</Label>
                <Input id="p-cpf" value={fCpf} onChange={e => setFCpf(cpfMask(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Telefone</Label>
                <Input id="p-phone" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="(66) 99999-9999" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-settlement">Assentamento</Label>
                <Input id="p-settlement" value={fSettlement} onChange={e => setFSettlement(e.target.value)} placeholder="Nome do assentamento" />
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
                  {sheetProducer.settlement && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{sheetProducer.settlement}{sheetProducer.location ? ` · ${sheetProducer.location}` : ''}</p>}
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
