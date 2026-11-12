// Detalhes do ofício: dados, arquivo assinado (ver/baixar/enviar/substituir),
// histórico de versões, gerar documento do modelo, editar e excluir.
import { useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Download, Eye, FileCheck2, FileDown, FileWarning, History, Loader2, Pencil, RefreshCw, Trash2, Upload,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  abrirArquivoOficio, useEnviarArquivoOficio, useExcluirOficio, useNomesPessoas, useOficioArquivos,
} from '@/hooks/useOficios';
import { SituacaoBadge, gerarDocumentoDoModelo } from './comum';
import {
  dataBR, numeroCompleto, problemaPdf, tamanhoLegivel, type Oficio, type OficioModelo,
} from '@/lib/oficios';

const dataHora = (iso: string) => {
  const d = new Date(iso.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export function OficioDetalheSheet({ oficio, modelos, onClose, onEditar }: {
  oficio: Oficio | null;
  modelos: OficioModelo[];
  onClose: () => void;
  onEditar: (o: Oficio) => void;
}) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: versoes = [], isLoading } = useOficioArquivos(oficio?.id ?? null);
  const { data: nomes } = useNomesPessoas();
  const enviar = useEnviarArquivoOficio();
  const excluir = useExcluirOficio();
  const [pendente, setPendente] = useState<File | null>(null); // arquivo aguardando confirmação da substituição
  const [motivo, setMotivo] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  if (!oficio) return null;
  const modelo = modelos.find((m) => m.id === oficio.modelo_id) ?? null;
  const nomeArquivo = `Oficio-${oficio.numero}-${oficio.ano}.pdf`;

  const abrir = async (path: string, baixarComo?: string) => {
    setAbrindo(path + (baixarComo ? ':d' : ''));
    try { await abrirArquivoOficio(path, baixarComo); }
    catch (e) { toast({ title: 'Não foi possível abrir o arquivo', description: (e as Error).message, variant: 'destructive' }); }
    finally { setAbrindo(null); }
  };

  const escolher = (f: File | null) => {
    if (!f) return;
    const erro = problemaPdf(f);
    if (erro) { toast({ title: erro, variant: 'destructive' }); return; }
    if (oficio.arquivo_path) { setMotivo(''); setPendente(f); return; } // substituir: confirma antes
    enviar.mutate({ oficio, arquivo: f });
  };

  const confirmarSubstituicao = async () => {
    if (!pendente) return;
    try {
      await enviar.mutateAsync({ oficio, arquivo: pendente, motivo: motivo.trim() || undefined });
      setPendente(null);
    } catch { /* aviso já exibido */ }
  };

  const gerarDoc = async () => {
    setGerando(true);
    try {
      const aviso = await gerarDocumentoDoModelo(modelo, {
        numero: numeroCompleto(oficio), data: oficio.data_oficio, destinatario: oficio.destinatario,
        assunto: oficio.assunto, categoria: oficio.categoria, descricao: oficio.descricao ?? '',
      });
      if (aviso) toast({ title: 'Documento baixado', description: aviso });
    } catch (e) {
      toast({ title: 'Erro ao gerar o documento', description: (e as Error).message, variant: 'destructive' });
    } finally { setGerando(false); }
  };

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium break-words">{valor}</span>
    </div>
  );

  return (
    <>
      <Sheet open={!!oficio} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left flex items-center gap-2 flex-wrap">
              Ofício Nº {numeroCompleto(oficio)}
              <SituacaoBadge situacao={oficio.situacao} />
            </SheetTitle>
            <SheetDescription className="text-left">{oficio.assunto}</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              {linha('Data', dataBR(oficio.data_oficio))}
              {linha('Destinatário', oficio.destinatario)}
              {linha('Categoria', oficio.categoria)}
              {linha('Modelo', modelo ? modelo.nome : oficio.modelo_id ? 'Modelo excluído' : '—')}
              {oficio.descricao && linha('Descrição', <span className="whitespace-pre-wrap font-normal">{oficio.descricao}</span>)}
              {linha('Cadastro', `${dataHora(oficio.created_at)}${oficio.created_by && nomes?.get(oficio.created_by) ? ` · ${nomes.get(oficio.created_by)}` : ''}`)}
            </div>

            <Separator />

            {/* Arquivo assinado */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Arquivo final assinado</p>
              {oficio.arquivo_path ? (
                <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <FileCheck2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{oficio.arquivo_nome}</p>
                      <p className="text-xs text-muted-foreground">Versão {oficio.arquivo_versao} · {tamanhoLegivel(oficio.arquivo_tamanho)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant="outline" onClick={() => abrir(oficio.arquivo_path!)} disabled={!!abrindo}>
                      {abrindo === oficio.arquivo_path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 sm:mr-1.5" />}
                      <span className="hidden sm:inline">Visualizar</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrir(oficio.arquivo_path!, nomeArquivo)} disabled={!!abrindo}>
                      <Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Baixar</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={enviar.isPending}>
                      {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 sm:mr-1.5" />}
                      <span className="hidden sm:inline">Substituir</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                  <FileWarning className="h-6 w-6 text-amber-500 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhum PDF assinado anexado.</p>
                  <Button size="sm" onClick={() => inputRef.current?.click()} disabled={enviar.isPending}>
                    {enviar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                    Enviar PDF assinado
                  </Button>
                </div>
              )}
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => { escolher(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            </div>

            {/* Histórico */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5"><History className="h-4 w-4" /> Histórico do arquivo</p>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : versoes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem envios ainda.</p>
              ) : (
                <ol className="space-y-2">
                  {versoes.map((v) => (
                    <li key={v.id} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2">
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-sm">
                          Versão {v.versao} {v.versao === oficio.arquivo_versao && <span className="text-success font-normal">(atual)</span>}
                        </p>
                        <p className="text-muted-foreground truncate">{v.arquivo_nome} · {tamanhoLegivel(v.arquivo_tamanho)}</p>
                        <p className="text-muted-foreground">
                          {v.acao === 'envio' ? 'Enviado' : 'Substituído'} em {dataHora(v.enviado_em)}
                          {v.enviado_por && nomes?.get(v.enviado_por) ? ` por ${nomes.get(v.enviado_por)}` : ''}
                        </p>
                        {v.motivo && <p className="italic">Motivo: {v.motivo}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Visualizar" onClick={() => abrir(v.arquivo_path)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar" onClick={() => abrir(v.arquivo_path, `Oficio-${oficio.numero}-${oficio.ano}-v${v.versao}.pdf`)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={gerarDoc} disabled={gerando}>
                {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                Gerar documento do {modelo ? `modelo "${modelo.nome}"` : 'modelo padrão'}
              </Button>
              <Button variant="outline" onClick={() => onEditar(oficio)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar dados
              </Button>
              {canDelete && (
                <Button variant="destructive" onClick={() => setConfirmarExclusao(true)} disabled={excluir.isPending}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir ofício
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmar substituição */}
      <Dialog open={!!pendente} onOpenChange={(o) => { if (!o && !enviar.isPending) setPendente(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Substituir o arquivo assinado?</DialogTitle>
            <DialogDescription>
              O PDF atual (versão {oficio.arquivo_versao}) continua guardado no histórico. O novo arquivo
              <strong> {pendente?.name}</strong> passa a ser a versão {oficio.arquivo_versao + 1}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="of-motivo">Motivo da substituição (opcional)</Label>
            <Textarea id="of-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ex.: assinatura corrigida" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendente(null)} disabled={enviar.isPending}>Cancelar</Button>
            <Button onClick={confirmarSubstituicao} disabled={enviar.isPending}>
              {enviar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmarExclusao}
        onOpenChange={setConfirmarExclusao}
        title={`Excluir o Ofício Nº ${numeroCompleto(oficio)}?`}
        description="O cadastro e todas as versões do arquivo assinado serão apagados. Esta ação não pode ser desfeita. O número fica livre novamente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          try { await excluir.mutateAsync(oficio); onClose(); } catch { /* aviso já exibido */ }
        }}
      />
    </>
  );
}
