// Página de uma associação: Regularização (checklist + documentos),
// Maquinário cedido, Atendimentos e Dados.
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ArrowLeft, CalendarClock, ClipboardCheck, ClipboardList, Copy, Info, KeyRound, Mail, MapPin, Pencil, Phone, Tractor, Trash2, User, Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSettlements } from '@/hooks/useSupabaseData';
import {
  useAssociacoes, useAtendimentosAssociacoes, useCessoes, useDispensas, useDocumentosAssociacoes, useExcluirAssociacao, useItensChecklist,
} from '@/hooks/useAssociacoes';
import { AssociacaoFormDialog } from '@/components/associacoes/AssociacaoFormDialog';
import { ChecklistRegularizacao } from '@/components/associacoes/ChecklistRegularizacao';
import { MaquinasCedidas } from '@/components/associacoes/MaquinasCedidas';
import { AtendimentosAssociacao } from '@/components/associacoes/AtendimentosAssociacao';
import { AnelRegularidade, SituacaoBadge, dataBR } from '@/components/associacoes/comum';
import { calcularRegularidade, cessoesAtivas, formatarCnpj, situacaoMandato, tipoAssociacao } from '@/lib/associacoes';

type Aba = 'regularizacao' | 'maquinas' | 'atendimentos' | 'dados';
const ABAS: Aba[] = ['regularizacao', 'maquinas', 'atendimentos', 'dados'];

