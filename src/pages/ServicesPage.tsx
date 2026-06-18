import { useState, useEffect, useMemo } from 'react';
import logoTransparent from '@/assets/logo-transparent.png';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ServiceForm } from '@/components/forms/ServiceForm';
import { DEMAND_CATEGORIES } from '@/components/forms/DemandTypeForm';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isDamOverdue as checkDamOverdue } from '@/lib/damUtils';
import {
  Plus, Pencil, Trash2, Archive, CheckCircle, Eye,
  FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, X, XCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceDetailView } from '@/components/ServiceDetailView';
import {
  useServices,
  useProducers,
  useDemandTypes,
  useSettlements,
  useLocations,
  useMachinery,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useResponsibleTechnicians,
} from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const ITEMS_PER_PAGE = 10;

// Helper: parse a Supabase date/timestamp string to a local-safe Date
function parseSupabaseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  return new Date(raw.replace(' ', 'T'));
}

// Helper: convert YYYY-MM-DD date input value to ISO string stored as UTC noon
// (UTC noon = safe across all timezones: UTC-12 → UTC+14 all show the same calendar day)
function dateInputToIso(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

// Helper: extract YYYY-MM-DD from a stored ISO/timestamp for a date input
function isoToDateInput(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(' ', 'T').substring(0, 10);
}

async function uploadDamReceipt(file: File, serviceId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `${serviceId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('dam-receipts').upload(path, file, { upsert: true });
  if (error) {
    console.error('DAM receipt upload error:', error);
    return null;
  }
  const { data } = await supabase.storage.from('dam-receipts').createSignedUrl(path, 60 * 60 * 24 * 3650);
  return data?.signedUrl ?? null;
}

interface DbService {
  id: string;
  producer_id: string;
  demand_type_id: string;
  settlement_id?: string | null;
  location_id?: string | null;
  status: string;
  scheduled_date: string;
  appointment_date?: string | null;
  completed_at?: string | null;
  cancellation_reason?: string | null;
  purpose?: string | null;
  notes?: string | null;
  completion_notes?: string | null;
  priority: string;
  operator_id?: string | null;
  machinery_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  worked_area?: number | null;
  created_by?: string | null;
  // DAM fields
  dam_issued?: boolean | null;
  dam_paid?: boolean | null;
  dam_issued_at?: string | null;
  dam_paid_at?: string | null;
  dam_receipt_url?: string | null;
  limestone_quantity?: number | null;
  input_quantity?: number | null;
  fuel_liters?: number | null;
  worked_hours?: number | null;
  responsible_technician_id?: string | null;
  producers?: { name: string; phone?: string | null; location_name?: string | null; latitude?: number | null; longitude?: number | null } | null;
  demand_types?: { name: string } | null;
  settlements?: { name: string } | null;
  locations?: { name: string } | null;
  machinery?: { name: string; patrimony_number: string } | null;
  profiles?: { name: string } | null;
}

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: producers = [] } = useProducers();
  const { data: demandTypes = [] } = useDemandTypes();
  const { data: settlements = [] } = useSettlements();
  const { data: locations = [] } = useLocations();
  const { data: machinery = [] } = useMachinery();
  const { data: operators = [] } = useOperators();
  const { data: responsibleTechnicians = [] } = useResponsibleTechnicians();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get('tab') === 'archived' ? 'archived' : 'active'
  );
  const [demandTypeFilter, setDemandTypeFilter] = useState<string>('all');
  // Categoria via URL (?category=calcario) — usado pelos cards da página de Análise
  const [categoryFilter, setCategoryFilter] = useState<string>(
    searchParams.get('category') || 'all'
  );
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<DbService | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<DbService | null>(null);

  // Finalization dialog — replaces ConfirmDialog for archiving
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [serviceToFinalize, setServiceToFinalize] = useState<DbService | null>(null);
  const [finalizeDate, setFinalizeDate] = useState('');

  // Cancellation dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [serviceToCancel, setServiceToCancel] = useState<DbService | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [detailService, setDetailService] = useState<DbService | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Auto-open detail sheet when ?detail=ID is in the URL (e.g. navigated from producer history).
  // M-07: também ajusta a tab para que a tabela por trás mostre o grupo correto do serviço.
  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId && (services as DbService[]).length > 0) {
      const found = (services as DbService[]).find(s => s.id === detailId);
      if (found) {
        setDetailService(found);
        setDetailOpen(true);
        // Switch tab so the background list matches the service's status group
        setStatusFilter(
          found.status === 'completed' || found.status === 'cancelled' ? 'archived' : 'active'
        );
      }
    }
  }, [searchParams, services]);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, demandTypeFilter, categoryFilter, settlementFilter, dateFrom, dateTo]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('services_page_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        queryClient.invalidateQueries({ queryKey: ['services'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filteredServices = useMemo(() => services.filter((s: DbService) => {
    const dt = demandTypes.find(d => d.id === s.demand_type_id);
    if ((dt as any)?.category === 'entregas') return false;
    const producer = producers.find(p => p.id === s.producer_id);
    const matchesSearch =
      producer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      producer?.cpf?.includes(search) ||
      s.producers?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesDemandType = demandTypeFilter === 'all' || s.demand_type_id === demandTypeFilter;
    const matchesCategory = categoryFilter === 'all' || (dt as any)?.category === categoryFilter;
    const matchesStatus = statusFilter === 'active'
      ? s.status === 'pending' || s.status === 'in_progress' || s.status === 'proximo'
      : s.status === 'completed' || s.status === 'cancelled';
    const matchesSettlement =
      settlementFilter === 'all' || s.settlement_id === settlementFilter;
    // Date range uses scheduled_date (YYYY-MM-DD string — direct comparison works)
    const sDate = s.scheduled_date?.substring(0, 10) ?? '';
    const matchesDateFrom = !dateFrom || sDate >= dateFrom;
    const matchesDateTo   = !dateTo   || sDate <= dateTo;
    return matchesSearch && matchesDemandType && matchesCategory && matchesStatus && matchesSettlement && matchesDateFrom && matchesDateTo;
  }), [services, producers, demandTypes, search, demandTypeFilter, categoryFilter, statusFilter, settlementFilter, dateFrom, dateTo]);

  const sortedServices = useMemo(() => [...filteredServices].sort((a: DbService, b: DbService) => {
    if (statusFilter === 'active') {
      // "proximo" always appear first, sorted by their drag-and-drop position
      const aIsProximo = a.status === 'proximo';
      const bIsProximo = b.status === 'proximo';
      if (aIsProximo && !bIsProximo) return -1;
      if (!aIsProximo && bIsProximo) return 1;
      if (aIsProximo && bIsProximo) {
        const posA = (a as any).position ?? 999999;
        const posB = (b as any).position ?? 999999;
        if (posA !== posB) return posA - posB;
      }
      return new Date(a.scheduled_date + 'T12:00:00').getTime() - new Date(b.scheduled_date + 'T12:00:00').getTime();
    }
    const aDate = parseSupabaseDate(a.completed_at || a.updated_at);
    const bDate = parseSupabaseDate(b.completed_at || b.updated_at);
    return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
  }), [filteredServices, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedServices.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedServices = sortedServices.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async (data: any) => {
    const producer = producers.find(p => p.id === data.producerId);

    // Determine completed_at on create
    let completedAt: string | null = null;
    if (isAdmin && data.completedAt) {
      completedAt = dateInputToIso(data.completedAt);
    } else if (data.status === 'completed') {
      completedAt = new Date().toISOString();
    }

    // Upload DAM receipt if provided
    let receiptUrl: string | null = null;
    if (data.damReceiptFile && data.damPaid) {
      receiptUrl = await uploadDamReceipt(data.damReceiptFile, 'new-' + Date.now());
    }

    createService.mutate({
      producer_id: data.producerId,
      demand_type_id: data.demandTypeId,
      status: data.status || 'pending',
      purpose: data.purpose || undefined,
      settlement_id: producer?.settlement_id || data.settlementId,
      location_id: producer?.location_id || data.locationId,
      scheduled_date: data.scheduledDate,
      ...(data.appointmentDate ? { appointment_date: data.appointmentDate } : {}),
      ...(completedAt ? { completed_at: completedAt } : {}),
      notes: data.notes,
      priority: data.priority || 'medium',
      worked_area: data.workedArea || null,
      operator_id: data.operatorId && data.operatorId !== 'none' ? data.operatorId : null,
      machinery_id: data.machineryId && data.machineryId !== 'none' ? data.machineryId : null,
      dam_issued: data.damIssued ?? false,
      dam_paid: data.damPaid ?? false,
      ...(data.damIssued && data.damIssuedAt ? { dam_issued_at: data.damIssuedAt } : {}),
      ...(data.damPaid && data.damPaidAt ? { dam_paid_at: data.damPaidAt } : {}),
      ...(receiptUrl ? { dam_receipt_url: receiptUrl } : {}),
      ...(data.limestoneQuantity ? { limestone_quantity: data.limestoneQuantity } : {}),
      ...(data.inputQuantity ? { input_quantity: data.inputQuantity } : {}),
      fuel_liters: data.fuelLiters || null,
      worked_hours: data.workedHours || null,
      responsible_technician_id: data.responsibleTechnicianId && data.responsibleTechnicianId !== 'none' ? data.responsibleTechnicianId : null,
    });
    setFormOpen(false);
  };

  const handleEdit = async (data: any) => {
    if (!editingService) return;
    const producer = producers.find(p => p.id === data.producerId);

    // Invariante: completed_at só existe quando status === 'completed'.
    // Em qualquer outro status (pendente, em execução, próximo) é limpo,
    // evitando que a data de finalização persista ao reabrir o atendimento.
    let completedAt: string | null = null;
    if (data.status === 'completed') {
      if (isAdmin && data.completedAt) {
        completedAt = dateInputToIso(data.completedAt);          // admin define data custom
      } else {
        completedAt = editingService.completed_at ?? new Date().toISOString(); // mantém ou marca agora
      }
    }

    // Upload DAM receipt if provided
    let receiptUrl: string | null = editingService.dam_receipt_url ?? null;
    if (data.damReceiptFile && data.damPaid) {
      const uploaded = await uploadDamReceipt(data.damReceiptFile, editingService.id);
      if (uploaded) receiptUrl = uploaded;
    }

    updateService.mutate({
      id: editingService.id,
      producer_id: data.producerId,
      demand_type_id: data.demandTypeId,
      settlement_id: producer?.settlement_id || editingService.settlement_id,
      location_id: producer?.location_id || editingService.location_id,
      scheduled_date: data.scheduledDate,
      ...(data.appointmentDate ? { appointment_date: data.appointmentDate } : {}),
      purpose: data.purpose || null,
      notes: data.notes || null,
      status: data.status,
      priority: data.priority || editingService.priority,
      worked_area: data.workedArea || null,
      operator_id: data.operatorId && data.operatorId !== 'none' ? data.operatorId : null,
      machinery_id: data.machineryId && data.machineryId !== 'none' ? data.machineryId : null,
      completed_at: completedAt,
      dam_issued: data.damIssued ?? false,
      dam_paid: data.damPaid ?? false,
      dam_issued_at: (data.damIssued && data.damIssuedAt) ? data.damIssuedAt : null,
      dam_paid_at: (data.damPaid && data.damPaidAt) ? data.damPaidAt : null,
      dam_receipt_url: receiptUrl,
      limestone_quantity: data.limestoneQuantity || null,
      input_quantity: data.inputQuantity || null,
      fuel_liters: data.fuelLiters || null,
      worked_hours: data.workedHours || null,
      responsible_technician_id: data.responsibleTechnicianId && data.responsibleTechnicianId !== 'none' ? data.responsibleTechnicianId : null,
    });
    setEditingService(null);
    setFormOpen(false);
  };

  const handleDelete = () => {
    if (serviceToDelete) {
      deleteService.mutate(serviceToDelete.id);
      setServiceToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const openFinalizeDialog = (service: DbService) => {
    setDetailOpen(false);
    setServiceToFinalize(service);
    setFinalizeDate(format(new Date(), 'yyyy-MM-dd'));
    setFinalizeDialogOpen(true);
  };

  const handleFinalize = () => {
    if (!serviceToFinalize) return;
    const completedAt = finalizeDate
      ? dateInputToIso(finalizeDate)
      : new Date().toISOString();
    updateService.mutate({
      id: serviceToFinalize.id,
      status: 'completed',
      completed_at: completedAt,
    });
    setServiceToFinalize(null);
    setFinalizeDialogOpen(false);
  };

  const openCancelDialog = (service: DbService) => {
    setDetailOpen(false);
    setServiceToCancel(service);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleCancel = () => {
    if (!serviceToCancel) return;
    updateService.mutate({
      id: serviceToCancel.id,
      status: 'cancelled',
      cancellation_reason: cancelReason.trim() || null,
    });
    setServiceToCancel(null);
    setCancelDialogOpen(false);
  };

  const openEditForm = (service: DbService) => {
    setDetailOpen(false);
    setEditingService(service);
    setFormOpen(true);
  };

  const openDeleteDialog = (service: DbService) => {
    setDetailOpen(false);
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const openDetail = (service: DbService) => {
    setDetailService(service);
    setDetailOpen(true);
  };

  // ── mappers ───────────────────────────────────────────────────────────────

  const mapServiceForForm = (s: DbService | null) => {
    if (!s) return null;
    return {
      id: s.id,
      producerId: s.producer_id,
      demandTypeId: s.demand_type_id,
      settlementId: s.settlement_id || '',
      locationId: s.location_id || '',
      status: s.status as 'pending' | 'in_progress' | 'completed' | 'proximo' | 'cancelled',
      scheduledDate: new Date(s.scheduled_date + 'T12:00:00'),
      appointmentDate: isoToDateInput(s.appointment_date),
      completedAt: isoToDateInput(s.completed_at),
      purpose: s.purpose || undefined,
      notes: s.notes || undefined,
      priority: (s.priority || 'medium') as 'low' | 'medium' | 'high',
      workedArea: s.worked_area || 0,
      operatorId: s.operator_id || '',
      machineryId: s.machinery_id || '',
      createdAt: new Date(s.created_at || Date.now()),
      updatedAt: new Date(s.updated_at || Date.now()),
      damIssued: s.dam_issued ?? false,
      damPaid: s.dam_paid ?? false,
      damIssuedAt: s.dam_issued_at || '',
      limestoneQuantity: s.limestone_quantity || 0,
      inputQuantity: s.input_quantity || 0,
      fuelLiters: s.fuel_liters || 0,
      workedHours: s.worked_hours || 0,
      damPaidAt: s.dam_paid_at || '',
      responsibleTechnicianId: s.responsible_technician_id || '',
    };
  };

  const mappedProducers = producers.map((p: any) => ({
    id: p.id,
    name: p.name,
    cpf: p.cpf,
    phone: p.phone || '',
    settlementId: p.settlement_id || '',
    locationId: p.location_id || '',
    locationName: p.location_name || '',
    demandTypeIds: p.producer_demands?.map((d: { demand_type_id: string }) => d.demand_type_id) || [],
    createdAt: new Date(p.created_at || Date.now()),
  }));

  const mappedSettlements = settlements.map(s => ({
    id: s.id,
    name: s.name,
    createdAt: new Date(s.created_at || Date.now()),
  }));

  const mappedLocations = locations.map(l => ({
    id: l.id,
    name: l.name,
    settlementId: l.settlement_id,
    createdAt: new Date(l.created_at || Date.now()),
  }));

  const mappedDemandTypes = demandTypes.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description || undefined,
    isActive: d.is_active ?? true,
    createdAt: new Date(d.created_at || Date.now()),
    category: (d as any).category || null,
  }));

  // ── columns ───────────────────────────────────────────────────────────────

  // M-02: usar isDamOverdue centralizado em damUtils (regra de 30 dias — fonte única)
  const isDamOverdue = (s: DbService): boolean =>
    !!s.dam_issued && checkDamOverdue(s.dam_issued_at, s.dam_paid);

  const columns = [
    {
      key: 'producer',
      header: 'Produtor',
      render: (s: DbService) => {
        const producer = producers.find(p => p.id === s.producer_id);
        const overdue = isDamOverdue(s);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{producer?.name || s.producers?.name || 'N/A'}</span>
            {overdue && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 rounded px-1.5 py-0.5 w-fit">
                ⚠ DAM em atraso
              </span>
            )}
            {s.dam_issued && !s.dam_paid && !overdue && (
              <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 rounded px-1.5 py-0.5 w-fit">
                DAM pendente
              </span>
            )}
            {s.dam_issued && s.dam_paid && (
              <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 rounded px-1.5 py-0.5 w-fit">
                DAM paga
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'demandType',
      header: 'Tipo',
      className: 'hidden md:table-cell',
      render: (s: DbService) => {
        const dt = demandTypes.find(d => d.id === s.demand_type_id);
        return <span className="text-sm">{dt?.name || s.demand_types?.name || 'N/A'}</span>;
      },
    },
    {
      key: 'settlement',
      header: 'Assentamento',
      className: 'hidden lg:table-cell',
      render: (s: DbService) => {
        const st = settlements.find(set => set.id === s.settlement_id);
        return <span className="text-sm">{st?.name || s.settlements?.name || 'N/A'}</span>;
      },
    },
    {
      key: 'dates',
      header: 'Datas',
      render: (s: DbService) => {
        const createdAt = parseSupabaseDate(s.created_at);
        const completedAt = parseSupabaseDate(s.completed_at);
        const registeredBy = (s as any).profiles?.name;
        return (
          <div className="flex flex-col gap-0.5">
            <StatusBadge status={s.status as 'pending' | 'in_progress' | 'completed'} />
            {createdAt && (
              <span className="text-xs text-muted-foreground">
                Cadastro: {format(createdAt, 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {completedAt && (
              <span className="text-xs text-green-600 font-medium">
                Finalizado: {format(completedAt, 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
            {registeredBy && (
              <span className="text-xs text-muted-foreground truncate max-w-[110px]" title={registeredBy}>
                por {registeredBy}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (s: DbService) => (
        <Button variant="ghost" size="icon" onClick={() => openDetail(s)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ── counts ────────────────────────────────────────────────────────────────

  const activeCount = services.filter((s: DbService) =>
    s.status === 'pending' || s.status === 'in_progress' || s.status === 'proximo'
  ).length;
  const archivedCount = services.filter((s: DbService) =>
    s.status === 'completed' || s.status === 'cancelled'
  ).length;

  // ── detail view data ──────────────────────────────────────────────────────

  const detailProducerFull = detailService ? producers.find(p => p.id === detailService.producer_id) : null;
  const detailDemandType = detailService ? demandTypes.find(d => d.id === detailService.demand_type_id) : null;
  const detailSettlement = detailService ? settlements.find(s => s.id === detailService.settlement_id) : null;
  const detailLocation = detailService ? locations.find(l => l.id === detailService.location_id) : null;

  // ── export ────────────────────────────────────────────────────────────────

  const handleExportPDF = () => {
    const img = new Image();
    img.onload = () => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Logo no canto superior esquerdo
      const logoW = 52;
      const logoH = logoW * (img.naturalHeight / img.naturalWidth);
      doc.addImage(img, 'PNG', 14, 6, logoW, logoH);

      // Título e subtítulo centralizados verticalmente com a logo
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(45, 90, 39); // verde escuro da logo
      doc.text('Relatório de Atendimentos', pageWidth / 2, 16, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const tabLabel = statusFilter === 'active' ? 'Ativos' : 'Arquivados';
      doc.text(
        `${tabLabel} · Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2, 23, { align: 'center' }
      );

      // Linha separadora
      doc.setDrawColor(200);
      const headerH = Math.max(logoH + 10, 32);
      doc.line(14, headerH, pageWidth - 14, headerH);
      doc.setTextColor(0);

      const statusLabel = (s: string) =>
        s === 'pending' ? 'Pendente' : s === 'in_progress' ? 'Em Execução' : 'Finalizado';

      const rows = sortedServices.map((s: DbService) => {
        const producer = producers.find(p => p.id === s.producer_id);
        const dt = demandTypes.find(d => d.id === s.demand_type_id);
        const st = settlements.find(set => set.id === s.settlement_id);
        const createdAt = parseSupabaseDate(s.created_at);
        const completedAt = parseSupabaseDate(s.completed_at);
        return [
          producer?.name || s.producers?.name || 'N/A',
          dt?.name || s.demand_types?.name || 'N/A',
          st?.name || s.settlements?.name || 'N/A',
          createdAt ? format(createdAt, 'dd/MM/yyyy', { locale: ptBR }) : '-',
          completedAt ? format(completedAt, 'dd/MM/yyyy', { locale: ptBR }) : '-',
          statusLabel(s.status),
          (s as any).profiles?.name || '-',
        ];
      });

      autoTable(doc, {
        startY: headerH + 4,
        head: [['Produtor', 'Demanda', 'Assentamento', 'Cadastro', 'Finalização', 'Status', 'Cadastrado por']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [45, 90, 39], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`atendimentos-${statusFilter}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };
    img.src = logoTransparent;
  };

  // ── loading ───────────────────────────────────────────────────────────────

  if (servicesLoading) {
    return (
      <AppLayout>
        <PageHeader title="Atendimentos" description="Gerenciar atendimentos" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <PageHeader
        title="Atendimentos"
        description="Gerenciar atendimentos"
        action={{ label: 'Novo', onClick: () => { setEditingService(null); setFormOpen(true); }, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />
      <div className="flex justify-end mb-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/import')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Importar Planilha
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            Ativos <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs">{activeCount}</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            Arquivados <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{archivedCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="space-y-2 mb-4">
        {/* Row 1: search + export */}
        <div className="flex gap-2 items-center flex-wrap">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setCurrentPage(1); }} placeholder="Buscar por produtor..." className="flex-1 min-w-[140px]" />
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5 shrink-0">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        </div>

        {/* Row 2: type + settlement + date range + clear */}
        <div className="flex gap-2 items-center flex-wrap">
          {/* Demand type */}
          <Select value={demandTypeFilter} onValueChange={(v) => { setDemandTypeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px] sm:w-[170px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {demandTypes.filter(d => (d as any).category !== 'entregas').map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Settlement */}
          <Select value={settlementFilter} onValueChange={(v) => { setSettlementFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px] sm:w-[180px]">
              <SelectValue placeholder="Assentamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos assentamentos</SelectItem>
              {(settlements as any[]).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date from */}
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground shrink-0">De</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="h-9 w-[130px] text-sm"
            />
          </div>

          {/* Date to */}
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground shrink-0">Até</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="h-9 w-[130px] text-sm"
            />
          </div>

          {/* Clear filters button — only when something is active */}
          {(demandTypeFilter !== 'all' || categoryFilter !== 'all' || settlementFilter !== 'all' || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDemandTypeFilter('all');
                setCategoryFilter('all');
                setSettlementFilter('all');
                setDateFrom('');
                setDateTo('');
                setCurrentPage(1);
              }}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        {/* Active category chip (navegação vinda da Análise) */}
        {categoryFilter !== 'all' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1">
              Categoria: {DEMAND_CATEGORIES.find(c => c.value === categoryFilter)?.label ?? categoryFilter}
              <button
                type="button"
                aria-label="Remover filtro de categoria"
                onClick={() => setCategoryFilter('all')}
                className="hover:text-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      <DataTable
        data={pagedServices}
        columns={columns}
        keyExtractor={(s) => s.id}
        emptyMessage={statusFilter === 'active' ? 'Nenhum atendimento ativo' : 'Nenhum atendimento arquivado'}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            {filteredServices.length} registro(s) · página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                  : (
                    <Button
                      key={p}
                      variant={safePage === p ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setCurrentPage(p as number)}
                      className="w-8 h-8 text-xs"
                    >
                      {p}
                    </Button>
                  )
              )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Detalhes do Atendimento</SheetTitle>
          </SheetHeader>
          {detailService && (
            <ServiceDetailView
              service={detailService}
              producer={detailProducerFull ? {
                name: detailProducerFull.name,
                cpf: detailProducerFull.cpf,
                phone: detailProducerFull.phone || detailService.producers?.phone || undefined,
                location_name: detailProducerFull.location_name || detailService.producers?.location_name || undefined,
                latitude: detailProducerFull.latitude ?? detailService.producers?.latitude ?? undefined,
                longitude: detailProducerFull.longitude ?? detailService.producers?.longitude ?? undefined,
              } : detailService.producers ? {
                name: detailService.producers.name,
                cpf: '',
                phone: detailService.producers.phone || undefined,
                location_name: detailService.producers.location_name || undefined,
                latitude: detailService.producers.latitude ?? undefined,
                longitude: detailService.producers.longitude ?? undefined,
              } : null}
              demandType={detailDemandType ? { name: detailDemandType.name } : null}
              settlement={detailSettlement ? { name: detailSettlement.name } : null}
              location={detailLocation ? { name: detailLocation.name } : null}
              onEdit={() => openEditForm(detailService)}
              onDelete={() => openDeleteDialog(detailService)}
              onFinalize={detailService.status !== 'completed' ? () => openFinalizeDialog(detailService) : undefined}
              onCancel={() => openCancelDialog(detailService)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Finalize Dialog — with custom date (admin) or simple confirm (operator) */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? 'Defina a data de finalização e confirme.'
                : 'Ao finalizar, este atendimento será arquivado.'}
            </p>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="finalize-date">Data de Finalização</Label>
                <Input
                  id="finalize-date"
                  type="date"
                  value={finalizeDate}
                  onChange={e => setFinalizeDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-success hover:bg-success/90 text-white"
              onClick={handleFinalize}
              disabled={isAdmin && !finalizeDate}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog — motivo obrigatório */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo do cancelamento. Ele ficará registrado no histórico do produtor.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Motivo *</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ex: produtor desistiu, duplicidade, erro de cadastro..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || updateService.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Form */}
      <ServiceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        isAdmin={isAdmin}
        service={mapServiceForForm(editingService)}
        producers={mappedProducers}
        settlements={mappedSettlements}
        locations={mappedLocations}
        demandTypes={mappedDemandTypes}
        operators={(operators || []).filter(op => op.is_active).map(op => ({ id: op.id, name: op.name }))}
        machinery={(machinery || []).filter((m: any) => m.is_active).map((m: any) => ({ id: m.id, name: m.name, patrimony_number: m.patrimony_number }))}
        responsibleTechnicians={(responsibleTechnicians as any[]).filter((t: any) => t.is_active).map((t: any) => ({ id: t.id, name: t.name, cargo: t.cargo }))}
        onSubmit={editingService ? handleEdit : handleCreate}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Atendimento"
        description="Tem certeza que deseja excluir este atendimento? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        confirmLabel="Excluir"
        variant="destructive"
      />
    </AppLayout>
  );
}
