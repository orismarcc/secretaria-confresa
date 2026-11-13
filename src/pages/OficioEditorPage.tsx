// Editor de ofícios / modelos de texto: escrever como no Word / Google Docs,
// na folha com o timbrado. Salva no sistema (Ctrl+S, automático a cada
// minuto com alterações) e exporta para Word ou impressão / PDF.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ArrowLeft, Check, FileDown, Loader2, Printer, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOficioModelos, useOficios, useSalvarConteudo } from '@/hooks/useOficios';
import { BarraFerramentas, FolhaOficio, useEditorOficio } from '@/components/oficios/EditorOficio';
import { SituacaoBadge } from '@/components/oficios/comum';
import { triggerDownload } from '@/lib/comunicado';
import {
  MODELO_PADRAO_HTML, MODELO_WORD_BASE, gerarDocxDoEditor, paginaImpressao, preencherCamposHtml, type NoEditor,
} from '@/lib/oficioEditor';
import { ehModeloDeTexto, numeroCompleto, type Oficio, type OficioModelo } from '@/lib/oficios';

const AUTOSALVAR_MS = 60_000;

function EditorCarregado({ tipo, id, titulo, subtitulo, conteudoInicial, nomeArquivo, oficio }: {
  tipo: 'oficio' | 'modelo';
  id: string;
  titulo: string;
  subtitulo?: string;
  conteudoInicial: string;
  nomeArquivo: string;
  oficio?: Oficio;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const salvar = useSalvarConteudo();
  const [alterado, setAlterado] = useState(false);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [sairSemSalvar, setSairSemSalvar] = useState(false);
  const [exportando, setExportando] = useState<'word' | null>(null);
  const alteradoRef = useRef(false);
  const htmlRef = useRef(conteudoInicial);
  const editor = useEditorOficio(conteudoInicial, (html) => { htmlRef.current = html; alteradoRef.current = true; setAlterado(true); });
  // Saiu da tela por outro menu com alterações: salva antes de sair.
  const salvarRef = useRef(salvar.mutate);
  salvarRef.current = salvar.mutate;
  useEffect(() => () => {
    if (alteradoRef.current) salvarRef.current({ tipo, id, html: htmlRef.current });
  }, [tipo, id]);

  const gravar = useCallback(async (silencioso = false) => {
    if (!editor || salvar.isPending) return;
    const html = editor.getHTML();
    htmlRef.current = html;
    alteradoRef.current = false;
    try {
      await salvar.mutateAsync({ tipo, id, html });
      if (!alteradoRef.current) setAlterado(false);
      setSalvoEm(new Date());
      if (!silencioso) toast({ title: 'Texto salvo' });
    } catch {
      alteradoRef.current = true;
    }
  }, [editor, salvar, tipo, id, toast]);

  // Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); gravar(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [gravar]);
  // Salva sozinho a cada minuto, se houver alterações.
  useEffect(() => {
    const t = window.setInterval(() => { if (alteradoRef.current) gravar(true); }, AUTOSALVAR_MS);
    return () => window.clearInterval(t);
  }, [gravar]);
  // Aviso ao fechar a aba com alterações não salvas.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (alteradoRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const voltar = () => {
    if (alteradoRef.current) { setSairSemSalvar(true); return; }
    navigate(tipo === 'oficio' ? `/oficios?aba=oficios&oficio=${id}` : '/oficios?aba=modelos');
  };

  const imprimir = () => {
    if (!editor) return;
    const janela = window.open('', '_blank');
    if (!janela) { toast({ title: 'Permita a abertura de nova janela para imprimir', variant: 'destructive' }); return; }
    janela.document.open();
    janela.document.write(paginaImpressao(editor.getHTML(), nomeArquivo, window.location.origin));
    janela.document.close();
    // Imprime quando as imagens do timbrado carregarem.
    const imprimirQuandoPronto = () => {
      const imgs = Array.from(janela.document.images);
      Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((ok) => { i.onload = ok; i.onerror = ok; }))))
        .then(() => setTimeout(() => { janela.focus(); janela.print(); }, 250));
    };
    if (janela.document.readyState === 'complete') imprimirQuandoPronto(); else janela.onload = imprimirQuandoPronto;
  };

  const baixarWord = async () => {
    if (!editor) return;
    setExportando('word');
    try {
      const r = await fetch(MODELO_WORD_BASE);
      if (!r.ok) throw new Error('Modelo do Word não encontrado.');
      triggerDownload(gerarDocxDoEditor(editor.getJSON() as NoEditor, await r.arrayBuffer()), `${nomeArquivo}.docx`);
    } catch (e) {
      toast({ title: 'Erro ao gerar o Word', description: (e as Error).message, variant: 'destructive' });
    } finally { setExportando(null); }
  };

  const status = salvar.isPending
    ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</span>
    : alterado
      ? <span className="text-amber-700 dark:text-amber-400">Alterações não salvas</span>
      : salvoEm
        ? <span className="inline-flex items-center gap-1 text-success"><Check className="h-3.5 w-3.5" /> Salvo às {salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        : <span>Tudo salvo</span>;

  return (
    <div className="-mx-4 sm:mx-0 space-y-3">
      {/* Barra superior fixa: título, status, ações e formatação */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b sm:border sm:rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate flex items-center gap-2">{titulo}{oficio && <SituacaoBadge situacao={oficio.situacao} className="hidden sm:inline-flex" />}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitulo ? `${subtitulo} · ` : ''}{status}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={imprimir} className="gap-1.5" title="Imprimir ou salvar como PDF">
              <Printer className="h-4 w-4" /><span className="hidden sm:inline">Imprimir / PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={baixarWord} disabled={!!exportando} className="gap-1.5" title="Baixar em Word (.docx)">
              {exportando === 'word' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              <span className="hidden sm:inline">Word</span>
            </Button>
            <Button size="sm" onClick={() => gravar()} disabled={salvar.isPending || !alterado} className="gap-1.5" title="Salvar (Ctrl+S)">
              <Save className="h-4 w-4" /><span className="hidden sm:inline">Salvar</span>
            </Button>
          </div>
        </div>
        <div className="border-t px-2">
          <BarraFerramentas editor={editor} comCampos={tipo === 'modelo'} />
        </div>
      </div>

      {tipo === 'modelo' && (
        <p className="text-xs text-muted-foreground px-3 sm:px-0">
          Modelo de texto: os campos entre chaves (ex.: <code>{'{numero}'}</code>, <code>{'{destinatario}'}</code>) são preenchidos com os dados de cada ofício que usar este modelo.
        </p>
      )}

      <div className="bg-muted/40 sm:rounded-xl py-4 sm:py-8 px-2 sm:px-6 overflow-x-auto">
        <FolhaOficio editor={editor} />
        <p className="text-center text-[11px] text-muted-foreground mt-3">A divisão em páginas aparece ao imprimir / salvar em PDF e no Word — o timbrado se repete em todas.</p>
      </div>

      <ConfirmDialog
        open={sairSemSalvar}
        onOpenChange={setSairSemSalvar}
        title="Sair sem salvar?"
        description="Há alterações no texto que ainda não foram salvas e serão perdidas."
        confirmLabel="Sair sem salvar"
        variant="destructive"
        onConfirm={() => {
          alteradoRef.current = false;
          navigate(tipo === 'oficio' ? `/oficios?aba=oficios&oficio=${id}` : '/oficios?aba=modelos');
        }}
      />
    </div>
  );
}

export default function OficioEditorPage() {
  const { tipo: tipoParam, id = '' } = useParams();
  const tipo = tipoParam === 'modelo' ? 'modelo' : 'oficio';
  const navigate = useNavigate();
  const { data: oficios = [], isLoading: carregandoOficios } = useOficios();
  const { data: modelos = [], isLoading: carregandoModelos } = useOficioModelos();
  const carregando = carregandoOficios || carregandoModelos;

  const dados = useMemo(() => {
    if (carregando) return null;
    if (tipo === 'oficio') {
      const o = oficios.find((x) => x.id === id);
      if (!o) return undefined;
      const modelo: OficioModelo | undefined = modelos.find((m) => m.id === o.modelo_id);
      // Primeira vez no editor: parte do modelo de texto escolhido (ou do padrão).
      const base = ehModeloDeTexto(modelo) && modelo?.conteudo_html ? modelo.conteudo_html : MODELO_PADRAO_HTML;
      const conteudo = o.conteudo_html ?? preencherCamposHtml(base, {
        numero: numeroCompleto(o), data: o.data_oficio, destinatario: o.destinatario,
        assunto: o.assunto, categoria: o.categoria, descricao: o.descricao ?? '',
      });
      return {
        titulo: `Ofício Nº ${numeroCompleto(o)}`, subtitulo: o.assunto, conteudo,
        nomeArquivo: `Oficio-${o.numero}-${o.ano}`, oficio: o,
      };
    }
    const m = modelos.find((x) => x.id === id);
    if (!m) return undefined;
    return {
      titulo: `Modelo: ${m.nome}`, subtitulo: m.categoria, conteudo: m.conteudo_html ?? MODELO_PADRAO_HTML,
      nomeArquivo: `Modelo-${m.nome.replace(/[^\p{L}\d]+/gu, '-')}`, oficio: undefined,
    };
  }, [carregando, tipo, id, oficios, modelos]);

  return (
    <AppLayout>
      {dados === null ? (
        <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-[60vh] w-full max-w-[210mm] mx-auto" /></div>
      ) : dados === undefined ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">{tipo === 'oficio' ? 'Ofício não encontrado.' : 'Modelo não encontrado.'}</p>
          <Button variant="outline" onClick={() => navigate('/oficios')}>Voltar para Ofícios</Button>
        </div>
      ) : (
        <EditorCarregado
          key={`${tipo}-${id}`}
          tipo={tipo}
          id={id}
          titulo={dados.titulo}
          subtitulo={dados.subtitulo}
          conteudoInicial={dados.conteudo}
          nomeArquivo={dados.nomeArquivo}
          oficio={dados.oficio}
        />
      )}
    </AppLayout>
  );
}
