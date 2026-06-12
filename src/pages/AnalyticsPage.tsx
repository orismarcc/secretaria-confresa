import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useServices, useSettlements, useDemandTypes, useDeliveries, useProducers } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import { format, parseISO, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, Minus, MapPin, ClipboardList, Tractor, Users2, Package, Layers,
  FileDown, Truck, Stethoscope, Fuel, Clock, Timer, CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatrulhaIds, getDemandIdsByCategory, getDemandIdsByNameSubstring } from '@/lib/analyticsUtils';
import { ReportsCenter } from '@/components/ReportsCenter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoTransparent from '@/assets/logo-transparent.png';

// ─── Custom Recharts tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Ranking item ─────────────────────────────────────────────────────────────
interface RankingItemProps {
  position: number;
  name: string;
  count: number;
  maxCount: number;
  /** Finalised Patrulha Mecanizada services for this settlement */
  patrulha?: number;
  /** Total registered producers linked to this settlement */
  producersCount?: number;
}

const rankConfig = [
  { label: '1°', cardClass: 'bg-warning/5 border-warning/30', badgeClass: 'bg-warning text-warning-foreground', barClass: 'bg-warning', textClass: 'text-warning' },
  { label: '2°', cardClass: 'bg-primary/5 border-primary/20', badgeClass: 'bg-primary text-primary-foreground', barClass: 'bg-primary', textClass: 'text-primary' },
  { label: '3°', cardClass: 'bg-secondary/5 border-secondary/20', badgeClass: 'bg-secondary text-secondary-foreground', barClass: 'bg-secondary', textClass: 'text-secondary' },
  { label: '4°', cardClass: 'bg-muted/30 border-border', badgeClass: 'bg-muted text-muted-foreground', barClass: 'bg-muted-foreground/50', textClass: 'text-muted-foreground' },
  { label: '5°', cardClass: 'bg-muted/30 border-border', badgeClass: 'bg-muted text-muted-foreground', barClass: 'bg-muted-foreground/50', textClass: 'text-muted-foreground' },
];

// ─── Período global dos gráficos ─────────────────────────────────────────────
type ChartPeriod = '3m' | '6m' | '12m' | 'year' | 'all';

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: '3m', label: '3m' },
  { value: '6m', label: '6m' },
  { value: '12m', label: '12m' },
  { value: 'year', label: 'Ano' },
  { value: 'all', label: 'Tudo' },
];

