// Cancelar atendimento — com a opção de gerar o OFÍCIO de solicitação de
// restituição da DAM (à Sec. de Finanças). Também serve para gerar o ofício
// de um atendimento JÁ cancelado (modo 'oficio').
// Ao gerar, o atendimento fica com a restituição PENDENTE; a confirmação é
// feita depois, nos detalhes do atendimento. Os dados bancários entram só no
// documento (não são gravados).
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDown, FileText, Loader2, XCircle, CloudRain, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUpdateService } from '@/hooks/useSupabaseData';
import { triggerDownload, ASSINANTES_COMUNICADO } from '@/lib/comunicado';
import {
  MOTIVOS_RESTITUICAO,
  buildOficioRestituicaoDocx,
  buildOficioRestituicaoPdf,
  descricaoServicoOficio,
  justificativaRestituicao,
  numeroOficioCompleto,
  baixarComprovante,
  comprovanteEhPdf,
  type Comprovante,
  type MotivoRestituicao,
} from '@/lib/oficioRestituicao';

export interface CancelamentoAlvo {
  id: string;
  status: string;
  dam_paid?: boolean | null;
  dam_value?: number | string | null;
  produtor: { nome: string; cpf: string; telefone: string };
  tipo: { nome: string; categoria?: string | null };
  comunidade: string;
  /** Comprovante de pagamento da DAM anexado (vai logo após o ofício). */
  comprovanteUrl?: string | null;
}

interface Props {
  alvo: CancelamentoAlvo | null;
  /** 'cancelar' = cancela (ofício opcional); 'oficio' = só gera o ofício (já cancelado). */
  modo: 'cancelar' | 'oficio';
  /** Quem vê DAM pode gerar o ofício (Coordenador não vê DAM). */
  podeGerarOficio: boolean;
  onClose: () => void;
}

