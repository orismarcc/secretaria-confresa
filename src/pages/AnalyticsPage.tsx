import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useServices, useSettlements, useDemandTypes } from '@/hooks/useSupabaseData';
import { useOperators } from '@/hooks/useOperatorData';
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
  Legend
} from 'recharts';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, MapPin, ClipboardList, Tractor, Users2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Custom tooltip component
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

// Ranking item component
interface RankingItemProps {
  position: number;
  name: string;
  count: number;
  maxCount: number;
}

const rankConfig = [
  {
    label: '1°',
    cardClass: 'bg-warning/5 border-warning/30',
    badgeClass: 'bg-warning text-warning-foreground',
    barClass: 'bg-warning',
    textClass: 'text-warning',
  },
  {
    label: '2°',
    cardClass: 'bg-primary/5 border-primary/20',
    badgeClass: 'bg-primary text-primary-foreground',
    barClass: 'bg-primary',
    textClass: 'text-primary',
  },
  {
    label: '3°',
    cardClass: 'bg-secondary/5 border-secondary/20',
    badgeClass: 'bg-secondary text-secondary-foreground',
    barClass: 'bg-secondary',
    textClass: 'text-secondary',
  },
];

function RankingItem({ position, name, count, maxCount }: RankingItemProps) {
  const config = rankConfig[position - 1];
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm',
      config.cardClass
    )}>
      <div className={cn(
        'flex items-center justify-center w-11 h-11 rounded-full text-sm font-black shrink-0 shadow-sm',
        config.badgeClass
      )}>
        {config.label}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-foreground truncate">{name}</p>
          <span className={cn('text-2xl font-black tabular-nums shrink-0', config.textClass)}>
            {count}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', config.barClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {count} {count === 1 ? 'atendimento' : 'atendimentos'}
          {position > 1 && ` · ${pct}% em relação ao 1°`}
        </p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements();
  const { data: demandTypes = [], isLoading: demandTypesLoading } = useDemandTypes();
  const { data: operators = [] } = useOperators();

  const isLoading = servicesLoading || settlementsLoading || demandTypesLoading;

  // Calculate monthly data for charts (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthKey = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM/yy', { locale: ptBR });
      
      const registered = services.filter(s => {
        const serviceDate = parseISO(s.created_at || s.scheduled_date);
        return format(startOfMonth(serviceDate), 'yyyy-MM') === monthKey;
      }).length;
      
      const completed = services.filter(s => {
        if (s.status !== 'completed' || !s.completed_at) return false;
        const completedDate = parseISO(s.completed_at);
        return format(startOfMonth(completedDate), 'yyyy-MM') === monthKey;
      }).length;
      
      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        cadastrados: registered,
        finalizados: completed,
      });
    }
    
    return months;
  }, [services]);

  // Top 3 settlements
  const topSettlements = useMemo(() => {
    const settlementCounts: Record<string, { name: string; count: number }> = {};
    
    services.forEach(service => {
      const settlementId = service.settlement_id;
      if (settlementId) {
        const settlement = settlements.find(s => s.id === settlementId);
        const name = settlement?.name || service.settlements?.name || 'Desconhecido';
        if (!settlementCounts[settlementId]) {
          settlementCounts[settlementId] = { name, count: 0 };
        }
        settlementCounts[settlementId].count++;
      }
    });
    
    return Object.values(settlementCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [services, settlements]);

  // Top 3 demand types
  const topDemandTypes = useMemo(() => {
    const demandCounts: Record<string, { name: string; count: number }> = {};
    
    services.forEach(service => {
      const demandId = service.demand_type_id;
      if (demandId) {
        const demand = demandTypes.find(d => d.id === demandId);
        const name = demand?.name || service.demand_types?.name || 'Desconhecido';
        if (!demandCounts[demandId]) {
          demandCounts[demandId] = { name, count: 0 };
        }
        demandCounts[demandId].count++;
      }
    });
    
    return Object.values(demandCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [services, demandTypes]);

  // Operator productivity stats
  const operatorStats = useMemo(() => {
    const stats: Record<string, { name: string; completed: number; totalArea: number }> = {};
    operators.forEach(op => {
      stats[op.id] = { name: op.name, completed: 0, totalArea: 0 };
    });
    (services as any[]).forEach(s => {
      if (s.status === 'completed' && s.operator_id && stats[s.operator_id]) {
        stats[s.operator_id].completed++;
        stats[s.operator_id].totalArea += Number(s.worked_area || 0);
      }
    });
    return Object.values(stats)
      .filter(op => op.completed > 0)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  }, [services, operators]);

  // Total worked area (only from completed services with "Grade" demand type)
  const totalWorkedArea = useMemo(() => {
    const gradeDemandType = demandTypes.find(d => d.name?.toLowerCase().includes('grade'));
    if (!gradeDemandType) return 0;
    return services
      .filter(s => s.status === 'completed' && s.demand_type_id === gradeDemandType.id && s.worked_area)
      .reduce((acc, s) => acc + (Number(s.worked_area) || 0), 0);
  }, [services, demandTypes]);


  return (
    <AppLayout>
      <PageHeader 
        title="Análise Gráfica" 
        description="Estatísticas e métricas do sistema"
      />

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
          {/* Total Worked Area Metric Card */}
          <Card className="overflow-hidden bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 shrink-0">
                  <Tractor className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Total de Área Trabalhada com Grade
                  </p>
                  <p className="text-2xl sm:text-4xl font-black text-foreground">
                    {totalWorkedArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base sm:text-xl font-medium text-muted-foreground">ha</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Section */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Completed Services Chart */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-success/10 to-success/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/20">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <span className="text-lg">Atendimentos Finalizados</span>
                    <p className="text-sm font-normal text-muted-foreground">Últimos 6 meses</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
                <div className="h-[220px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="gradientFinalizados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="finalizados"
                        name="Finalizados"
                        stroke="hsl(142 71% 45%)"
                        strokeWidth={3}
                        fill="url(#gradientFinalizados)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Registered Services Chart */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-primary/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-lg">Atendimentos Cadastrados</span>
                    <p className="text-sm font-normal text-muted-foreground">Últimos 6 meses</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
                <div className="h-[220px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <defs>
                        <linearGradient id="gradientCadastrados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(210 70% 45%)" stopOpacity={1}/>
                          <stop offset="95%" stopColor="hsl(210 70% 45%)" stopOpacity={0.6}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="cadastrados"
                        name="Cadastrados"
                        fill="url(#gradientCadastrados)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined Chart - Full Width */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-secondary/10 via-primary/5 to-secondary/10">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/20">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <span className="text-lg">Comparativo: Cadastrados vs Finalizados</span>
                  <p className="text-sm font-normal text-muted-foreground">Visão consolidada dos últimos 6 meses</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
              <div className="h-[220px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-foreground">{value}</span>}
                    />
                    <Bar
                      dataKey="cadastrados"
                      name="Cadastrados"
                      fill="hsl(210 70% 45%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="finalizados"
                      name="Finalizados"
                      fill="hsl(142 71% 45%)"
                      radius={[4, 4, 0, 0]}
                    />
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
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Users2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-lg">Produtividade dos Operadores</span>
                    <p className="text-sm font-normal text-muted-foreground">Atendimentos finalizados por operador</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-5">
                  {operatorStats.map((op, index) => {
                    const maxCompleted = operatorStats[0].completed;
                    const pct = Math.round((op.completed / maxCompleted) * 100);
                    return (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[60%]">{op.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            {op.totalArea > 0 && (
                              <span className="text-muted-foreground text-xs">{op.totalArea.toFixed(1)} ha</span>
                            )}
                            <span className="font-bold text-primary text-lg tabular-nums">{op.completed}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {op.completed} {op.completed === 1 ? 'atendimento finalizado' : 'atendimentos finalizados'}
                          {op.totalArea > 0 && ` · ${op.totalArea.toFixed(1)} ha trabalhado`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rankings Section */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Top Settlements */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <MapPin className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-lg">Top 3 Assentamentos</span>
                    <p className="text-sm font-normal text-muted-foreground">Por quantidade de atendimentos</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {topSettlements.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum assentamento com atendimentos cadastrados
                    </p>
                  ) : (
                    topSettlements.map((settlement, index) => (
                      <RankingItem
                        key={index}
                        position={index + 1}
                        name={settlement.name}
                        count={settlement.count}
                        maxCount={topSettlements[0].count}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Demand Types */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <ClipboardList className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <span className="text-lg">Top 3 Demandas</span>
                    <p className="text-sm font-normal text-muted-foreground">Por quantidade de atendimentos</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {topDemandTypes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma demanda com atendimentos cadastrados
                    </p>
                  ) : (
                    topDemandTypes.map((demand, index) => (
                      <RankingItem
                        key={index}
                        position={index + 1}
                        name={demand.name}
                        count={demand.count}
                        maxCount={topDemandTypes[0].count}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
