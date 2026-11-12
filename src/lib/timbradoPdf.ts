/**
 * timbradoPdf.ts — timbrado da Prefeitura nos PDFs gerados a partir dos
 * modelos .docx (comunicado de DAM, ofício de restituição).
 *
 * O cabeçalho do modelo é um GRUPO de formas (faixa amarela, faixas cinza e
 * verde à direita, brasão e ícone). Ele é redesenhado nas posições e
 * proporções reais — em vez de esticar a imagem do brasão na largura da
 * página. O rodapé usa a imagem do modelo na proporção original (sem achatar).
 */
import type PizZip from 'pizzip';
import type jsPDF from 'jspdf';

function u8ToBase64(u8: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

// Geometria do cabeçalho no modelo (EMU), tirada de word/header1.xml.
const EMU = 12700; // EMU por ponto
const GRUPO = { x0: -38084, w: 7629525, h: 866770, chW: 7466965, chH: 792475 };

export interface Timbrado {
  /** Desenha cabeçalho e rodapé na página atual. */
  desenhar: () => void;
  /** Altura do cabeçalho (pt), a partir do topo da página. */
  headerH: number;
  /** Altura do rodapé (pt), a partir da base da página. */
  footerH: number;
}

export function criarTimbrado(doc: jsPDF, zip: PizZip): Timbrado {
  const png = (n: string) => { const f = zip.file(n); return f ? 'data:image/png;base64,' + u8ToBase64(f.asUint8Array()) : null; };
  const logo = png('word/media/image4.png');
  const icone = png('word/media/image3.png');
  const rodapeArq = zip.file('word/media/image1.jpg');
  const rodape = rodapeArq ? 'data:image/jpeg;base64,' + u8ToBase64(rodapeArq.asUint8Array()) : null;

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const hW = GRUPO.w / EMU, hH = GRUPO.h / EMU;
  const sx = hW / GRUPO.chW, sy = hH / GRUPO.chH;
  const gx = (v: number) => GRUPO.x0 / EMU + v * sx;
  const gy = (v: number) => v * sy;
  const footerH = W * (142 / 769); // proporção da imagem do rodapé (769×142 px)

  const poligono = (cor: [number, number, number], ox: number, oy: number, pts: [number, number][]) => {
    doc.setFillColor(...cor);
    const abs = pts.map(([px, py]) => [gx(ox + px), gy(oy + py)] as [number, number]);
    const deltas = abs.slice(1).map(([px, py], i) => [px - abs[i][0], py - abs[i][1]]);
    doc.lines(deltas, abs[0][0], abs[0][1], [1, 1], 'F', true);
  };

  const desenhar = () => {
    poligono([0xD0, 0xD0, 0xD0], 4076063, 172719, [[3260597, 436878], [567053, 436878], [0, 0], [2693670, 0]]);
    poligono([0xFF, 0xCC, 0x29], 0, 38, [[7466963, 287615], [0, 287615], [0, 0], [7466963, 0]]);
    poligono([0x12, 0xAA, 0x04], 4646928, 0, [[2820035, 609853], [0, 609853], [395731, 0], [2820035, 0]]);
    if (logo) { try { doc.addImage(logo, 'PNG', gx(1142782), gy(292099), 2097835 * sx, 499997 * sy, undefined, 'FAST'); } catch { /* ignora */ } }
    if (icone) { try { doc.addImage(icone, 'PNG', gx(3355338), gy(284478), 534034 * sx, 505458 * sy, undefined, 'FAST'); } catch { /* ignora */ } }
    if (rodape) { try { doc.addImage(rodape, 'JPEG', 0, H - footerH, W, footerH, undefined, 'FAST'); } catch { /* ignora */ } }
  };

  return { desenhar, headerH: hH, footerH };
}

/** Escreve uma linha justificada (espaço que sobra distribuído entre as palavras). */
export function linhaJustificada(doc: jsPDF, ln: string, x: number, y: number, largura: number): void {
  const palavras = ln.trim().split(/\s+/);
  if (palavras.length < 2) { doc.text(ln, x, y); return; }
  const total = palavras.reduce((t, w) => t + doc.getTextWidth(w), 0);
  const espaco = (largura - total) / (palavras.length - 1);
  let cx = x;
  palavras.forEach((w) => { doc.text(w, cx, y); cx += doc.getTextWidth(w) + espaco; });
}