function RankingItem({ position, name, count, maxCount, patrulha, producersCount }: RankingItemProps) {
  const config = rankConfig[position - 1];
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className={cn('flex items-center gap-4 p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm', config.cardClass)}>
      <div className={cn('flex items-center justify-center w-11 h-11 rounded-full text-sm font-black shrink-0 shadow-sm', config.badgeClass)}>
        {config.label}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-foreground truncate">{name}</p>
          <span className={cn('text-2xl font-black tabular-nums shrink-0', config.textClass)}>{count}</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700', config.barClass)} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? 'finalizado' : 'finalizados'}
            {position > 1 && ` · ${pct}%`}
          </p>
          {patrulha !== undefined && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-500/10 rounded-full px-2 py-0.5 font-medium">
              <Tractor className="h-3 w-3" />
              {patrulha} PM
            </span>
          )}
          {producersCount !== undefined && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
              <Users2 className="h-3 w-3" />
              {producersCount} prod.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements();
  const { data: demandTypes = [], isLoading: demandTypesLoading } = useDemandTypes();
  const { data: operators = [] } = useOperators();
  const { data: deliveries = [] } = useDeliveries();
  const { data: producers = [] } = useProducers();

  const isLoading = servicesLoading || settlementsLoading || demandTypesLoading;

  // ── Período global dos gráficos ─────────────────────────────────────────────
  const [period, setPeriod] = useState<ChartPeriod>('6m');

  const monthsCount = useMemo(() => {
    const now = new Date();
    switch (period) {
      case '3m': return 3;
      case '6m': return 6;
      case '12m': return 12;
      case 'year': return now.getMonth() + 1; // Jan até o mês atual
      case 'all': {
        const dates = (services as any[])
          .map(s => parseISO((s.created_at || s.scheduled_date || '').replace(' ', 'T')))
          .filter(d => !isNaN(d.getTime()));
        if (dates.length === 0) return 6;
        const earliest = dates.reduce((a, b) => (a < b ? a : b));
        // +1 inclui o mês corrente; limitado a 24 p/ legibilidade do gráfico
        return Math.min(24, Math.max(6, differenceInCalendarMonths(now, earliest) + 1));
      }
    }
  }, [period, services]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'year': return `Ano de ${new Date().getFullYear()}`;
      case 'all': return `Todo o período (últimos ${monthsCount} meses)`;
      default: return `Últimos ${monthsCount} meses`;
    }
  }, [period, monthsCount]);

  // ── Category quick stats — COMPLETED ONLY ──────────────────────────────────
  // M-03: use shared helper
  const patrulhaCount = useMemo(() => {
    const ids = getPatrulhaIds(demandTypes as any[]);
    return (services as any[]).filter(s => s.status === 'completed' && ids.has(s.demand_type_id)).length;
  }, [services, demandTypes]);

  const entregasCount = useMemo(() =>
    (deliveries as any[]).filter((d: any) => d.status === 'completed').length,
    [deliveries]
  );

  /**
   * Total de itens entregues (entregas finalizadas).
   * Entregas por lote guardam quantidades em delivery_items (quantity fica nula);
   * somamos os itens quando existem, senão o campo direto — sem dupla contagem.
   */
  const entregasTotalQty = useMemo(() =>
    (deliveries as any[])
      .filter((d: any) => d.status === 'completed')
      .reduce((sum: number, d: any) => {
        const items = (d.delivery_items ?? []) as any[];
        if (items.length > 0) {
          return sum + items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        }
        return sum + (Number(d.quantity) || 0);
      }, 0),
    [deliveries]
  );

  const calcarioIds = useMemo(() => getDemandIdsByCategory(demandTypes as any[], ['calcario']), [demandTypes]);

  const calcarioCount = useMemo(() =>
    (services as any[]).filter(s => s.status === 'completed' && calcarioIds.has(s.demand_type_id)).length,
    [services, calcarioIds]
  );

  const calcarioTotalTons = useMemo(() =>
    (services as any[])
      .filter(s => s.status === 'completed' && calcarioIds.has(s.demand_type_id))
      .reduce((sum: number, s: any) => sum + (Number(s.limestone_quantity) || 0), 0),
    [services, calcarioIds]
  );

  const insumosIds = useMemo(() => getDemandIdsByCategory(demandTypes as any[], ['logistica_insumos']), [demandTypes]);

  const insumosCount = useMemo(() =>
    (services as any[]).filter(s => s.status === 'completed' && insumosIds.has(s.demand_type_id)).length,
    [services, insumosIds]
  );

  const insumosTotalTons = useMemo(() =>
    (services as any[])
      .filter(s => s.status === 'completed' && insumosIds.has(s.demand_type_id))
      .reduce((sum: number, s: any) => sum + (Number(s.input_quantity) || 0), 0),
    [services, insumosIds]
  );

  const assistenciaTecnicaCount = useMemo(() => {
    const ids = getDemandIdsByCategory(demandTypes as any[], ['assistencia_tecnica']);
    return (services as any[]).filter(s => s.status === 'completed' && ids.has(s.demand_type_id)).length;
  }, [services, demandTypes]);

  // ── Operation-type ids (estável; fallback por nome p/ tipos antigos sem o campo) ──
  const getOperationIds = useMemo(() => {
    return (op: 'grade' | 'pc' | 'pa_carregadeira', fallback: () => Set<string>): Set<string> => {
      const ids = new Set(
        (demandTypes as any[]).filter(d => d.operation_type === op).map((d: any) => d.id as string),
      );
      return ids.size > 0 ? ids : fallback();
    };
  }, [demandTypes]);

  // ── Monthly charts ──────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: monthsCount }, (_, i) => {
      const monthDate = subMonths(now, monthsCount - 1 - i);
      const monthKey = format(startOfMonth(monthDate), 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });
      const registered = (services as any[]).filter(s => {
        const d = parseISO((s.created_at || s.scheduled_date).replace(' ', 'T'));
        return format(startOfMonth(d), 'yyyy-MM') === monthKey;
      }).length;
      const completed = (services as any[]).filter(s => {
        if (s.status !== 'completed' || !s.completed_at) return false;
        const d = parseISO(s.completed_at.replace(' ', 'T'));
        return format(startOfMonth(d), 'yyyy-MM') === monthKey;
      }).length;
      return {
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        cadastrados: registered,
        finalizados: completed,
      };
    });
  }, [services, monthsCount]);

  const monthlyGradeVsPcData = useMemo(() => {
    const gradeIds = getOperationIds('grade', () => getDemandIdsByNameSubstring(demandTypes as any[], 'grade'));
    const pcIds = getOperationIds('pc', () => new Set((demandTypes as any[]).filter(d => d.name?.toLowerCase().includes(' pc') || d.name?.toLowerCase() === 'pc').map((d: any) => d.id)));
    const paCarregadeiraIds = getOperationIds('pa_carregadeira', () => getDemandIdsByNameSubstring(demandTypes as any[], 'carregadeira'));
    const now = new Date();

    const countCompletedInMonth = (ids: Set<string>, monthKey: string) =>
      (services as any[]).filter(s => {
        if (s.status !== 'completed' || !s.completed_at) return false;
        const d = parseISO(s.completed_at.replace(' ', 'T'));
        return format(startOfMonth(d), 'yyyy-MM') === monthKey && ids.has(s.demand_type_id);
      }).length;

    return Array.from({ length: monthsCount }, (_, i) => {
      const monthDate = subMonths(now, monthsCount - 1 - i);
      const monthKey = format(startOfMonth(monthDate), 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });
      return {
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        grade: countCompletedInMonth(gradeIds, monthKey),
        pc: countCompletedInMonth(pcIds, monthKey),
        paCarregadeira: countCompletedInMonth(paCarregadeiraIds, monthKey),
      };
    });
  }, [services, demandTypes, monthsCount, getOperationIds]);

  // ── Tempo médio de atendimento (cadastro → finalização) ────────────────────
  const avgCompletionData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: monthsCount }, (_, i) => {
      const monthDate = subMonths(now, monthsCount - 1 - i);
      const monthKey = format(startOfMonth(monthDate), 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM/yy', { locale: ptBR });
      const durations = (services as any[])
        .filter(s => {
          if (s.status !== 'completed' || !s.completed_at || !s.created_at) return false;
          const d = parseISO(s.completed_at.replace(' ', 'T'));
          return format(startOfMonth(d), 'yyyy-MM') === monthKey;
        })
        .map(s => {
          const created = parseISO(s.created_at.replace(' ', 'T'));
          const completed = parseISO(s.completed_at.replace(' ', 'T'));
          return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        })
        .filter(days => days >= 0);
      const avg = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : null;
      return {
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        dias: avg != null ? Math.round(avg * 10) / 10 : null,
      };
    });
  }, [services, monthsCount]);

  const avgCompletionOverall = useMemo(() => {
    const valid = avgCompletionData.filter(m => m.dias != null) as { dias: number }[];
    if (valid.length === 0) return null;
    return valid.reduce((a, m) => a + m.dias, 0) / valid.length;
  }, [avgCompletionData]);

  /** Tendência: último mês com dado vs mês anterior com dado (negativo = mais rápido) */
  const avgCompletionTrend = useMemo(() => {
    const valid = avgCompletionData.filter(m => m.dias != null);
    if (valid.length < 2) return null;
    const last = valid[valid.length - 1].dias as number;
    const prev = valid[valid.length - 2].dias as number;
    if (prev === 0) return null;
    return ((last - prev) / prev) * 100;
  }, [avgCompletionData]);

  // ── Comparativo ano a ano (mês atual vs mesmo mês do ano passado) ───────────
  const yoy = useMemo(() => {
    const now = new Date();
    const thisMonthKey = format(now, 'yyyy-MM');
    const lastYearKey = format(subMonths(now, 12), 'yyyy-MM');
    const countIn = (key: string) =>
      (services as any[]).filter(s => {
        if (s.status !== 'completed' || !s.completed_at) return false;
        const d = parseISO(s.completed_at.replace(' ', 'T'));
        return format(d, 'yyyy-MM') === key;
      }).length;
    const current = countIn(thisMonthKey);
    const previous = countIn(lastYearKey);
    const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
    return { current, previous, deltaPct, monthLabel: format(now, 'MMMM', { locale: ptBR }) };
  }, [services]);

  // ── Rankings — COMPLETED ONLY ─────────────────────────────────────────────
  /** Ranking completo de assentamentos (ordenado); top 5 exibido, lista cheia no modal */
  const rankedSettlements = useMemo(() => {
    const patrulhaIds = getPatrulhaIds(demandTypes as any[]);
    // Only completed services count toward the ranking
    const completedServices = (services as any[]).filter(s => s.status === 'completed');
    const stats: Record<string, { name: string; count: number; patrulha: number }> = {};

    completedServices.forEach(s => {
      if (!s.settlement_id) return;
      const name =
        (settlements as any[]).find(st => st.id === s.settlement_id)?.name ||
        s.settlements?.name ||
        'Desconhecido';
      if (!stats[s.settlement_id]) stats[s.settlement_id] = { name, count: 0, patrulha: 0 };
      stats[s.settlement_id].count++;
      if (patrulhaIds.has(s.demand_type_id)) stats[s.settlement_id].patrulha++;
    });

    return Object.entries(stats)
      .map(([id, data]) => ({
        ...data,
        // All producers registered to this settlement (not just ones with services)
        producersCount: (producers as any[]).filter((p: any) => p.settlement_id === id).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [services, settlements, demandTypes, producers]);

  const topSettlements = useMemo(() => rankedSettlements.slice(0, 5), [rankedSettlements]);
  const [allSettlementsOpen, setAllSettlementsOpen] = useState(false);

  const topDemandTypes = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    // Only completed services
    (services as any[]).filter(s => s.status === 'completed').forEach(s => {
      if (!s.demand_type_id) return;
      const name =
        (demandTypes as any[]).find(d => d.id === s.demand_type_id)?.name ||
        s.demand_types?.name ||
        'Desconhecido';
      if (!counts[s.demand_type_id]) counts[s.demand_type_id] = { name, count: 0 };
      counts[s.demand_type_id].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [services, demandTypes]);

  // ── Operator productivity ───────────────────────────────────────────────────
  const operatorStats = useMemo(() => {
    const stats: Record<string, { name: string; completed: number; totalArea: number; totalFuel: number; totalHours: number }> = {};
    (operators as any[]).forEach(op => { stats[op.id] = { name: op.name, completed: 0, totalArea: 0, totalFuel: 0, totalHours: 0 }; });
    (services as any[]).forEach(s => {
      if (s.status === 'completed' && s.operator_id && stats[s.operator_id]) {
        stats[s.operator_id].completed++;
        stats[s.operator_id].totalArea  += Number(s.worked_area  || 0);
        stats[s.operator_id].totalFuel  += Number(s.fuel_liters  || 0);
        stats[s.operator_id].totalHours += Number(s.worked_hours || 0);
      }
    });
    return Object.values(stats).filter(op => op.completed > 0).sort((a, b) => b.completed - a.completed).slice(0, 5);
  }, [services, operators]);

  // M-11+M-03: operation_type estável com fallback por nome
  const totalWorkedArea = useMemo(() => {
    const gradeIds = getOperationIds('grade', () => getDemandIdsByNameSubstring(demandTypes as any[], 'grade'));
    if (gradeIds.size === 0) return 0;
    return (services as any[])
      .filter(s => s.status === 'completed' && gradeIds.has(s.demand_type_id) && s.worked_area)
      .reduce((acc, s) => acc + (Number(s.worked_area) || 0), 0);
  }, [services, demandTypes, getOperationIds]);

  const patrulhaInsumosIds = useMemo(
    () => getDemandIdsByCategory(demandTypes as any[], ['patrulha_mecanizada', 'logistica_insumos']),
    [demandTypes],
  );

  /** Total fuel consumed (L) — all completed patrulha_mecanizada + logistica_insumos */
  const totalFuelLiters = useMemo(() =>
    (services as any[])
      .filter(s => s.status === 'completed' && patrulhaInsumosIds.has(s.demand_type_id) && s.fuel_liters)
      .reduce((acc, s) => acc + (Number(s.fuel_liters) || 0), 0),
    [services, patrulhaInsumosIds],
  );

  /** Total worked hours (h) — all completed patrulha_mecanizada + logistica_insumos */
  const totalWorkedHours = useMemo(() =>
    (services as any[])
      .filter(s => s.status === 'completed' && patrulhaInsumosIds.has(s.demand_type_id) && s.worked_hours)
      .reduce((acc, s) => acc + (Number(s.worked_hours) || 0), 0),
    [services, patrulhaInsumosIds],
  );

  // ── PDF export grouped by assentamento ─────────────────────────────────────
  const handleExportBySettlement = () => {
    const img = new Image();
    img.onload = () => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header with logo
      const logoW = 52;
      const logoH = logoW * (img.naturalHeight / img.naturalWidth);
      doc.addImage(img, 'PNG', 14, 6, logoW, logoH);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(45, 90, 39);
      doc.text('Relatório de Atendimentos Finalizados', pageWidth / 2, 16, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(
        `Por assentamento · Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2, 23, { align: 'center' }
      );
      const headerH = Math.max(logoH + 10, 32);
      doc.setDrawColor(200);
      doc.line(14, headerH, pageWidth - 14, headerH);
      doc.setTextColor(0);

      // Group ONLY completed services by settlement
      const completedOnly = (services as any[]).filter(s => s.status === 'completed');
      const grouped: Record<string, { settlementId: string; settlementName: string; rows: any[] }> = {};
      completedOnly.forEach(s => {
        const key = s.settlement_id || '__none__';
        const settlementName =
          (settlements as any[]).find(st => st.id === s.settlement_id)?.name ||
          s.settlements?.name ||
          'Sem assentamento';
        if (!grouped[key]) grouped[key] = { settlementId: key, settlementName, rows: [] };
        grouped[key].rows.push(s);
      });

      const sortedGroups = Object.values(grouped).sort((a, b) =>
        a.settlementName.localeCompare(b.settlementName, 'pt-BR')
      );

      let cursorY = headerH + 6;

      sortedGroups.forEach(({ settlementId, settlementName, rows }) => {
        if (cursorY > 255) {
          doc.addPage();
          cursorY = 14;
        }

        // Count producers registered to this settlement
        const producerCount = settlementId !== '__none__'
          ? (producers as any[]).filter((p: any) => p.settlement_id === settlementId).length
          : 0;

        // Settlement colour band
        doc.setFillColor(45, 90, 39);
        doc.setTextColor(255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.rect(14, cursorY, pageWidth - 28, 7, 'F');
        doc.text(` ${settlementName}`, 14, cursorY + 5);
        doc.text(
          `${rows.length} finalizado(s) · ${producerCount} produtor(es)`,
          pageWidth - 14, cursorY + 5, { align: 'right' }
        );
        doc.setTextColor(0);

        const tableRows = rows.map(s => {
          const producerName =
            s.producers?.name ||
            (producers as any[]).find((p: any) => p.id === s.producer_id)?.name ||
            'N/A';
          const dtName =
            s.demand_types?.name ||
            (demandTypes as any[]).find((d: any) => d.id === s.demand_type_id)?.name ||
            'N/A';
          const completedAt = s.completed_at
            ? format(new Date(s.completed_at.replace(' ', 'T')), 'dd/MM/yyyy')
            : '-';
          const area = s.worked_area
            ? `${Number(s.worked_area).toFixed(2).replace('.', ',')} ha`
            : '-';
          return [producerName, dtName, completedAt, area];
        });

        autoTable(doc, {
          startY: cursorY + 8,
          head: [['Produtor', 'Tipo de Demanda', 'Finalizado em', 'Área']],
          body: tableRows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [237, 247, 237], textColor: [45, 90, 39], fontStyle: 'bold', fontSize: 7.5 },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: 14, right: 14 },
          tableWidth: 'auto',
        });

        cursorY = (doc as any).lastAutoTable.finalY + 6;
      });

      doc.save(`relatorio-finalizados-assentamentos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };
    img.src = logoTransparent;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <PageHeader title="Análise Gráfica" description="Estatísticas e métricas do sistema" />

      {/* Category quick-access cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
        {/* Patrulha Mecanizada */}
        <button
          onClick={() => navigate('/services?category=patrulha_mecanizada')}
          className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
        >
          <div className="p-3 rounded-xl bg-amber-500/10 shrink-0">
            <Tractor className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Patrulha Mecanizada</p>
            <p className="text-3xl font-black text-foreground">{patrulhaCount}</p>
            <p className="text-xs text-muted-foreground">atendimentos finalizados</p>
          </div>
        </button>

        {/* Assistência Técnica */}
        <button
          onClick={() => navigate('/services?category=assistencia_tecnica')}
          className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 shrink-0">
            <Stethoscope className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Assistência Técnica</p>
            <p className="text-3xl font-black text-foreground">{assistenciaTecnicaCount}</p>
            <p className="text-xs text-muted-foreground">atendimentos finalizados</p>
          </div>
        </button>

        {/* Entregas */}
        <button
          onClick={() => navigate('/deliveries')}
          className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 shrink-0">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Entregas</p>
            <p className="text-3xl font-black text-foreground">{entregasCount}</p>
            <p className="text-xs text-muted-foreground">realizadas</p>
            {entregasTotalQty > 0 && (
              <p className="text-xs font-semibold text-blue-600 mt-0.5">
                {entregasTotalQty.toLocaleString('pt-BR')} itens entregues
              </p>
            )}
          </div>
        </button>

        {/* Calcário */}
        <button
          onClick={() => navigate('/services?category=calcario')}
          className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
        >
          <div className="p-3 rounded-xl bg-stone-500/10 shrink-0">
            <Layers className="h-6 w-6 text-stone-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Calcário</p>
            <p className="text-3xl font-black text-foreground">{calcarioCount}</p>
            <p className="text-xs text-muted-foreground">atendimentos finalizados</p>
            {calcarioTotalTons > 0 && (
              <p className="text-xs font-semibold text-stone-600 mt-0.5">
                {calcarioTotalTons.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ton entregues
              </p>
            )}
          </div>
        </button>

        {/* Logística de Insumos */}
        <button
          onClick={() => navigate('/services?category=logistica_insumos')}
          className="rounded-xl border bg-card p-4 flex items-center gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 text-left"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 shrink-0">
            <Truck className="h-6 w-6 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Logística de Insumos</p>
            <p className="text-3xl font-black text-foreground">{insumosCount}</p>
            <p className="text-xs text-muted-foreground">atendimentos finalizados</p>
            {insumosTotalTons > 0 && (
              <p className="text-xs font-semibold text-purple-600 mt-0.5">
                {insumosTotalTons.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ton entregues
              </p>
            )}
          </div>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stat cards row */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Total Worked Area */}
            <Card className="overflow-hidden bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 shrink-0">
                    <Tractor className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Área Trabalhada com Grade
                    </p>
                    <p className="text-2xl sm:text-4xl font-black text-foreground">
                      {totalWorkedArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-base sm:text-xl font-medium text-muted-foreground">ha</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Fuel */}
            <Card className="overflow-hidden bg-gradient-to-br from-red-500/10 via-rose-500/5 to-background">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/30 shrink-0">
                    <Fuel className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Combustível Consumido
                    </p>
                    <p className="text-2xl sm:text-4xl font-black text-foreground">
                      {totalFuelLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-base sm:text-xl font-medium text-muted-foreground">L</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Patrulha + Logística finalizadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Worked Hours */}
            <Card className="overflow-hidden bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-background">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 shrink-0">
                    <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Horas Trabalhadas
                    </p>
                    <p className="text-2xl sm:text-4xl font-black text-foreground">
                      {totalWorkedHours.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      <span className="text-base sm:text-xl font-medium text-muted-foreground">h</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Patrulha + Logística finalizadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Seletor de período global ───────────────────────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              Período dos gráficos
            </div>
            <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                    period === opt.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tempo médio + Comparativo anual ─────────────────────────── */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Tempo médio de atendimento */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-teal-500/10 to-cyan-500/5 pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/20"><Timer className="h-5 w-5 text-teal-600" /></div>
                  <div className="flex-1">
                    <span className="text-lg">Tempo Médio de Atendimento</span>
                    <p className="text-sm font-normal text-muted-foreground">Do cadastro à finalização · {periodLabel}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                  <p className="text-3xl font-black text-foreground">
                    {avgCompletionOverall != null
                      ? avgCompletionOverall.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                      : '—'}{' '}
                    <span className="text-base font-medium text-muted-foreground">dias</span>
                  </p>
                  {avgCompletionTrend != null && (
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1',
                      avgCompletionTrend < -1 ? 'bg-success/10 text-success'
                        : avgCompletionTrend > 1 ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {avgCompletionTrend < -1 ? <TrendingDown className="h-3.5 w-3.5" />
                        : avgCompletionTrend > 1 ? <TrendingUp className="h-3.5 w-3.5" />
                        : <Minus className="h-3.5 w-3.5" />}
                      {Math.abs(avgCompletionTrend).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                      {avgCompletionTrend < -1 ? ' mais rápidos' : avgCompletionTrend > 1 ? ' mais lentos' : ' estável'}
                    </span>
                  )}
                </div>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={avgCompletionData}>
                      <defs>
                        <linearGradient id="gradientTempoMedio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(173 80% 36%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(173 80% 36%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} width={32} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="dias" name="Dias (média)" stroke="hsl(173 80% 36%)" strokeWidth={2.5} fill="url(#gradientTempoMedio)" connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Comparativo ano a ano */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-indigo-500/10 to-violet-500/5 pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/20"><TrendingUp className="h-5 w-5 text-indigo-600" /></div>
                  <div>
                    <span className="text-lg">Comparativo Anual</span>
                    <p className="text-sm font-normal text-muted-foreground">
                      Finalizados em {yoy.monthLabel} — este ano vs ano passado
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="text-center p-4 rounded-xl bg-muted/40 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                      {yoy.monthLabel} {new Date().getFullYear() - 1}
                    </p>
                    <p className="text-4xl font-black text-muted-foreground">{yoy.previous}</p>
                    <p className="text-xs text-muted-foreground mt-1">finalizados</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-xs text-primary uppercase tracking-wide font-medium mb-1">
                      {yoy.monthLabel} {new Date().getFullYear()}
                    </p>
                    <p className="text-4xl font-black text-primary">{yoy.current}</p>
                    <p className="text-xs text-muted-foreground mt-1">finalizados</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-center">
                  {yoy.deltaPct != null ? (
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-sm font-bold rounded-full px-4 py-1.5',
                      yoy.deltaPct > 0 ? 'bg-success/10 text-success'
                        : yoy.deltaPct < 0 ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {yoy.deltaPct > 0 ? <TrendingUp className="h-4 w-4" />
                        : yoy.deltaPct < 0 ? <TrendingDown className="h-4 w-4" />
                        : <Minus className="h-4 w-4" />}
                      {yoy.deltaPct > 0 ? '+' : ''}{yoy.deltaPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% vs ano passado
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sem dados de {yoy.monthLabel} do ano passado para comparar
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-success/10 to-success/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/20"><TrendingUp className="h-5 w-5 text-success" /></div>
                  <div>
                    <span className="text-lg">Atendimentos Finalizados</span>
                    <p className="text-sm font-normal text-muted-foreground">{periodLabel}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
                <div className="h-[220px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="gradientFinalizados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="finalizados" name="Finalizados" stroke="hsl(142 71% 45%)" strokeWidth={3} fill="url(#gradientFinalizados)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-primary/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20"><ClipboardList className="h-5 w-5 text-primary" /></div>
                  <div>
                    <span className="text-lg">Atendimentos Cadastrados</span>
                    <p className="text-sm font-normal text-muted-foreground">{periodLabel}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
                <div className="h-[220px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="cadastrados" name="Cadastrados" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grade vs PC */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-secondary/10 via-primary/5 to-secondary/10">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/20"><Layers className="h-5 w-5 text-secondary" /></div>
                <div>
                  <span className="text-lg">Comparativo: Grade vs PC vs Pá Carregadeira</span>
                  <p className="text-sm font-normal text-muted-foreground">Atendimentos finalizados por tipo de operação — {periodLabel.toLowerCase()}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
              <div className="h-[220px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyGradeVsPcData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} formatter={(v) => <span className="text-foreground">{v}</span>} />
                    <Bar dataKey="grade" name="Grade" fill="hsl(113 38% 26%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pc" name="PC" fill="hsl(280 70% 55%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paCarregadeira" name="Pá Carregadeira" fill="hsl(32 95% 44%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Operator Productivity */}
          {operatorStats.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-primary/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20"><Users2 className="h-5 w-5 text-primary" /></div>
                  <div>
                    <span className="text-lg">Produtividade dos Operadores</span>
                    <p className="text-sm font-normal text-muted-foreground">Atendimentos finalizados por operador</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-5">
                  {operatorStats.map((op, index) => {
                    const pct = Math.round((op.completed / operatorStats[0].completed) * 100);
                    return (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[55%]">{op.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {op.totalArea > 0 && (
                              <span className="text-muted-foreground text-xs">{op.totalArea.toFixed(1)} ha</span>
                            )}
                            {op.totalFuel > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-red-700 bg-red-500/10 rounded-full px-2 py-0.5 font-medium">
                                <Fuel className="h-3 w-3" />
                                {op.totalFuel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                              </span>
                            )}
                            {op.totalHours > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-blue-700 bg-blue-500/10 rounded-full px-2 py-0.5 font-medium">
                                <Clock className="h-3 w-3" />
                                {op.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                              </span>
                            )}
                            <span className="font-bold text-primary text-lg tabular-nums">{op.completed}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {op.completed} {op.completed === 1 ? 'atendimento finalizado' : 'atendimentos finalizados'}
                          {op.totalArea > 0 && ` · ${op.totalArea.toFixed(1)} ha`}
                          {op.totalFuel > 0 && ` · ${op.totalFuel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L combustível`}
                          {op.totalHours > 0 && ` · ${op.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h trabalhadas`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rankings */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Top 5 Assentamentos + PDF export */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/5">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20"><MapPin className="h-5 w-5 text-amber-500" /></div>
                    <div>
                      <span className="text-lg">Top 5 Assentamentos</span>
                      <p className="text-sm font-normal text-muted-foreground">Por atendimentos finalizados</p>
                    </div>
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportBySettlement}
                    className="gap-1.5 shrink-0 text-xs"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Relatório PDF</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {topSettlements.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum assentamento com atendimentos finalizados</p>
                  ) : (
                    topSettlements.map((s, i) => (
                      <RankingItem
                        key={i}
                        position={i + 1}
                        name={s.name}
                        count={s.count}
                        maxCount={topSettlements[0].count}
                        patrulha={s.patrulha}
                        producersCount={s.producersCount}
                      />
                    ))
                  )}
                  {rankedSettlements.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-primary"
                      onClick={() => setAllSettlementsOpen(true)}
                    >
                      Ver todos ({rankedSettlements.length})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top 3 Demandas */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20"><ClipboardList className="h-5 w-5 text-amber-500" /></div>
                  <div>
                    <span className="text-lg">Top 3 Demandas</span>
                    <p className="text-sm font-normal text-muted-foreground">Por atendimentos finalizados</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {topDemandTypes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma demanda com atendimentos finalizados</p>
                  ) : (
                    topDemandTypes.map((d, i) => (
                      <RankingItem key={i} position={i + 1} name={d.name} count={d.count} maxCount={topDemandTypes[0].count} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Central de Relatórios ───────────────────────────────────── */}
          <ReportsCenter
            services={services as any[]}
            producers={producers as any[]}
            demandTypes={demandTypes as any[]}
            settlements={settlements as any[]}
          />
        </div>
      )}

      {/* ── Dialog: ranking completo de assentamentos ─────────────────── */}
      <Dialog open={allSettlementsOpen} onOpenChange={setAllSettlementsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-amber-500" />
              Ranking de Assentamentos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 pt-1">
            {rankedSettlements.map((s, i) => {
              const pct = rankedSettlements[0].count > 0
                ? Math.round((s.count / rankedSettlements[0].count) * 100)
                : 0;
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                  <span className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-xs font-black shrink-0',
                    i === 0 ? 'bg-warning text-warning-foreground'
                      : i === 1 ? 'bg-primary text-primary-foreground'
                      : i === 2 ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}°
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <span className="font-bold text-sm tabular-nums shrink-0">{s.count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{s.producersCount} prod.</span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
