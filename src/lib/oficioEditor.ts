/**
 * oficioEditor.ts — editor de ofícios (como Word / Google Docs) dentro do
 * sistema:
 *   * modelo padrão em HTML (mesma estrutura do ofício oficial) e campos
 *     {numero}, {data}... preenchidos com os dados do ofício;
 *   * exportação para Word (.docx) sobre o modelo oficial: mantém o
 *     cabeçalho (timbrado) e coloca o rodapé no pé de todas as páginas;
 *   * página de impressão A4 (Imprimir / Salvar como PDF) com o timbrado
 *     repetido em cada página.
 * Funções puras (testáveis); o editor em si fica em components/oficios.
 */
import PizZip from 'pizzip';
import { dataBR, dataExtenso, MIME_DOCX } from '@/lib/oficios';

export const TIMBRADO = {
  logo: '/templates/timbrado/logo.png',
  icone: '/templates/timbrado/icone.png',
  rodape: '/templates/timbrado/rodape.jpg',
};
export const MODELO_WORD_BASE = '/templates/oficio-padrao.docx';
export const FONTE_OFICIO = 'Tahoma, Verdana, "DejaVu Sans", sans-serif';

// ─── Modelo padrão e campos ──────────────────────────────────────────────────

/** Estrutura do ofício oficial, com campos entre chaves. */
export const MODELO_PADRAO_HTML = [
  '<p><strong>OFÍCIO Nº {numero} – SMA</strong></p>',
  '<p><strong>Confresa/MT, {data}.</strong></p>',
  '<p></p>',
  '<p><strong>{destinatario}</strong></p>',
  '<p style="text-align: justify"><strong>ASSUNTO:</strong> {assunto}</p>',
  '<p style="text-align: justify" data-recuo="true">{descricao}</p>',
  '<p></p>',
  '<p></p>',
  '<p style="text-align: center">_______________________________</p>',
  '<p style="text-align: center"><strong>CASSIO RODRIGUES DA COSTA</strong></p>',
  '<p style="text-align: center"><strong>SECRETÁRIO DE AGRICULTURA</strong></p>',
].join('');

export interface CamposOficio {
  numero: string;       // "473/2026"
  data: string;         // yyyy-MM-dd
  destinatario: string;
  assunto: string;
  categoria: string;
  descricao: string;
}

