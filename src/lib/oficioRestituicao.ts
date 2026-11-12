/**
 * oficioRestituicao.ts — Ofício de solicitação de restituição da DAM (à
 * Secretaria Municipal de Finanças) para atendimento cancelado.
 * Preenche o modelo oficial (/templates/oficio-restituicao.docx), preservando
 * fonte (Tahoma) e timbrado; o PDF replica o texto com o mesmo timbrado.
 * Os dados bancários entram só no documento — não são gravados no banco.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import jsPDF from 'jspdf';
import { valorPorExtenso, ASSINANTES_COMUNICADO, type AssinanteComunicado } from '@/lib/comunicado';

export type MotivoRestituicao = 'climatica' | 'area_inadequada';

export const MOTIVOS_RESTITUICAO: { id: MotivoRestituicao; rotulo: string; detalhe: string }[] = [
  { id: 'climatica', rotulo: 'Condições climáticas', detalhe: 'Período chuvoso / acúmulo de água na área' },
  { id: 'area_inadequada', rotulo: 'Área sem condições adequadas', detalhe: 'Área não apresenta condições para os trabalhos no momento' },
];

const MODELO = '/templates/oficio-restituicao.docx';

/** Texto do serviço no ofício (minúsculas, como no corpo). O usuário pode ajustar. */
export function descricaoServicoOficio(nomeTipo: string | null | undefined, categoria?: string | null): string {
  const nome = (nomeTipo || '').trim();
  const n = nome.toLowerCase();
  if (n === 'pc') return 'escavação com Patrulha Mecanizada (PC)';
  if (n === 'grade') return 'gradagem com Patrulha Mecanizada (Grade)';
  if (n === 'roçadeira') return 'roçagem com Patrulha Mecanizada (Roçadeira)';
  if (n.startsWith('perfuração de solo') || n.startsWith('furador de solo')) return `perfuração de solo (${nome})`;
  if (categoria === 'patrulha_mecanizada' && nome) return `Patrulha Mecanizada (${nome})`;
  return nome ? nome.charAt(0).toLowerCase() + nome.slice(1) : 'atendimento';
}

/** "à escavação" quando o serviço é escavação (PC); senão "ao serviço". */
function destinoDaArea(servico: string): string {
  return /escava/i.test(servico) ? 'à escavação' : 'ao serviço';
}

/** Parágrafo de justificativa conforme a opção escolhida. */
export function justificativaRestituicao(motivo: MotivoRestituicao, servico: string): string {
  const area = destinoDaArea(servico);
  if (motivo === 'area_inadequada') {
    return `A restituição justifica-se pela impossibilidade de execução do serviço, uma vez que a área destinada ${area} não apresenta condições adequadas para a realização dos trabalhos no momento.`;
  }
  return `A restituição justifica-se pela impossibilidade de execução do serviço em razão das condições climáticas atuais, especialmente pelo período chuvoso e pelo acúmulo de água já verificado na área destinada ${area}. Tais condições comprometem o deslocamento seguro das máquinas e a execução dos trabalhos, tornando inviável a realização do serviço neste momento, além de poderem ocasionar atolamentos, danos aos equipamentos e riscos operacionais.`;
}

