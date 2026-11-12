// Ofícios da Secretaria: Painel · Ofícios Cadastrados · Modelos de Ofícios.
// Acesso: equipe interna (exceto Assistente de Campo). Excluir: admin pleno.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookTemplate, FileStack, LayoutDashboard } from 'lucide-react';
import { useOficioModelos, useOficios } from '@/hooks/useOficios';
import { PainelOficios } from '@/components/oficios/PainelOficios';
import { ListaOficios } from '@/components/oficios/ListaOficios';
import { ModelosOficios } from '@/components/oficios/ModelosOficios';
import { OficioFormDialog } from '@/components/oficios/OficioFormDialog';
import { OficioDetalheSheet } from '@/components/oficios/OficioDetalheSheet';
import type { Oficio, OficioModelo } from '@/lib/oficios';

type Aba = 'painel' | 'oficios' | 'modelos';
const ABAS: Aba[] = ['painel', 'oficios', 'modelos'];

export default function OficiosPage() {
  const [params, setParams] = useSearchParams();
  const aba: Aba = ABAS.includes(params.get('aba') as Aba) ? (params.get('aba') as Aba) : 'painel';
  const setAba = (a: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('aba', a); return n; }, { replace: true });

  const { data: oficios = [], isLoading } = useOficios();
  const { data: modelos = [], isLoading: carregandoModelos } = useOficioModelos();

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [form, setForm] = useState<{ oficio: Oficio | null; modelo?: OficioModelo | null } | null>(null);

  // Ficha sempre com os dados mais recentes (após enviar arquivo, editar...).
  const detalhe = useMemo(() => oficios.find((o) => o.id === detalheId) ?? null, [oficios, detalheId]);
  // Abrir direto por link: /oficios?oficio=<id>
  useEffect(() => {
    const id = params.get('oficio');
    if (id && oficios.some((o) => o.id === id)) setDetalheId(id);
  }, [params, oficios]);

  const abrir = (o: Oficio) => setDetalheId(o.id);
  const novo = (modelo?: OficioModelo | null) => setForm({ oficio: null, modelo });

  return (
    <AppLayout>
      <PageHeader title="Ofícios" description="Cadastro, numeração, arquivos assinados e modelos dos ofícios da Secretaria" />

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="painel" className="gap-1.5"><LayoutDashboard className="h-4 w-4" /><span>Painel</span></TabsTrigger>
          <TabsTrigger value="oficios" className="gap-1.5"><FileStack className="h-4 w-4" /><span className="sm:hidden">Ofícios</span><span className="hidden sm:inline">Ofícios Cadastrados</span></TabsTrigger>
          <TabsTrigger value="modelos" className="gap-1.5"><BookTemplate className="h-4 w-4" /><span>Modelos</span></TabsTrigger>
        </TabsList>

        <TabsContent value="painel">
          <PainelOficios oficios={oficios} carregando={isLoading} onAbrir={abrir} onNovo={() => novo()} podeCriar />
        </TabsContent>
        <TabsContent value="oficios">
          <ListaOficios oficios={oficios} carregando={isLoading} onAbrir={abrir} onNovo={() => novo()} podeCriar />
        </TabsContent>
        <TabsContent value="modelos">
          <ModelosOficios modelos={modelos} oficios={oficios} carregando={carregandoModelos} onUsar={(m) => novo(m)} podeCriar />
        </TabsContent>
      </Tabs>

      <OficioFormDialog
        aberto={!!form}
        oficio={form?.oficio ?? null}
        modeloInicial={form?.modelo}
        oficios={oficios}
        modelos={modelos}
        onClose={() => setForm(null)}
        onSalvo={(o) => setDetalheId(o.id)}
      />
      <OficioDetalheSheet
        oficio={detalhe}
        modelos={modelos}
        onClose={() => {
          setDetalheId(null);
          if (params.get('oficio')) setParams((p) => { const n = new URLSearchParams(p); n.delete('oficio'); return n; }, { replace: true });
        }}
        onEditar={(o) => setForm({ oficio: o })}
      />
    </AppLayout>
  );
}
