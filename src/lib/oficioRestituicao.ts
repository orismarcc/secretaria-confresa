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
import { criarTimbrado, linhaJustificada as justificar } from '@/lib/timbradoPdf';

export type MotivoRestituicao = 'climatica' | 'area_inadequada';

export const MOTIVOS_RESTITUICAO: { id: MotivoRestituicao; rotulo: string; detalhe: string }[] = [
  { id: 'climatica', rotulo: 'Condições climáticas', detalhe: 'Período chuvoso / acúmulo de água na área' },
  { id: 'area_inadequada', rotulo: 'Área sem condições adequadas', detalhe: 'Área não apresenta condições para os trabalhos no momento' },
];

const MODELO = '/templates/oficio-restituicao.docx';

// ─── Comprovante de pagamento da DAM (anexado logo após o ofício) ─────────────

export type TipoComprovante = 'pdf' | 'jpeg' | 'png';
export interface Comprovante { bytes: Uint8Array; tipo: TipoComprovante }

/** Identifica o arquivo pelos primeiros bytes (não confia na extensão). */
export function tipoDoArquivo(b: Uint8Array): TipoComprovante | 'webp' | null {
  if (b.length < 12) return null;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'; // %PDF
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

/** Largura × altura (px) de um JPEG ou PNG, lidas do cabeçalho. */
export function dimensoesImagem(b: Uint8Array, tipo: 'jpeg' | 'png'): { w: number; h: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  if (tipo === 'png') {
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
    const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    return w && h ? { w, h } : null;
  }
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = u16(i + 5), w = u16(i + 7);
      return w && h ? { w, h } : null;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + u16(i + 2);
  }
  return null;
}

/** WebP → PNG pelo navegador (Word e jsPDF lidam melhor com PNG). */
async function webpParaPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext('2d')?.drawImage(bmp, 0, 0);
    const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Baixa o comprovante anexado à DAM. Devolve null se não der para usar. */
export async function baixarComprovante(url: string): Promise<Comprovante | null> {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  let bytes = new Uint8Array(await resp.arrayBuffer());
  let tipo = tipoDoArquivo(bytes);
  if (tipo === 'webp') {
    const png = await webpParaPng(bytes);
    if (!png) return null;
    bytes = png; tipo = 'png';
  }
  return tipo ? { bytes, tipo } : null;
}