/** "473" → "473/2026"; "473/2026" fica como está. */
export function numeroOficioCompleto(numero: string, data: Date = new Date()): string {
  const n = (numero || '').trim();
  if (!n) return '';
  return n.includes('/') ? n : `${n}/${data.getFullYear()}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "06 de novembro de 2026" (dia com 2 dígitos, como no modelo). */
export function dataOficio(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** 1211.15 → "1.211,15" */
export function formatValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface OficioRestituicaoData {
  numero: string;          // já completo, ex.: "473/2026"
  data: Date;
  servico: string;         // ex.: "escavação com Patrulha Mecanizada (PC)"
  motivo: MotivoRestituicao;
  nome: string;
  cpf: string;
  comunidade: string;
  telefone: string;
  banco: string;
  agencia: string;
  conta: string;
  pix?: string;
  valor: number;
  assinante?: AssinanteComunicado;
}

function nomeArquivo(nome: string): string {
  return (nome || 'produtor').replace(/[^\p{L}\s]/gu, '').trim().replace(/\s+/g, '-');
}

function campos(d: OficioRestituicaoData) {
  const assinante = d.assinante ?? ASSINANTES_COMUNICADO[0];
  const pix = (d.pix || '').trim();
  return {
    numero: d.numero,
    data: dataOficio(d.data),
    servico: d.servico,
    servico_titulo: d.servico.toUpperCase(),
    justificativa: justificativaRestituicao(d.motivo, d.servico),
    nome: (d.nome || '').toUpperCase(),
    cpf: d.cpf || '—',
    comunidade: (d.comunidade || '—').toUpperCase(),
    telefone: d.telefone || '—',
    banco: (d.banco || '').toUpperCase(),
    agencia: d.agencia,
    conta: d.conta,
    tem_pix: !!pix,
    pix,
    valor: formatValor(d.valor),
    valor_ext: valorPorExtenso(d.valor),
    assinante_nome: assinante.nome,
    assinante_cargo: assinante.cargo,
  };
}

/** Monta o ofício .docx em memória (não baixa). */
export async function buildOficioRestituicaoDocx(d: OficioRestituicaoData): Promise<{ blob: Blob; filename: string }> {
  const resp = await fetch(MODELO);
  if (!resp.ok) throw new Error('Modelo do ofício não encontrado.');
  const zip = new PizZip(await resp.arrayBuffer());
  const c = campos(d);
  // Sem chave PIX: some a linha inteira (não fica parágrafo em branco).
  if (!c.tem_pix) {
    const xml = zip.file('word/document.xml')?.asText();
    if (xml) zip.file('word/document.xml', xml.replace(/<w:p[ >](?:(?!<\/w:p>).)*?\{#tem_pix\}.*?<\/w:p>/s, ''));
  }
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(c);
  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
  return { blob, filename: `Oficio-Restituicao-DAM-${nomeArquivo(d.nome)}.docx` };
}

function u8ToBase64(u8: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

/** Monta o ofício em PDF (mesmo texto e timbrado do modelo). */
export async function buildOficioRestituicaoPdf(d: OficioRestituicaoData): Promise<{ blob: Blob; filename: string }> {
  const c = campos(d);
  const resp = await fetch(MODELO);
  if (!resp.ok) throw new Error('Modelo do ofício não encontrado.');
  const zip = new PizZip(await resp.arrayBuffer());
  const headerImg = zip.file('word/media/image4.png');
  const footerImg = zip.file('word/media/image1.jpg');
  const headerB64 = headerImg ? 'data:image/png;base64,' + u8ToBase64(headerImg.asUint8Array()) : null;
  const footerB64 = footerImg ? 'data:image/jpeg;base64,' + u8ToBase64(footerImg.asUint8Array()) : null;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const headerH = W * (866775 / 7629525);
  const footerH = W * (893326 / 7556500);
  const timbrado = () => {
    if (headerB64) { try { doc.addImage(headerB64, 'PNG', 0, 14, W, headerH, undefined, 'FAST'); } catch { /* ignora */ } }
    if (footerB64) { try { doc.addImage(footerB64, 'JPEG', 0, H - footerH - 6, W, footerH, undefined, 'FAST'); } catch { /* ignora */ } }
  };
  timbrado();

  const mL = 56, mR = 42, cW = W - mL - mR;
  const bottomLimit = H - footerH - 18;
  const topo = 14 + headerH + 20;
  let y = topo;
  const setFont = (bold: boolean) => doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const ensure = (h: number) => { if (y + h > bottomLimit) { doc.addPage(); timbrado(); y = topo; } };

  const para = (text: string, o: { bold?: boolean; justify?: boolean; center?: boolean; gap?: number; lh?: number } = {}) => {
    const size = 10.5;
    const lh = size * (o.lh ?? 1.35);
    doc.setFontSize(size); setFont(!!o.bold); doc.setTextColor(25);
    const lines = doc.splitTextToSize(text, cW) as string[];
    // Parágrafo não se divide entre páginas (cabe inteiro ou vai para a próxima).
    ensure(lh * lines.length);
    lines.forEach((ln, i) => {
      ensure(lh);
      if (o.center) doc.text(ln, mL + cW / 2, y, { align: 'center' });
      else if (o.justify && i < lines.length - 1) doc.text(ln, mL, y, { align: 'justify', maxWidth: cW });
      else doc.text(ln, mL, y);
      y += lh;
    });
    y += o.gap ?? 6;
  };
  const labeled = (label: string, value: string) => {
    const lh = 10.5 * 1.35;
    ensure(lh);
    doc.setFontSize(10.5); doc.setTextColor(25);
    setFont(false);
    doc.text(label + ' ', mL, y);
    const lw = doc.getTextWidth(label + ' ');
    setFont(true);
    const lines = doc.splitTextToSize(String(value), cW - lw) as string[];
    doc.text(lines[0] ?? '', mL + lw, y);
    y += lh;
    lines.slice(1).forEach((ln) => { ensure(lh); doc.text(ln, mL + lw, y); y += lh; });
    y += 1;
  };

  para(`OFÍCIO Nº ${c.numero} – SMA`, { bold: true, gap: 1 });
  para(`Confresa/MT, ${c.data}.`, { bold: true, gap: 14 });
  para('À SECRETARIA MUNICIPAL DE FINANÇAS', { bold: true, gap: 10 });
  // ASSUNTO: rótulo em negrito + texto normal
  {
    const rot = 'ASSUNTO: ';
    doc.setFontSize(10.5); setFont(true);
    const lw = doc.getTextWidth(rot);
    setFont(false);
    const linhas = doc.splitTextToSize(`SOLICITAÇÃO DE RESTITUIÇÃO DE VALOR PAGO REFERENTE À DAM – SERVIÇO DE ${c.servico_titulo}`, cW - lw) as string[];
    ensure(15); setFont(true); doc.text(rot, mL, y); setFont(false);
    linhas.forEach((ln, i) => { if (i) ensure(15); doc.text(ln, mL + (i ? 0 : lw), y); y += 10.5 * 1.38; });
    y += 6;
  }
  para(`A Secretaria Municipal de Agricultura solicita a análise e a adoção das providências necessárias para a restituição do valor pago pelo produtor rural abaixo identificado, referente ao Documento de Arrecadação Municipal (DAM) emitido para a realização de serviço de ${c.servico}.`, { justify: true, lh: 1.38, gap: 8 });
  para(c.justificativa, { justify: true, lh: 1.38, gap: 8 });
  para('Diante da impossibilidade de atendimento, solicita-se a análise do pedido e, constatada a regularidade do recolhimento e a inexistência de impedimentos administrativos, a restituição do valor pago, mediante transferência bancária para conta de titularidade do produtor identificado abaixo, observados os procedimentos legais e administrativos aplicáveis.', { justify: true, lh: 1.38, gap: 14 });

  para('1. IDENTIFICAÇÃO DO PRODUTOR', { bold: true, gap: 4 });
  labeled('Nome completo:', c.nome);
  labeled('CPF:', c.cpf);
  labeled('Comunidade/Assentamento/Gleba:', c.comunidade);
  labeled('Telefone:', c.telefone);
  y += 6;
  para('2. DADOS BANCÁRIOS PARA RESTITUIÇÃO', { bold: true, gap: 4 });
  labeled('Nome completo:', c.nome);
  labeled('CPF do titular:', c.cpf);
  labeled('Banco:', c.banco);
  labeled('Agência:', c.agencia);
  labeled('Conta:', c.conta);
  if (c.tem_pix) labeled('Chave PIX:', c.pix);
  labeled('Valor:', `R$ ${c.valor} (${c.valor_ext})`);
  y += 6;
  para('3. DECLARAÇÃO DO PRODUTOR', { bold: true, gap: 4 });
  para(`Declaro que as informações pessoais e bancárias acima são verdadeiras, que sou o responsável pelo pagamento da DAM informada e que solicito a restituição do valor correspondente em razão da impossibilidade de execução do serviço de ${c.servico} contratado.`, { justify: true, lh: 1.38, gap: 6 });
  // O último parágrafo acompanha as assinaturas (assinatura nunca fica sozinha na página).
  const autorizo = 'Autorizo a utilização dos dados bancários informados exclusivamente para fins de processamento da restituição, conforme os procedimentos administrativos aplicáveis.';
  doc.setFontSize(10.5); setFont(false);
  ensure((doc.splitTextToSize(autorizo, cW) as string[]).length * 10.5 * 1.38 + 26 + 100);
  para(autorizo, { justify: true, lh: 1.38, gap: 26 });

  ensure(110);
  para('_______________________________', { center: true, gap: 1 });
  para('PRODUTOR', { bold: true, center: true, gap: 24 });
  para('_______________________________', { center: true, gap: 1 });
  para(c.assinante_nome, { bold: true, center: true, gap: 0 });
  para(c.assinante_cargo, { bold: true, center: true, gap: 0 });

  return { blob: doc.output('blob'), filename: `Oficio-Restituicao-DAM-${nomeArquivo(d.nome)}.pdf` };
}