function maskMoeda(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseNum(v: string): number {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CancelamentoRestituicaoDialog({ alvo, modo, podeGerarOficio, onClose }: Props) {
  const { toast } = useToast();
  const updateService = useUpdateService();
  const [motivoCancel, setMotivoCancel] = useState('');
  const [gerarOficio, setGerarOficio] = useState(false);
  const [motivo, setMotivo] = useState<MotivoRestituicao>('climatica');
  const [numero, setNumero] = useState('');
  const [servico, setServico] = useState('');
  const [comunidade, setComunidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [pix, setPix] = useState('');
  const [valor, setValor] = useState('');
  const [assinanteId, setAssinanteId] = useState<string>(ASSINANTES_COMUNICADO[0].id);
  const [gerando, setGerando] = useState(false);

  // Reinicia a cada abertura
  useEffect(() => {
    if (!alvo) return;
    setMotivoCancel('');
    setGerarOficio(modo === 'oficio' || (podeGerarOficio && !!alvo.dam_paid));
    setMotivo('climatica');
    setNumero('');
    setServico(descricaoServicoOficio(alvo.tipo.nome, alvo.tipo.categoria));
    setComunidade(alvo.comunidade || '');
    setTelefone(alvo.produtor.telefone || '');
    setBanco(''); setAgencia(''); setConta(''); setPix('');
    const v = Number(alvo.dam_value) || 0;
    setValor(v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    setAssinanteId(ASSINANTES_COMUNICADO[0].id);
  }, [alvo?.id, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const comOficio = podeGerarOficio && (modo === 'oficio' || gerarOficio);
  const valorNum = parseNum(valor);
  const faltando = useMemo(() => {
    const f: string[] = [];
    if (modo === 'cancelar' && !motivoCancel.trim()) f.push('motivo do cancelamento');
    if (comOficio) {
      if (!numero.trim()) f.push('nº do ofício');
      if (!servico.trim()) f.push('serviço');
      if (!banco.trim()) f.push('banco');
      if (!agencia.trim()) f.push('agência');
      if (!conta.trim()) f.push('conta');
      if (!(valorNum > 0)) f.push('valor');
    }
    return f;
  }, [modo, motivoCancel, comOficio, numero, servico, banco, agencia, conta, valorNum]);

  if (!alvo) return null;

  const escolherMotivo = (m: MotivoRestituicao) => {
    setMotivo(m);
    // Sugere o motivo do cancelamento, se ainda vazio.
    if (modo === 'cancelar' && !motivoCancel.trim()) {
      setMotivoCancel(MOTIVOS_RESTITUICAO.find((x) => x.id === m)?.rotulo ?? '');
    }
  };

  const fechar = () => { if (!gerando) onClose(); };

  const cancelarSemOficio = async () => {
    setGerando(true);
    try {
      await updateService.mutateAsync({ id: alvo.id, status: 'cancelled', cancellation_reason: motivoCancel.trim() || null });
      onClose();
    } catch { /* aviso já exibido */ } finally { setGerando(false); }
  };

  const gerar = async (formato: 'docx' | 'pdf') => {
    if (faltando.length) return;
    setGerando(true);
    let etapa: 'documento' | 'banco' = 'documento';
    try {
      const agora = new Date();
      const numeroCompleto = numeroOficioCompleto(numero, agora);
      const dados = {
        numero: numeroCompleto,
        data: agora,
        servico: servico.trim(),
        motivo,
        nome: alvo.produtor.nome,
        cpf: alvo.produtor.cpf,
        comunidade: comunidade.trim(),
        telefone: telefone.trim(),
        banco: banco.trim(),
        agencia: agencia.trim(),
        conta: conta.trim(),
        pix: pix.trim(),
        valor: valorNum,
        assinante: ASSINANTES_COMUNICADO.find((a) => a.id === assinanteId) ?? ASSINANTES_COMUNICADO[0],
      };
      // Comprovante anexado à DAM: vai logo após o ofício. Se não der para
      // baixar/ler, o ofício sai assim mesmo e avisamos.
      let comprovante: Comprovante | null = null;
      if (alvo.comprovanteUrl) {
        try { comprovante = await baixarComprovante(alvo.comprovanteUrl); } catch { comprovante = null; }
      }
      // 1) Monta o arquivo (se falhar, nada é alterado no banco).
      const { blob, filename, comprovanteIncluido } = formato === 'pdf'
        ? await buildOficioRestituicaoPdf(dados, comprovante)
        : await buildOficioRestituicaoDocx(dados, comprovante);

      // 2) Grava ANTES do download (no iOS o download suspende a página).
      etapa = 'banco';
      await updateService.mutateAsync({
        id: alvo.id,
        ...(modo === 'cancelar' ? { status: 'cancelled', cancellation_reason: motivoCancel.trim() || null } : {}),
        restituicao_status: 'pendente',
        restituicao_valor: valorNum,
        restituicao_motivo: motivo,
        restituicao_oficio: numeroCompleto,
        restituicao_solicitada_em: agora.toISOString(),
      });

      // 3) Download por último.
      triggerDownload(blob, filename);
      toast({
        title: `Ofício Nº ${numeroCompleto} gerado`,
        description: `Restituição de ${fmtBRL(valorNum)} pendente — confirme nos detalhes do atendimento quando o valor for devolvido.`
          + (comprovanteIncluido ? ' Comprovante de pagamento incluído após o ofício.' : ''),
      });
      if (alvo.comprovanteUrl && !comprovanteIncluido) {
        toast({
          title: 'Comprovante não foi incluído',
          description: comprovante?.tipo === 'pdf' && formato === 'docx'
            ? 'O comprovante é PDF e só pode ser juntado ao ofício em PDF. Gere em PDF para sair junto.'
            : 'Não foi possível ler o comprovante anexado. Junte-o manualmente ao ofício.',
          variant: 'destructive',
        });
      }
      onClose();
    } catch (e: any) {
      // Erro ao gravar já é avisado pelo useUpdateService; aqui cobre o documento.
      if (etapa === 'documento') {
        toast({ title: 'Erro ao gerar o ofício', description: e?.message || String(e), variant: 'destructive' });
      }
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modo === 'cancelar'
              ? <><XCircle className="h-5 w-5 text-destructive" /> Cancelar Atendimento</>
              : <><FileText className="h-5 w-5 text-primary" /> Ofício de Restituição da DAM</>}
          </DialogTitle>
          <DialogDescription>
            {modo === 'cancelar'
              ? 'Informe o motivo do cancelamento. Ele ficará registrado no histórico do produtor.'
              : 'Solicitação à Secretaria Municipal de Finanças. A restituição fica pendente até ser confirmada.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {modo === 'cancelar' && (
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Motivo *</Label>
              <Textarea
                id="cancel-reason"
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
                placeholder="Ex: produtor desistiu, duplicidade, erro de cadastro..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {modo === 'cancelar' && podeGerarOficio && (
            <label htmlFor="gerar-oficio" className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 cursor-pointer">
              <Checkbox id="gerar-oficio" checked={gerarOficio} onCheckedChange={(v) => setGerarOficio(!!v)} className="mt-0.5" />
              <span className="text-sm">
                Gerar ofício de solicitação de restituição da DAM
                {!alvo.dam_paid && (
                  <span className="block text-xs text-amber-700 dark:text-amber-400">A DAM deste atendimento não está marcada como paga.</span>
                )}
              </span>
            </label>
          )}

          {comOficio && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm space-y-0.5">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Produtor</span><span className="font-medium text-right">{alvo.produtor.nome}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">CPF</span><span className="font-medium">{alvo.produtor.cpf || '—'}</span></div>
              </div>

              <div className="space-y-1.5">
                <Label>Justificativa *</Label>
                <div className="grid grid-cols-1 gap-2">
                  {MOTIVOS_RESTITUICAO.map((m) => {
                    const ativo = motivo === m.id;
                    const Icone = m.id === 'climatica' ? CloudRain : Ban;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => escolherMotivo(m.id)}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${ativo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                        aria-pressed={ativo}
                      >
                        <Icone className={`h-4 w-4 mt-0.5 shrink-0 ${ativo ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{m.rotulo}</span>
                          <span className="block text-xs text-muted-foreground">{m.detalhe}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground italic leading-snug">“{justificativaRestituicao(motivo, servico || 'serviço')}”</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="of-servico">Serviço (como sai no ofício) *</Label>
                <Input id="of-servico" value={servico} onChange={(e) => setServico(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="of-numero">Nº do ofício *</Label>
                  <Input id="of-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={`Ex.: 473 (/${new Date().getFullYear()})`} inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="of-valor">Valor a restituir (R$) *</Label>
                  <Input id="of-valor" value={valor} onChange={(e) => setValor(maskMoeda(e.target.value))} placeholder="0,00" inputMode="numeric" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="of-comunidade">Comunidade/Assentamento/Gleba</Label>
                  <Input id="of-comunidade" value={comunidade} onChange={(e) => setComunidade(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="of-telefone">Telefone</Label>
                  <Input id="of-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />
                </div>
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Dados bancários do produtor</p>
              <div className="space-y-1.5">
                <Label htmlFor="of-banco">Banco *</Label>
                <Input id="of-banco" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ex.: Banco do Brasil" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="of-agencia">Agência *</Label>
                  <Input id="of-agencia" value={agencia} onChange={(e) => setAgencia(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="of-conta">Conta *</Label>
                  <Input id="of-conta" value={conta} onChange={(e) => setConta(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="of-pix">Chave PIX <span className="text-muted-foreground font-normal">(se houver)</span></Label>
                <Input id="of-pix" value={pix} onChange={(e) => setPix(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground">Os dados bancários vão apenas para o documento — não ficam salvos no sistema.</p>

              <div className="space-y-1.5">
                <Label htmlFor="of-assinante">Responsável pela assinatura</Label>
                <select
                  id="of-assinante"
                  value={assinanteId}
                  onChange={(e) => setAssinanteId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ASSINANTES_COMUNICADO.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome} — {a.cargo}</option>
                  ))}
                </select>
              </div>

              {alvo.comprovanteUrl ? (
                <p className="text-xs rounded-md bg-success/10 text-success px-3 py-2">
                  O comprovante de pagamento anexado à DAM será incluído logo após o ofício.
                  {comprovanteEhPdf(alvo.comprovanteUrl) && <span className="block text-muted-foreground">Como o comprovante é PDF, ele só sai junto no <strong>PDF</strong>.</span>}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Sem comprovante de pagamento anexado à DAM.</p>
              )}

              <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <span className="text-sm font-medium">Restituição</span>
                <span className="text-lg font-black text-primary">{fmtBRL(valorNum)}</span>
              </div>
            </div>
          )}

          {faltando.length > 0 && (comOficio || modo === 'cancelar') && (
            <p className="text-xs text-muted-foreground">Preencha: {faltando.join(', ')}.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={fechar} disabled={gerando}>Voltar</Button>
          {comOficio ? (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" onClick={() => gerar('docx')} disabled={gerando || faltando.length > 0}>
                {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {modo === 'cancelar' ? 'Cancelar + DOC' : 'Gerar DOC'}
              </Button>
              <Button variant={modo === 'cancelar' ? 'destructive' : 'default'} onClick={() => gerar('pdf')} disabled={gerando || faltando.length > 0}>
                {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                {modo === 'cancelar' ? 'Cancelar + PDF' : 'Gerar PDF'}
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={cancelarSemOficio} disabled={gerando || faltando.length > 0}>
              {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmar Cancelamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
