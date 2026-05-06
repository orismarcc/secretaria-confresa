import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useDeliveries,
  useCreateDelivery,
  useUpdateDelivery,
  useDeleteDelivery,
  useProducers,
  useDemandTypes,
  useSettlements,
} from '@/hooks/useSupabaseData';

interface DeliveryFormData {
  producer_id: string;
  demand_type_id: string;
  settlement_id: string;
  quantity: string;
  notes: string;
  delivery_date_start: string;
  delivery_date_end: string;
}

const EMPTY_FORM: DeliveryFormData = {
  producer_id: '',
  demand_type_id: '',
  settlement_id: '',
  quantity: '',
  notes: '',
  delivery_date_start: '',
  delivery_date_end: '',
};

export default function DeliveriesPage() {
  const { data: deliveries = [], isLoading } = useDeliveries();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const deleteDelivery = useDeleteDelivery();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DeliveryFormData>(EMPTY_FORM);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');

  // Mark as realized dialog
  const [realizeDialogOpen, setRealizeDialogOpen] = useState(false);
  const [realizeId, setRealizeId] = useState<string | null>(null);
  const [realizeName, setRealizeName] = useState('');
  const [realizeDate, setRealizeDate] = useState('');

  // Only delivery-category demand types
  const deliveryDemandTypes = useMemo(() =>
    (demandTypes as any[]).filter(d => d.category === 'entregas' && d.is_active !== false),
    [demandTypes]
  );

  const pendingCount = useMemo(
    () => (deliveries as any[]).filter(d => !d.status || d.status === 'pending').length,
    [deliveries]
  );
  const completedCount = useMemo(
    () => (deliveries as any[]).filter(d => d.status === 'completed').length,
    [deliveries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (deliveries as any[]).filter(d => {
      const isPending = !d.status || d.status === 'pending';
      const matchesTab = tab === 'pending' ? isPending : d.status === 'completed';
      const producerName = d.producers?.name || '';
      const demandName = d.demand_types?.name || '';
      const matchesSearch = producerName.toLowerCase().includes(q) || demandName.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    }).sort((a: any, b: any) => {
      if (tab === 'completed') {
        const aDate = a.completed_at || a.created_at || '';
        const bDate = b.completed_at || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  }, [deliveries, search, tab]);

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
      settlement_id: d.settlement_id || '',
      quantity: d.quantity != null ? String(d.quantity) : '',
      notes: d.notes || '',
      delivery_date_start: d.delivery_date_start ? d.delivery_date_start.slice(0, 10) : '',
      delivery_date_end: d.delivery_date_end ? d.delivery_date_end.slice(0, 10) : '',
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
    const payload = {
      producer_id: formData.producer_id,
      demand_type_id: formData.demand_type_id,
      settlement_id: formData.settlement_id || null,
      quantity: formData.quantity ? Number(formData.quantity) : null,
      notes: formData.notes || null,
      delivery_date_start: formData.delivery_date_start || null,
      delivery_date_end: formData.delivery_date_end || null,
    };

    if (!payload.producer_id || !payload.demand_type_id) return;

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
    try { return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR }); } catch { return dateStr; }
  };

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

  return (
    <AppLayout>
      <PageHeader
        title="Entregas"
        description="Controle de entregas aos produtores"
        action={{
          label: 'Nova Entrega',
          onClick: openCreate,
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'completed')} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            <span className="bg-warning/20 text-warning px-2 py-0.5 rounded-full text-xs">{pendingCount}</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            Realizadas
            <span className="bg-success/20 text-success px-2 py-0.5 rounded-full text-xs">{completedCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por produtor ou tipo..." className="max-w-sm" />
      </div>

      {/* Delivery Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Package className="h-12 w-12 opacity-30" />
          <p>{tab === 'pending' ? 'Nenhuma entrega pendente' : 'Nenhuma entrega realizada'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d: any) => {
            const startDate = formatDate(d.delivery_date_start);
            const endDate = formatDate(d.delivery_date_end);
            const completedDate = d.completed_at ? formatDate(d.completed_at.slice(0, 10)) : null;
            const isCompleted = d.status === 'completed';

            return (
              <div
                key={d.id}
                className={`rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow ${
                  isCompleted ? 'border-success/30 bg-success/5' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-0.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-medium text-foreground">{d.producers?.name || '—'}</span>
                    </div>
                    <Badge variant={isCompleted ? 'default' : 'secondary'} className={`text-xs ${isCompleted ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' : ''}`}>
                      {d.demand_types?.name || '—'}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isCompleted && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                          title="Marcar como realizada"
                          onClick={() => openRealize(d)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {isCompleted && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => openDelete(d)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Completed badge */}
                {isCompleted && completedDate && (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-success">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>Realizada em {completedDate}</span>
                  </div>
                )}

                {/* Details */}
                <div className="space-y-1.5 text-sm">
                  {d.quantity != null && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5 shrink-0" />
                      <span>Quantidade: <span className="text-foreground font-medium">{d.quantity}</span></span>
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
                    <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t">{d.notes}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>{d.settlements?.name || '—'}</span>
                  {d.profiles?.name && <span>por {d.profiles.name}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Entrega' : 'Nova Entrega'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Producer */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Produtor *</label>
              <Select value={formData.producer_id} onValueChange={v => setFormData(f => ({ ...f, producer_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produtor" />
                </SelectTrigger>
                <SelectContent>
                  {(producers as any[]).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Demand Type (entregas only) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de Entrega *</label>
              <Select value={formData.demand_type_id} onValueChange={v => setFormData(f => ({ ...f, demand_type_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryDemandTypes.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Settlement */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Assentamento</label>
              <Select
                value={formData.settlement_id || '__none__'}
                onValueChange={v => setFormData(f => ({ ...f, settlement_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o assentamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {(settlements as any[]).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))}
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data Início</label>
                <Input
                  type="date"
                  value={formData.delivery_date_start}
                  onChange={e => setFormData(f => ({ ...f, delivery_date_start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data Fim</label>
                <Input
                  type="date"
                  value={formData.delivery_date_end}
                  onChange={e => setFormData(f => ({ ...f, delivery_date_end: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                placeholder="Informações adicionais..."
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.producer_id || !formData.demand_type_id || createDelivery.isPending || updateDelivery.isPending}
              >
                {editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Realize Dialog */}
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
                onChange={e => setRealizeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRealizeDialogOpen(false)}>Cancelar</Button>
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