/** O comprovante (pela URL) parece PDF? — PDF só pode ser juntado ao ofício em PDF. */
export function comprovanteEhPdf(url: string | null | undefined): boolean {
  return /\.pdf(\?|#|$)/i.test(url || '');
}

/** Acrescenta a imagem do comprovante numa página nova, ao fim do .docx. */
function anexarImagemNoDocx(zip: PizZip, comp: Comprovante): boolean {
  if (comp.tipo === 'pdf') return false;
  const dim = dimensoesImagem(comp.bytes, comp.tipo);
  const xml = zip.file('word/document.xml')?.asText();
  const rels = zip.file('word/_rels/document.xml.rels')?.asText();
  if (!dim || !xml || !rels) return false;
  const fim = xml.lastIndexOf('<w:sectPr');
  if (fim < 0) return false;
  const ext = comp.tipo === 'png' ? 'png' : 'jpg';
  const alvo = `media/comprovante-dam.${ext}`;
  zip.file(`word/${alvo}`, comp.bytes);
  const rid = 'rIdComprovanteDam';
  zip.file('word/_rels/document.xml.rels', rels.replace('</Relationships>',
    `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${alvo}"/></Relationships>`));
  // Área útil da página do modelo (EMU), com folga para o cabeçalho.
  const maxW = 6400000, maxH = 7600000;
  const esc = Math.min(maxW / dim.w, maxH / dim.h);
  const cx = Math.round(dim.w * esc), cy = Math.round(dim.h * esc);
  const pagina =
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' +
    '<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/><w:b/></w:rPr><w:t>COMPROVANTE DE PAGAMENTO DA DAM</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>' +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="9001" name="Comprovante da DAM"/>` +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
    '<pic:nvPicPr><pic:cNvPr id="9001" name="comprovante-dam"/><pic:cNvPicPr/></pic:nvPicPr>' +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  zip.file('word/document.xml', xml.slice(0, fim) + pagina + xml.slice(fim));
  return true;
}

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
export async function buildOficioRestituicaoDocx(d: OficioRestituicaoData, comprovante?: Comprovante | null): Promise<{ blob: Blob; filename: string; comprovanteIncluido: boolean }> {
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
  // Comprovante (imagem) logo após o ofício — depois do preenchimento, para
  // não passar pelo motor de campos.
  const comprovanteIncluido = comprovante ? anexarImagemNoDocx(doc.getZip(), comprovante) : false;
  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
  return { blob, filename: `Oficio-Restituicao-DAM-${nomeArquivo(d.nome)}.docx`, comprovanteIncluido };
}

/** Monta o ofício em PDF (mesmo texto e timbrado do modelo). */
export async function buildOficioRestituicaoPdf(d: OficioRestituicaoData, comprovante?: Comprovante | null): Promise<{ blob: Blob; filename: string; comprovanteIncluido: boolean }> {
  const c = campos(d);
  const resp = await fetch(MODELO);
  if (!resp.ok) throw new Error('Modelo do ofício não encontrado.');
  const zip = new PizZip(await resp.arrayBuffer());
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const { desenhar: timbrado, headerH, footerH } = criarTimbrado(doc, zip);
  timbrado();

  const mL = 56, mR = 42, cW = W - mL - mR;
  const bottomLimit = H - footerH - 8;
  const topo = headerH + 26;
  let y = topo;
  const setFont = (bold: boolean) => doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const ensure = (h: number) => { if (y + h > bottomLimit) { doc.addPage(); timbrado(); y = topo; } };

  const linhaJustificada = (ln: string, x: number, yy: number, largura: number) => justificar(doc, ln, x, yy, largura);

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
      else if (o.justify && i < lines.length - 1) linhaJustificada(ln, mL, y, cW);
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
    doc.text(label, mL, y);
    // Rótulo + espaço folgado (em rótulos longos um espaço simples some na tela).
    const lw = doc.getTextWidth(label) + doc.getTextWidth(' ') * 2;
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
    // 1ª linha começa depois do rótulo; as demais usam a largura toda.
    const palavras = `SOLICITAÇÃO DE RESTITUIÇÃO DE VALOR PAGO REFERENTE À DAM – SERVIÇO DE ${c.servico_titulo}`.split(/\s+/);
    const linhas: string[] = [];
    let atual = '';
    for (const w of palavras) {
      const lim = linhas.length === 0 ? cW - lw : cW;
      const tent = atual ? `${atual} ${w}` : w;
      if (atual && doc.getTextWidth(tent) > lim) { linhas.push(atual); atual = w; } else atual = tent;
    }
    if (atual) linhas.push(atual);
    ensure(15 * linhas.length); setFont(true); doc.text(rot, mL, y); setFont(false);
    linhas.forEach((ln, i) => {
      const x = mL + (i ? 0 : lw);
      if (i < linhas.length - 1) linhaJustificada(ln, x, y, i ? cW : cW - lw);
      else doc.text(ln, x, y);
      y += 10.5 * 1.32;
    });
    y += 6;
  }
  para(`A Secretaria Municipal de Agricultura solicita a análise e a adoção das providências necessárias para a restituição do valor pago pelo produtor rural abaixo identificado, referente ao Documento de Arrecadação Municipal (DAM) emitido para a realização de serviço de ${c.servico}.`, { justify: true, lh: 1.32, gap: 8 });
  para(c.justificativa, { justify: true, lh: 1.32, gap: 8 });
  para('Diante da impossibilidade de atendimento, solicita-se a análise do pedido e, constatada a regularidade do recolhimento e a inexistência de impedimentos administrativos, a restituição do valor pago, mediante transferência bancária para conta de titularidade do produtor identificado abaixo, observados os procedimentos legais e administrativos aplicáveis.', { justify: true, lh: 1.32, gap: 14 });

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
  para(`Declaro que as informações pessoais e bancárias acima são verdadeiras, que sou o responsável pelo pagamento da DAM informada e que solicito a restituição do valor correspondente em razão da impossibilidade de execução do serviço de ${c.servico} contratado.`, { justify: true, lh: 1.32, gap: 6 });
  // O último parágrafo acompanha as assinaturas (assinatura nunca fica sozinha na página).
  const autorizo = 'Autorizo a utilização dos dados bancários informados exclusivamente para fins de processamento da restituição, conforme os procedimentos administrativos aplicáveis.';
  doc.setFontSize(10.5); setFont(false);
  ensure((doc.splitTextToSize(autorizo, cW) as string[]).length * 10.5 * 1.32 + 18 + 92);
  para(autorizo, { justify: true, lh: 1.32, gap: 18 });

  ensure(110);
  para('_______________________________', { center: true, gap: 1 });
  para('PRODUTOR', { bold: true, center: true, gap: 20 });
  para('_______________________________', { center: true, gap: 1 });
  para(c.assinante_nome, { bold: true, center: true, gap: 0 });
  para(c.assinante_cargo, { bold: true, center: true, gap: 0 });

  const filename = `Oficio-Restituicao-DAM-${nomeArquivo(d.nome)}.pdf`;

  // Comprovante logo após o ofício.
  if (comprovante && comprovante.tipo !== 'pdf') {
    const dim = dimensoesImagem(comprovante.bytes, comprovante.tipo);
    if (dim) {
      doc.addPage();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(25);
      doc.text('COMPROVANTE DE PAGAMENTO DA DAM', W / 2, 40, { align: 'center' });
      const maxW = W - 80, maxH = H - 100;
      const esc = Math.min(maxW / dim.w, maxH / dim.h);
      const w = dim.w * esc, h = dim.h * esc;
      try {
        doc.addImage(comprovante.bytes, comprovante.tipo === 'png' ? 'PNG' : 'JPEG', (W - w) / 2, 56, w, h, undefined, 'FAST');
        return { blob: doc.output('blob'), filename, comprovanteIncluido: true };
      } catch {
        doc.deletePage(doc.getNumberOfPages());
      }
    }
  }
  if (comprovante?.tipo === 'pdf') {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const base = await PDFDocument.load(doc.output('arraybuffer'));
      const anexo = await PDFDocument.load(comprovante.bytes, { ignoreEncryption: true });
      const paginas = await base.copyPages(anexo, anexo.getPageIndices());
      paginas.forEach((pg) => base.addPage(pg));
      const bytes = await base.save();
      return { blob: new Blob([bytes], { type: 'application/pdf' }), filename, comprovanteIncluido: true };
    } catch { /* comprovante ilegível: sai só o ofício */ }
  }
  return { blob: doc.output('blob'), filename, comprovanteIncluido: false };
}
