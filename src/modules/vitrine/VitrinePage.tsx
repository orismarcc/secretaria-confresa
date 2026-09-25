// CONECTA CONFRESA — Vitrine da Agricultura Familiar. Página da equipe
// (módulo independente, carregado sob demanda). Fornecedor ≠ Oferta.
import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/SearchInput';
import { DataTable } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Users, Search, BookOpen, Sprout, CalendarRange, Map as MapIcon, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { textIncludes } from '@/lib/text';
import { useFornecedores, useOfertas, useDocumentos, useDeleteFornecedor, type Fornecedor } from './hooks';
import { STATUS, statusInfo, programaLabel } from './constants';
import { FornecedorForm } from './FornecedorForm';
import { FornecedorSheet } from './FornecedorSheet';
import { BuscaTab, type BuscaPreset } from './BuscaTab';
import { SelecaoTab } from './SelecaoTab';
import { CalendarioTab } from './CalendarioTab';
import { MapaTab } from './MapaTab';
import { CatalogoTab } from './CatalogoTab';
import { AlertasPanel } from './AlertasPanel';

const ALL = '__all__';

export default function VitrinePage() {
  const { data: fornecedores = [], isLoading } = useFornecedores();
  const { data: ofertas = [] } = useOfertas();
  const { data: documentos = [] } = useDocumentos();
  const delFornecedor = useDeleteFornecedor();

  const [tab, setTab] = useState('fornecedores');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState(ALL);
  const [form, setForm] = useState<{ open: boolean; f: Fornecedor | null }>({ open: false, f: null });
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Fornecedor | null>(null);
  // Calendário → Busca: abre a busca já filtrada por produto e mês.
  const [preset, setPreset] = useState<BuscaPreset | null>(null);
  const irParaBusca = (produtoId: string, mes: number) => {
    setPreset((p) => ({ produtoId, mes, n: (p?.n ?? 0) + 1 }));
    setTab('busca');
  };

  const aberto = fornecedores.find((f) => f.id === abertoId) || null;
  const linkedProducerIds = useMemo(
    () => new Set(fornecedores.map((f) => f.producer_id).filter(Boolean) as string[]),
    [fornecedores],
  );
  const ofertasAtivasPorFornecedor = useMemo(() => {
    const m: Record<string, number> = {};
    ofertas.forEach((o) => { if (o.ativo) m[o.fornecedor_id] = (m[o.fornecedor_id] || 0) + 1; });
    return m;
  }, [ofertas]);

  const filtrados = fornecedores.filter((f) =>
    (status === ALL || f.status === status) &&
    (!busca || textIncludes(f.nome, busca) || textIncludes(f.settlements?.name, busca) || textIncludes(f.localidade, busca)),
  );

  const resumo = {
    total: fornecedores.length,
    validados: fornecedores.filter((f) => f.status === 'validado').length,
    analise: fornecedores.filter((f) => ['recebido', 'em_analise', 'pendencia'].includes(f.status)).length,
    ofertas: ofertas.filter((o) => o.ativo).length,
  };

  const columns = [
    {
      key: 'nome', header: 'Fornecedor', render: (f: Fornecedor) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{f.nome}</p>
          <p className="text-[11px] text-muted-foreground truncate">{[f.settlements?.name, f.localidade].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
    },
    {
      key: 'ofertas', header: 'Ofertas', render: (f: Fornecedor) => {
        const n = ofertasAtivasPorFornecedor[f.id] || 0;
        return <span className={cn('text-sm', n === 0 && 'text-muted-foreground')}>{n}</span>;
      },
    },
    {
      key: 'programas', header: 'Interesse', className: 'hidden md:table-cell', render: (f: Fornecedor) => (
        <span className="text-xs text-muted-foreground">{f.programas.length ? f.programas.map(programaLabel).join(', ') : '—'}</span>
      ),
    },
    {
      key: 'status', header: 'Situação', render: (f: Fornecedor) => {
        const st = statusInfo(f.status);
        return <Badge variant="outline" className={st.cls}>{st.label}</Badge>;
      },
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Conecta Confresa"
        description="Vitrine da Agricultura Familiar — fornecedores e ofertas para PNAE, PAA e compras públicas"
        action={tab === 'fornecedores' ? { label: 'Novo fornecedor', onClick: () => setForm({ open: true, f: null }), icon: <Plus className="h-4 w-4 mr-2" /> } : undefined}
      />

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { l: 'Fornecedores', v: resumo.total, c: 'text-foreground' },
          { l: 'Validados', v: resumo.validados, c: 'text-emerald-600' },
          { l: 'Aguardando análise', v: resumo.analise, c: 'text-amber-600' },
          { l: 'Ofertas ativas', v: resumo.ofertas, c: 'text-primary' },
        ].map((k) => (
          <div key={k.l} className="rounded-lg border p-3">
            <p className={cn('text-2xl font-bold leading-none', k.c)}>{k.v}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Alertas: documentos, cadastros e preços desatualizados, safra chegando */}
      <div className="mb-4">
        <AlertasPanel fornecedores={fornecedores} ofertas={ofertas} documentos={documentos} onOpenFornecedor={setAbertoId} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="fornecedores" className="gap-2"><Users className="h-4 w-4" /> Fornecedores</TabsTrigger>
          <TabsTrigger value="busca" className="gap-2"><Search className="h-4 w-4" /> Busca</TabsTrigger>
          <TabsTrigger value="selecao" className="gap-2"><ListChecks className="h-4 w-4" /> Seleção</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-2"><CalendarRange className="h-4 w-4" /> Calendário</TabsTrigger>
          <TabsTrigger value="mapa" className="gap-2"><MapIcon className="h-4 w-4" /> Mapa</TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-2"><BookOpen className="h-4 w-4" /> Catálogo</TabsTrigger>
        </TabsList>

        <TabsContent value="fornecedores" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar nome, assentamento ou localidade…" className="max-w-sm" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as situações</SelectItem>
                {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {fornecedores.length === 0 && !isLoading ? (
            <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
              <Sprout className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">Nenhum fornecedor na vitrine ainda</p>
              <p className="text-sm text-muted-foreground">Cadastre o produtor e depois as ofertas dele (produto, quantidade, meses e preço).</p>
            </div>
          ) : (
            <DataTable
              data={filtrados}
              columns={columns}
              keyExtractor={(f) => f.id}
              onRowClick={(f) => setAbertoId(f.id)}
              isLoading={isLoading}
              emptyMessage="Nenhum fornecedor encontrado."
            />
          )}
        </TabsContent>

        <TabsContent value="busca"><BuscaTab onOpenFornecedor={setAbertoId} preset={preset} /></TabsContent>
        <TabsContent value="selecao"><SelecaoTab onOpenFornecedor={setAbertoId} /></TabsContent>
        <TabsContent value="calendario"><CalendarioTab onPick={irParaBusca} /></TabsContent>
        <TabsContent value="mapa"><MapaTab onOpenFornecedor={setAbertoId} /></TabsContent>
        <TabsContent value="catalogo"><CatalogoTab /></TabsContent>
      </Tabs>

      <FornecedorForm
        open={form.open}
        onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
        fornecedor={form.f}
        linkedProducerIds={linkedProducerIds}
        onSaved={(id) => { if (!form.f) setAbertoId(id); }}
      />
      <FornecedorSheet
        fornecedor={aberto}
        onOpenChange={(o) => { if (!o) setAbertoId(null); }}
        onEdit={(f) => setForm({ open: true, f })}
        onDelete={(f) => setExcluir(f)}
      />
      <ConfirmDialog
        open={!!excluir}
        onOpenChange={(o) => { if (!o) setExcluir(null); }}
        title="Remover fornecedor"
        description={excluir ? `Remover "${excluir.nome}" da vitrine, com todas as ofertas e documentos? O cadastro rural (se vinculado) NÃO é afetado. Para apenas pausar, mude a situação para Inativo.` : ''}
        onConfirm={() => { if (excluir) { delFornecedor.mutate(excluir.id); setAbertoId(null); } setExcluir(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </AppLayout>
  );
}
