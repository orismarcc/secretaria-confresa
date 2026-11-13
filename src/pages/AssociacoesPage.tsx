// Associações rurais / de trabalhadores rurais: Painel · Associações ·
// Checklist padrão. A página de cada associação fica em /associacoes/:id.
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Handshake, LayoutDashboard, ListChecks, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAssociacoes, useAtendimentosAssociacoes, useCessoes, useDispensas, useDocumentosAssociacoes, useItensChecklist,
} from '@/hooks/useAssociacoes';
import { PainelAssociacoes } from '@/components/associacoes/PainelAssociacoes';
import { ListaAssociacoes } from '@/components/associacoes/ListaAssociacoes';
import { ChecklistPadrao } from '@/components/associacoes/ChecklistPadrao';
import { AssociacaoFormDialog } from '@/components/associacoes/AssociacaoFormDialog';
import { AlertasVencimentoAssociacoes } from '@/components/associacoes/AlertasVencimento';
import { calcularRegularidade, type Regularidade } from '@/lib/associacoes';

type Aba = 'painel' | 'associacoes' | 'checklist';
const ABAS: Aba[] = ['painel', 'associacoes', 'checklist'];

export default function AssociacoesPage() {
  const navigate = useNavigate();
  const { isFullAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba: Aba = ABAS.includes(params.get('aba') as Aba) ? (params.get('aba') as Aba) : 'painel';
  const setAba = (a: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('aba', a); return n; }, { replace: true });

  const { data: associacoes = [], isLoading } = useAssociacoes();
  const { data: itens = [] } = useItensChecklist();
  const { data: documentos = [] } = useDocumentosAssociacoes();
  const { data: dispensas = [] } = useDispensas();
  const { data: cessoes = [] } = useCessoes();
  const { data: atendimentos = [] } = useAtendimentosAssociacoes();
  const [novo, setNovo] = useState(false);

  const regularidades = useMemo(() => new Map<string, Regularidade>(
    associacoes.map((a) => [a.id, calcularRegularidade(a.id, itens, documentos, dispensas)]),
  ), [associacoes, itens, documentos, dispensas]);
  const abrir = (id: string) => navigate(`/associacoes/${id}`);

  return (
    <AppLayout>
      <PageHeader title="Associações" description="Regularização, maquinário cedido e atendimentos das associações rurais e de trabalhadores rurais"
        action={associacoes.length > 0 ? { label: 'Nova associação', onClick: () => setNovo(true), icon: <Plus className="h-4 w-4" /> } : undefined} />

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="painel" className="gap-1.5"><LayoutDashboard className="h-4 w-4" /> Painel</TabsTrigger>
          <TabsTrigger value="associacoes" className="gap-1.5"><Handshake className="h-4 w-4" /> Associações</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5"><ListChecks className="h-4 w-4" /><span className="sm:hidden">Checklist</span><span className="hidden sm:inline">Checklist padrão</span></TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-36 w-full" /><Skeleton className="h-64 w-full" /></div>
        ) : (
          <>
            <TabsContent value="painel" className="space-y-4">
              <AlertasVencimentoAssociacoes />
              <PainelAssociacoes associacoes={associacoes} regularidades={regularidades} cessoes={cessoes} atendimentos={atendimentos} documentos={documentos} onAbrir={abrir} onNova={() => setNovo(true)} />
            </TabsContent>
            <TabsContent value="associacoes">
              <ListaAssociacoes associacoes={associacoes} regularidades={regularidades} cessoes={cessoes} onAbrir={abrir} onNova={() => setNovo(true)} />
            </TabsContent>
            <TabsContent value="checklist">
              <ChecklistPadrao itens={itens} podeEditar={isFullAdmin} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <AssociacaoFormDialog aberto={novo} associacao={null} existentes={associacoes} onClose={() => setNovo(false)} onSalva={(a) => abrir(a.id)} />
    </AppLayout>
  );
}