export default function AssociacaoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba: Aba = ABAS.includes(params.get('aba') as Aba) ? (params.get('aba') as Aba) : 'regularizacao';
  const setAba = (a: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('aba', a); return n; }, { replace: true });

  const { data: associacoes = [], isLoading } = useAssociacoes();
  const { data: itens = [] } = useItensChecklist();
  const { data: documentos = [] } = useDocumentosAssociacoes();
  const { data: dispensas = [] } = useDispensas();
  const { data: cessoes = [] } = useCessoes();
  const { data: atendimentos = [] } = useAtendimentosAssociacoes();
  const { data: assentamentos = [] } = useSettlements();
  const excluir = useExcluirAssociacao();
  const [editando, setEditando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const a = associacoes.find((x) => x.id === id);
  const regularidade = useMemo(() => calcularRegularidade(id, itens, documentos, dispensas), [id, itens, documentos, dispensas]);
  const minhasCessoes = useMemo(() => cessoes.filter((c) => c.associacao_id === id), [cessoes, id]);
  const meusAtendimentos = useMemo(() => atendimentos.filter((x) => x.associacao_id === id), [atendimentos, id]);

  if (isLoading) return <AppLayout><div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div></AppLayout>;
  if (!a) {
    return (
      <AppLayout>
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">Associação não encontrada.</p>
          <Button variant="outline" onClick={() => navigate('/associacoes?aba=associacoes')}>Voltar para Associações</Button>
        </div>
      </AppLayout>
    );
  }

  const mandato = situacaoMandato(a.mandato_fim);
  const assent = (assentamentos as { id: string; name: string }[]).find((s) => s.id === a.settlement_id)?.name;
  const maqAtivas = cessoesAtivas(minhasCessoes).length;
  const copiarCnpj = () => {
    if (!a.cnpj) return;
    navigator.clipboard?.writeText(formatarCnpj(a.cnpj)).then(() => toast({ title: 'CNPJ copiado' })).catch(() => undefined);
  };

  const Info2 = ({ ic: Ic, rot, children }: { ic: typeof User; rot: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-2 text-sm"><Ic className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground">{rot}</p><div className="font-medium break-words">{children}</div></div></div>
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate('/associacoes?aba=associacoes')}><ArrowLeft className="h-4 w-4" /> Associações</Button>

        {/* Cabeçalho */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2"><SituacaoBadge situacao={a.situacao} />{a.sigla && <span className="text-sm font-semibold text-muted-foreground">{a.sigla}</span>}</div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{a.nome}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {a.cnpj ? (
                  <button type="button" onClick={copiarCnpj} className="inline-flex items-center gap-1 hover:text-foreground" title="Copiar CNPJ">CNPJ {formatarCnpj(a.cnpj)} <Copy className="h-3.5 w-3.5" /></button>
                ) : <span className="text-amber-700 dark:text-amber-400">CNPJ não informado</span>}
                <span>{tipoAssociacao(a.tipo)}</span>
                {assent && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {assent}</span>}
              </div>
              {(mandato === 'vencido' || mandato === 'vencendo') && (
                <p className={`text-sm flex items-center gap-1.5 ${mandato === 'vencido' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
                  <CalendarClock className="h-4 w-4" /> Mandato da diretoria {mandato === 'vencido' ? `venceu em ${dataBR(a.mandato_fim)}` : `termina em ${dataBR(a.mandato_fim)}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <AnelRegularidade percentual={regularidade.percentual} regular={regularidade.regular} tamanho={80} />
              <div className="flex md:flex-col gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" /> Editar</Button>
                {canDelete && <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmarExclusao(true)}><Trash2 className="h-4 w-4" /> Excluir</Button>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={aba} onValueChange={setAba} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto sm:w-auto sm:inline-grid">
            <TabsTrigger value="regularizacao" className="gap-1.5 py-2"><ClipboardCheck className="h-4 w-4" /><span className="hidden sm:inline">Regularização</span>{regularidade.pendencias.length > 0 && <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5">{regularidade.pendencias.length}</span>}</TabsTrigger>
            <TabsTrigger value="maquinas" className="gap-1.5 py-2"><Tractor className="h-4 w-4" /><span className="hidden sm:inline">Maquinário</span>{maqAtivas > 0 && <span className="text-[10px] text-muted-foreground">{maqAtivas}</span>}</TabsTrigger>
            <TabsTrigger value="atendimentos" className="gap-1.5 py-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Atendimentos</span></TabsTrigger>
            <TabsTrigger value="dados" className="gap-1.5 py-2"><Info className="h-4 w-4" /><span className="hidden sm:inline">Dados</span></TabsTrigger>
          </TabsList>

          <TabsContent value="regularizacao">
            <ChecklistRegularizacao associacaoId={a.id} itens={itens} regularidade={regularidade} documentos={documentos} />
          </TabsContent>
          <TabsContent value="maquinas">
            <MaquinasCedidas associacaoId={a.id} cessoes={minhasCessoes} todasCessoes={cessoes} atendimentos={meusAtendimentos} />
          </TabsContent>
          <TabsContent value="atendimentos">
            <AtendimentosAssociacao associacao={a} atendimentos={meusAtendimentos} cessoesAtivas={cessoesAtivas(minhasCessoes)} />
          </TabsContent>
          <TabsContent value="dados">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardContent className="p-4 space-y-3">
                <p className="font-semibold">Diretoria</p>
                <Info2 ic={User} rot="Presidente">{a.presidente_nome || '—'}</Info2>
                <Info2 ic={Phone} rot="Telefone do presidente">{a.presidente_telefone || '—'}</Info2>
                <Info2 ic={CalendarClock} rot="Mandato">{a.mandato_inicio || a.mandato_fim ? `${dataBR(a.mandato_inicio)} a ${dataBR(a.mandato_fim)}` : '—'}</Info2>
                <Info2 ic={Users} rot="Associados">{a.numero_associados ?? '—'}</Info2>
              </CardContent></Card>
              <Card><CardContent className="p-4 space-y-3">
                <p className="font-semibold">Contato e sede</p>
                <Info2 ic={MapPin} rot="Endereço">{a.endereco || '—'}</Info2>
                <Info2 ic={Phone} rot="Telefone">{a.telefone || '—'}</Info2>
                <Info2 ic={Mail} rot="E-mail">{a.email || '—'}</Info2>
                <Info2 ic={CalendarClock} rot="Fundação">{dataBR(a.data_fundacao)}</Info2>
                {a.observacoes && <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t pt-2">{a.observacoes}</p>}
              </CardContent></Card>
              <Card className="lg:col-span-2 border-dashed"><CardContent className="p-4 flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold">Próxima etapa: acesso do presidente</p>
                  <p className="text-muted-foreground">O presidente poderá entrar no sistema para atualizar os documentos, formalizar pedidos e projetos e lançar os atendimentos da associação — vendo só a própria associação. Tudo o que for cadastrado agora já fica pronto para isso.</p>
                </div>
              </CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AssociacaoFormDialog aberto={editando} associacao={a} existentes={associacoes} onClose={() => setEditando(false)} />
      <ConfirmDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao} title={`Excluir "${a.nome}"?`}
        description="O cadastro, os documentos anexados, as cessões de máquinas e os atendimentos desta associação serão apagados. Esta ação não pode ser desfeita. Se a associação apenas parou de funcionar, prefira mudar a situação para Inativa."
        confirmLabel="Excluir" variant="destructive"
        onConfirm={async () => { try { await excluir.mutateAsync(a); navigate('/associacoes?aba=associacoes'); } catch { /* aviso */ } }} />
    </AppLayout>
  );
}
