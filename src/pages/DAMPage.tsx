import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  User,
  MapPin,
  CalendarDays,
  CheckCircle,
  XCircle,
  TrendingUp,
  Paperclip,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { isDamOverdue } from '@/lib/damUtils';
import { supabase } from '@/integrations/supabase/client';
import { ptBR } from 'date-fns/locale';
import {
  useServices,
  useUpdateService,
  useProducers,
  useDemandTypes,
  useSettlements,
} from '@/hooks/useSupabaseData';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseDamDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // date column comes back as YYYY-MM-DD from Postgres
  return new Date(raw + 'T12:00:00');
}

type DamStatus = 'overdue' | 'pending' | 'paid';

function getDamStatus(s: any): DamStatus {
  if (s.dam_paid) return 'paid';
  if (isDamOverdue(s.dam_issued_at, s.dam_paid)) return 'overdue';
  return 'pending';
}

function getDaysElapsed(s: any): number | null {
  const issued = parseDamDate(s.dam_issued_at);
  if (!issued) return null;
  return differenceInDays(new Date(), issued);
}

// ─── component ───────────────────────────────────────────────────────────────

type TabValue = 'all' | 'pending' | 'overdue' | 'paid';

const TAB_CONFIG: Record<TabValue, { label: string; icon: React.ElementType; className: string }> = {
  all:     { label: 'Todas',    icon: FileText,      className: '' },
  overdue: { label: 'Em Atraso', icon: AlertTriangle, className: 'text-destructive' },
  pending: { label: 'Pendentes', icon: Clock,          className: 'text-warning' },
  paid:    { label: 'Pagas',     icon: CheckCircle2,   className: 'text-success' },
};

