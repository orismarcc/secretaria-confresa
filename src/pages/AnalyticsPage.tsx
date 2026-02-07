import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useServices, useSettlements, useDemandTypes } from '@/hooks/useSupabaseData';
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
import { TrendingUp, MapPin, ClipboardList, Trophy, Medal, Award, Tractor } from 'lucide-react';
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

// Ranking card component
interface RankingItemProps {
  position: number;
  name: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
}

function RankingItem({ position, name, count, icon: Icon, colorClass }: RankingItemProps) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:scale-[1.02]",
      position === 1 && "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30",
      position === 2 && "bg-gradient-to-r from-slate-400/20 to-slate-300/10 border border-slate-400/30",
      position === 3 && "bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-600/30"
    )}>
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-full",
        colorClass
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{name}</p>
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'cadastro' : 'cadastros'}
        </p>
      </div>
      <div className={cn(
        "text-3xl font-black",
        position === 1 && "text-amber-500",
        position === 2 && "text-slate-400",
        position === 3 && "text-orange-600"
      )}>
        #{position}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: settlements = [], isLoading: settlementsLoading } = useSettlements();
  const { data: demandTypes = [], isLoading: demandTypesLoading } = useDemandTypes();

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

  // Total worked area (only from completed services with worked_area)
  const totalWorkedArea = useMemo(() => {
    return services
      .filter(s => s.status === 'completed' && (s as any).worked_area)
      .reduce((acc, s) => acc + (Number((s as any).worked_area) || 0), 0);
  }, [services]);

  const positionIcons = [Trophy, Medal, Award];
  const positionColors = [
    "bg-amber-500/20 text-amber-500",
    "bg-slate-400/20 text-slate-400", 
    "bg-orange-600/20 text-orange-600"
  ];

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
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                  <Tractor className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Total de Área Trabalhada com Grade
                  </p>
                  <p className="text-4xl font-black text-foreground">
                    {totalWorkedArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xl font-medium text-muted-foreground">ha</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Section */}
          <div className="grid gap-6 lg:grid-cols-2">
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
              <CardContent className="pt-6">
                <div className="h-[300px]">
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
              <CardContent className="pt-6">
                <div className="h-[300px]">
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
            <CardContent className="pt-6">
              <div className="h-[300px]">
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

          {/* Rankings Section */}
          <div className="grid gap-6 lg:grid-cols-2">
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
                        icon={positionIcons[index]}
                        colorClass={positionColors[index]}
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
                        icon={positionIcons[index]}
                        colorClass={positionColors[index]}
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