export function escaparHtml(t: string): string {
  return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Troca os campos {numero}, {data}, {data_curta}, {destinatario}, {assunto},
 * {categoria} e {descricao} pelos dados do ofício (texto escapado). Campos
 * desconhecidos ficam como estão.
 */
export function preencherCamposHtml(html: string, c: CamposOficio): string {
  const valores: Record<string, string> = {
    numero: escaparHtml(c.numero),
    data: escaparHtml(dataExtenso(c.data)),
    data_curta: escaparHtml(dataBR(c.data)),
    destinatario: escaparHtml(c.destinatario),
    assunto: escaparHtml(c.assunto),
    categoria: escaparHtml(c.categoria),
    descricao: c.descricao.trim()
      ? escaparHtml(c.descricao.trim()).replace(/\r?\n/g, '<br>')
      : 'Escreva aqui o texto do ofício.',
  };
  return html.replace(/\{(numero|data_curta|data|destinatario|assunto|categoria|descricao)\}/g, (_m, k: string) => valores[k]);
}

// ─── Exportação para Word ────────────────────────────────────────────────────

/** Nó do editor (formato JSON do TipTap/ProseMirror). */
export interface NoEditor {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoEditor[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const FONTE_RUN = '<w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma" w:eastAsia="Tahoma"/>';
const escXml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "12pt" → 24 (meios-pontos do Word). */
function meiosPontos(tam: unknown): number | null {
  const m = /^(\d+(?:\.\d+)?)pt$/.exec(String(tam ?? ''));
  return m ? Math.round(Number(m[1]) * 2) : null;
}

function runs(nos: NoEditor[] | undefined, extra: { negrito?: boolean; tamanho?: number } = {}): string {
  return (nos ?? []).map((n) => {
    if (n.type === 'hardBreak') return '<w:r><w:br/></w:r>';
    if (n.type !== 'text' || !n.text) return '';
    const marcas = new Set((n.marks ?? []).map((m) => m.type));
    const tam = meiosPontos(n.marks?.find((m) => m.type === 'textStyle')?.attrs?.fontSize) ?? extra.tamanho ?? null;
    const rPr = [
      FONTE_RUN,
      marcas.has('bold') || extra.negrito ? '<w:b/><w:bCs/>' : '',
      marcas.has('italic') ? '<w:i/><w:iCs/>' : '',
      marcas.has('strike') ? '<w:strike/>' : '',
      marcas.has('underline') ? '<w:u w:val="single"/>' : '',
      tam ? `<w:sz w:val="${tam}"/><w:szCs w:val="${tam}"/>` : '',
    ].join('');
    return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escXml(n.text)}</w:t></w:r>`;
  }).join('');
}

const ALINHAMENTO: Record<string, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };
const RECUO_ESQ = 567;   // recuo do texto no modelo oficial (twips)
const RECUO_DIR = 566;

function paragrafo(n: NoEditor, o: { esquerda?: number; prefixo?: string; negrito?: boolean; tamanho?: number; dentroTabela?: boolean } = {}): string {
  const jc = ALINHAMENTO[String(n.attrs?.textAlign ?? '')] ?? '';
  const recuo = n.attrs?.recuo ? ' w:firstLine="709"' : '';
  const esq = o.dentroTabela ? 0 : (o.esquerda ?? RECUO_ESQ);
  const dir = o.dentroTabela ? 0 : RECUO_DIR;
  const pPr = [
    `<w:spacing w:after="${o.dentroTabela ? 0 : 120}" w:line="${o.dentroTabela ? 240 : 360}" w:lineRule="auto"/>`,
    o.prefixo ? `<w:ind w:left="${esq + 360}" w:right="${dir}" w:hanging="360"/>` : `<w:ind w:left="${esq}" w:right="${dir}"${recuo}/>`,
    jc ? `<w:jc w:val="${jc}"/>` : '',
  ].join('');
  const prefixo = o.prefixo ? `<w:r><w:rPr>${FONTE_RUN}</w:rPr><w:t xml:space="preserve">${escXml(o.prefixo)}\t</w:t></w:r>` : '';
  return `<w:p><w:pPr>${pPr}</w:pPr>${prefixo}${runs(n.content, { negrito: o.negrito, tamanho: o.tamanho })}</w:p>`;
}

function lista(n: NoEditor, nivel: number, ordenada: boolean): string {
  return (n.content ?? []).map((item, i) => {
    const marcador = ordenada ? `${i + 1 + (Number(n.attrs?.start) || 1) - 1}.` : '•';
    return (item.content ?? []).map((filho, j) => {
      if (filho.type === 'bulletList') return lista(filho, nivel + 1, false);
      if (filho.type === 'orderedList') return lista(filho, nivel + 1, true);
      return paragrafo(filho, { esquerda: RECUO_ESQ + nivel * 360, prefixo: j === 0 ? marcador : ' ' });
    }).join('');
  }).join('');
}

function tabela(n: NoEditor): string {
  const linhas = n.content ?? [];
  const colunas = Math.max(1, ...linhas.map((l) => (l.content ?? []).length));
  const largura = Math.floor(9000 / colunas);
  const borda = '<w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="808080"/>';
  const grade = Array.from({ length: colunas }, () => `<w:gridCol w:w="${largura}"/>`).join('');
  const corpo = linhas.map((l) => `<w:tr>${(l.content ?? []).map((c) => {
    const cab = c.type === 'tableHeader';
    const paras = (c.content ?? []).map((p) => (p.type === 'paragraph' || p.type === 'heading')
      ? paragrafo(p, { dentroTabela: true, negrito: cab }) : blocos([p], true)).join('') || '<w:p/>';
    const span = Number(c.attrs?.colspan) > 1 ? `<w:gridSpan w:val="${Number(c.attrs?.colspan)}"/>` : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${largura}" w:type="dxa"/>${span}${cab ? '<w:shd w:val="clear" w:color="auto" w:fill="EFEFEF"/>' : ''}</w:tcPr>${paras}</w:tc>`;
  }).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${largura * colunas}" w:type="dxa"/><w:tblInd w:w="${RECUO_ESQ}" w:type="dxa"/><w:tblBorders>${borda}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grade}</w:tblGrid>${corpo}</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
}

function blocos(nos: NoEditor[], dentroTabela = false): string {
  return nos.map((n) => {
    switch (n.type) {
      case 'paragraph': return paragrafo(n, { dentroTabela });
      case 'heading': {
        const nivel = Number(n.attrs?.level) || 2;
        return paragrafo(n, { negrito: true, tamanho: nivel === 1 ? 32 : nivel === 2 ? 28 : 24, dentroTabela });
      }
      case 'bulletList': return lista(n, 0, false);
      case 'orderedList': return lista(n, 0, true);
      case 'table': return tabela(n);
      case 'horizontalRule':
        return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="808080"/></w:pBdr><w:ind w:left="${RECUO_ESQ}" w:right="${RECUO_DIR}"/></w:pPr></w:p>`;
      case 'blockquote': return blocos(n.content ?? [], dentroTabela);
      default: return n.content ? blocos(n.content, dentroTabela) : '';
    }
  }).join('');
}

/** Corpo do documento Word (WordprocessingML) a partir do conteúdo do editor. */
export function editorParaWordXml(doc: NoEditor): string {
  return blocos(doc.content ?? []);
}

// Rodapé no pé da página (imagem do modelo, proporção original 769×142).
const PAGINA_EMU = { w: 7560310, h: 10692130 };
const RODAPE_EMU = { w: PAGINA_EMU.w, h: Math.round(PAGINA_EMU.w * 142 / 769) };

function rodapeXml(cabecalhoFtr: string): string {
  const desenho =
    '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:drawing>' +
    '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="1" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">' +
    '<wp:simplePos x="0" y="0"/>' +
    '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${PAGINA_EMU.h - RODAPE_EMU.h}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${RODAPE_EMU.w}" cy="${RODAPE_EMU.h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    '<wp:docPr id="9101" name="Rodape"/><wp:cNvGraphicFramePr/>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
    '<pic:nvPicPr><pic:cNvPr id="9101" name="rodape.jpg"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="rIdRodape"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${RODAPE_EMU.w}" cy="${RODAPE_EMU.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>';
  return `${cabecalhoFtr}${desenho}</w:ftr>`;
}

/**
 * Gera o .docx: modelo oficial (cabeçalho, fontes, página) + o texto do
 * editor no corpo + rodapé no pé de todas as páginas.
 */
export function gerarDocxDoEditor(doc: NoEditor, modeloBase: ArrayBuffer): Blob {
  const zip = new PizZip(modeloBase);
  const xml = zip.file('word/document.xml')?.asText();
  const ftr = zip.file('word/footer1.xml')?.asText();
  if (!xml || !ftr) throw new Error('Modelo do Word incompleto.');
  const ini = xml.indexOf('<w:body>') + '<w:body>'.length;
  const sect = xml.lastIndexOf('<w:sectPr');
  if (ini < 8 || sect < 0) throw new Error('Modelo do Word incompleto.');
  // Margem de baixo maior: o texto não passa por cima do rodapé.
  const sectPr = xml.slice(sect).replace(/<w:pgMar([^>]*?)w:bottom="[^"]*"/, '<w:pgMar$1w:bottom="2400"');
  const corpo = editorParaWordXml(doc) || '<w:p/>';
  zip.file('word/document.xml', xml.slice(0, ini) + corpo + sectPr);

  // Rodapé: imagem no pé da página (antes ficava presa a um parágrafo).
  const abreFtr = ftr.slice(0, ftr.indexOf('>', ftr.indexOf('<w:ftr')) + 1);
  zip.file('word/footer1.xml', rodapeXml(abreFtr));
  zip.file('word/_rels/footer1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdRodape" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpg"/></Relationships>');
  return zip.generate({ type: 'blob', mimeType: MIME_DOCX, compression: 'DEFLATE' });
}

// ─── Impressão / PDF ─────────────────────────────────────────────────────────

/** Cabeçalho do timbrado em SVG (mesmas formas e proporções do modelo). */
export function cabecalhoSvg(base = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7466965 792475" preserveAspectRatio="none" style="display:block;width:100%;height:auto;aspect-ratio:8.802/1">
<polygon fill="#D0D0D0" points="${[[3260597, 436878], [567053, 436878], [0, 0], [2693670, 0]].map(([x, y]) => `${4076063 + x},${172719 + y}`).join(' ')}"/>
<polygon fill="#FFCC29" points="0,38 7466963,38 7466963,287653 0,287653"/>
<polygon fill="#12AA04" points="${[[2820035, 609853], [0, 609853], [395731, 0], [2820035, 0]].map(([x, y]) => `${4646928 + x},${y}`).join(' ')}"/>
<image href="${base}${TIMBRADO.logo}" x="1142782" y="292099" width="2097835" height="499997" preserveAspectRatio="none"/>
<image href="${base}${TIMBRADO.icone}" x="3355338" y="284478" width="534034" height="505458" preserveAspectRatio="none"/>
</svg>`;
}

/** Estilos do texto do ofício (mesmos no editor e na impressão). */
export const CSS_TEXTO_OFICIO = `
.texto-oficio { font-family: ${FONTE_OFICIO}; font-size: 11pt; line-height: 1.5; color: #111; }
.texto-oficio p { margin: 0 0 6pt; min-height: 1.5em; }
.texto-oficio p[data-recuo="true"] { text-indent: 1.25cm; }
.texto-oficio h1 { font-size: 16pt; margin: 0 0 6pt; } .texto-oficio h2 { font-size: 14pt; margin: 0 0 6pt; } .texto-oficio h3 { font-size: 12pt; margin: 0 0 6pt; }
.texto-oficio ul, .texto-oficio ol { margin: 0 0 6pt; padding-left: 1.3cm; } .texto-oficio ul { list-style: disc; } .texto-oficio ol { list-style: decimal; }
.texto-oficio li p { margin: 0; }
.texto-oficio table { border-collapse: collapse; width: 100%; margin: 0 0 6pt; table-layout: fixed; }
.texto-oficio td, .texto-oficio th { border: 1px solid #808080; padding: 3pt 5pt; vertical-align: top; }
.texto-oficio th { background: #efefef; font-weight: bold; text-align: left; }
.texto-oficio td p, .texto-oficio th p { margin: 0; }
.texto-oficio hr { border: 0; border-top: 1px solid #808080; margin: 6pt 0; }
`;

/**
 * Página completa para imprimir / salvar em PDF: A4, timbrado no topo e
 * rodapé no pé de CADA página. `conteudo` é o HTML do editor (já
 * normalizado pelo editor — não aceita HTML livre).
 */
export function paginaImpressao(conteudo: string, titulo: string, base: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* Na impressão, cabeçalho e rodapé se repetem em todas as páginas. */
@media print {
  .cab { position: fixed; top: 0; left: 0; right: 0; }
  .rod { position: fixed; bottom: 0; left: 0; right: 0; }
}
.rod img { display: block; width: 100%; height: auto; }
table.folha { width: 100%; border-collapse: collapse; }
table.folha > thead > tr > td { height: 34mm; padding: 0; }
table.folha > tfoot > tr > td { height: 44mm; padding: 0; }
table.folha > tbody > tr > td { padding: 0 15mm 0 20mm; }
${CSS_TEXTO_OFICIO}
@media screen {
  body { max-width: 210mm; margin: 0 auto; box-shadow: 0 0 12px rgba(0,0,0,.2); }
  table.folha > thead > tr > td, table.folha > tfoot > tr > td { height: 8mm; }
}
</style></head><body>
<div class="cab">${cabecalhoSvg(base)}</div>
<table class="folha"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot>
<tbody><tr><td><div class="texto-oficio">${conteudo}</div></td></tr></tbody></table>
<div class="rod"><img src="${base}${TIMBRADO.rodape}" alt=""></div>
</body></html>`;
}