export default function DAMPage() {
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const updateService = useUpdateService();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabValue>('all');

  // Mark as paid dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingService, setPayingService] = useState<any | null>(null);
  const [payDate, setPayDate] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);

  // Filter only services with DAM issued
  const damServices = useMemo(() =>
    (services as any[]).filter(s => s.dam_issued),
    [services]
  );

  // Stats
  const stats = useMemo(() => {
    const overdue = damServices.filter(s => getDamStatus(s) === 'overdue').length;
    const pending = damServices.filter(s => getDamStatus(s) === 'pending').length;
    const paid    = damServices.filter(s => getDamStatus(s) === 'paid').length;
    return { total: damServices.length, overdue, pending, paid };
  }, [damServices]);

  // Filtered + searched
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return damServices
      .filter(s => {
        const status = getDamStatus(s);
        if (tab !== 'all' && status !== tab) return false;
        const producerName = (producers.find(p => p.id === s.producer_id)?.name || s.producers?.name || '').toLowerCase();
        const demandName   = (demandTypes.find(d => d.id === s.demand_type_id)?.name || s.demand_types?.name || '').toLowerCase();
        return producerName.includes(q) || demandName.includes(q);
      })
      .sort((a: any, b: any) => {
        // Overdue first, then pending, then paid; within each group sort by issue date asc
        const order: Record<DamStatus, number> = { overdue: 0, pending: 1, paid: 2 };
        const sa = getDamStatus(a), sb = getDamStatus(b);
        if (order[sa] !== order[sb]) return order[sa] - order[sb];
        // Items without issue date sort to the end of their group (MAX_SAFE_INTEGER avoids NaN)
        const da = parseDamDate(a.dam_issued_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const db = parseDamDate(b.dam_issued_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }, [damServices, tab, search, producers, demandTypes]);

  async function uploadReceipt(file: File, serviceId: string): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'pdf';
    const path = `${serviceId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('dam-receipts').upload(path, file, { upsert: true });
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    // Get signed URL (valid 10 years)
    const { data } = await supabase.storage.from('dam-receipts').createSignedUrl(path, 60 * 60 * 24 * 3650);
    return data?.signedUrl ?? null;
  }

  const openPayDialog = (s: any) => {
    setPayingService(s);
    setPayDate(format(new Date(), 'yyyy-MM-dd'));
    setReceiptFile(null);
    setPayDialogOpen(true);
  };

  const handleMarkPaid = async () => {
    if (!payingService) return;
    setReceiptUploading(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile, payingService.id);
      }
      updateService.mutate({
        id: payingService.id,
        dam_paid: true,
        dam_paid_at: payDate || null,
        ...(receiptUrl ? { dam_receipt_url: receiptUrl } : {}),
      });
      setPayingService(null);
      setPayDialogOpen(false);
      setReceiptFile(null);
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleMarkUnpaid = (s: any) => {
    // C-02: limpar data e recibo ao reverter pagamento — evita dados inconsistentes no banco
    updateService.mutate({ id: s.id, dam_paid: false, dam_paid_at: null, dam_receipt_url: null });
  };

  if (servicesLoading) {
    return (
      <AppLayout>
        <PageHeader title="DAMs" description="Controle de Documentos de Arrecadação Municipal" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="DAMs"
        description="Controle de Documentos de Arrecadação Municipal"
      />

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTab('all')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total emitidas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-destructive/20" onClick={() => setTab('overdue')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none text-destructive">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Em atraso (+30d)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-warning/20" onClick={() => setTab('pending')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none text-warning">{stats.pending}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pendentes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-success/20" onClick={() => setTab('paid')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none text-success">{stats.paid}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pagas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      {stats.total > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Taxa de pagamento
              </span>
              <span className="font-bold text-primary">
                {Math.round((stats.paid / stats.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${Math.round((stats.paid / stats.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {stats.paid} de {stats.total} DAMs pagas
              {stats.overdue > 0 && (
                <span className="text-destructive font-medium ml-2">
                  · {stats.overdue} em atraso
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs + Search ─────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {(Object.entries(TAB_CONFIG) as [TabValue, typeof TAB_CONFIG[TabValue]][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = key === 'all' ? stats.total
              : key === 'overdue' ? stats.overdue
              : key === 'pending' ? stats.pending
              : stats.paid;
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${cfg.className}`} />
                {cfg.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs
                  ${key === 'overdue' ? 'bg-destructive/15 text-destructive' :
                    key === 'pending' ? 'bg-warning/15 text-warning' :
                    key === 'paid'    ? 'bg-success/15 text-success' :
                    'bg-primary/15 text-primary'}`}>
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por produtor ou tipo de demanda..."
          className="max-w-sm"
        />
      </div>

      {/* ── DAM Cards ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FileText className="h-12 w-12 opacity-30" />
          <p>
            {tab === 'all' ? 'Nenhuma DAM emitida' :
             tab === 'overdue' ? 'Nenhuma DAM em atraso' :
             tab === 'pending' ? 'Nenhuma DAM pendente' :
             'Nenhuma DAM paga'}
          </p>
          {tab === 'all' && (
            <p className="text-xs text-center max-w-xs">
              DAMs são emitidas no cadastro de atendimentos. Marque "DAM emitida?" ao cadastrar ou editar um atendimento.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s: any) => {
            const status = getDamStatus(s);
            const daysElapsed = getDaysElapsed(s);
            const producer = producers.find(p => p.id === s.producer_id);
            const producerName = producer?.name || s.producers?.name || '—';
            const demandType = demandTypes.find(d => d.id === s.demand_type_id);
            const demandName = demandType?.name || s.demand_types?.name || '—';
            const settlement = settlements.find(st => st.id === s.settlement_id);
            const settlementName = settlement?.name || s.settlements?.name || null;
            const issuedDate = parseDamDate(s.dam_issued_at);

            return (
              <div
                key={s.id}
                className={`rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow ${
                  status === 'overdue' ? 'border-destructive/30 bg-destructive/5' :
                  status === 'paid'    ? 'border-success/30 bg-success/5' :
                  'border-warning/20'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-sm truncate">{producerName}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{demandName}</Badge>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {status === 'overdue' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-2.5 py-1">
                        <AlertTriangle className="h-3 w-3" />
                        Em atraso
                      </span>
                    )}
                    {status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning bg-warning/10 border border-warning/20 rounded-full px-2.5 py-1">
                        <Clock className="h-3 w-3" />
                        Pendente
                      </span>
                    )}
                    {status === 'paid' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paga
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Details */}
                <div className="space-y-1.5 text-sm">
                  {issuedDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Emitida em{' '}
                        <span className="text-foreground font-medium">
                          {format(issuedDate, 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </span>
                    </div>
                  )}

                  {daysElapsed !== null && (
                    <div className={`flex items-center gap-2 ${
                      status === 'overdue' ? 'text-destructive' :
                      status === 'paid'    ? 'text-success' :
                      'text-warning'
                    }`}>
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">
                        {status === 'paid'
                          ? `Paga após ${daysElapsed} dia${daysElapsed !== 1 ? 's' : ''}`
                          : `${daysElapsed} dia${daysElapsed !== 1 ? 's' : ''} desde a emissão`}
                        {status === 'overdue' && ` (${daysElapsed - 30}d em atraso)`}
                      </span>
                    </div>
                  )}

                  {settlementName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{settlementName}</span>
                    </div>
                  )}

                  {s.dam_receipt_url && (
                    <div className="flex items-center gap-2 text-success">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <a
                        href={s.dam_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline truncate"
                      >
                        Ver comprovante
                      </a>
                    </div>
                  )}

                  {s.purpose && (
                    <p className="text-xs text-muted-foreground line-clamp-1 pt-1 border-t">
                      {s.purpose}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {status !== 'paid' ? (
                  <Button
                    size="sm"
                    className="w-full bg-success hover:bg-success/90 text-white gap-1.5"
                    onClick={() => openPayDialog(s)}
                    disabled={updateService.isPending}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Marcar como Paga
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-muted-foreground"
                    onClick={() => handleMarkUnpaid(s)}
                    disabled={updateService.isPending}
                  >
                    <XCircle className="h-4 w-4" />
                    Reverter para Pendente
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mark as Paid Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento da DAM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {payingService && (
              <p className="text-sm text-muted-foreground">
                Produtor:{' '}
                <strong className="text-foreground">
                  {producers.find(p => p.id === payingService.producer_id)?.name ||
                   payingService.producers?.name || '—'}
                </strong>
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Data de Pagamento</Label>
              <Input
                id="pay-date"
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-file">Comprovante de Pagamento (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="receipt-file"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </div>
              {receiptFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {receiptFile.name} ({(receiptFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">PDF ou imagem (máx. 10 MB)</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-success hover:bg-success/90 text-white gap-1.5"
              onClick={handleMarkPaid}
              disabled={!payDate || updateService.isPending || receiptUploading}
            >
              {receiptUploading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
