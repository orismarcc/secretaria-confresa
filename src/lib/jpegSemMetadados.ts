// Compressão SEM PERDA de JPEG: retira só metadados inúteis, sem tocar nos
// pixels (os dados da imagem são copiados byte a byte).
//
// Retira: EXIF/XMP (dados da câmera, GPS, miniatura embutida), comentários,
// blocos APP de fabricantes, imagens extras anexadas (MPF, "motion photo").
// Mantém: JFIF (APP0), perfil de cor ICC (APP2 ICC_PROFILE), Adobe (APP14 —
// define a conversão de cores), tabelas, quadros e todos os dados da imagem.
// Rotação: se a foto tinha orientação EXIF (≠ 1), grava um EXIF mínimo só
// com ela — a foto continua aparecendo na mesma posição.
//
// Uso: comprovantes de DAM (ver otimizarComprovanteDam).

const SOI = 0xd8, EOI = 0xd9, SOS = 0xda;
const APP0 = 0xe0, APP1 = 0xe1, APP2 = 0xe2, APP14 = 0xee, COM = 0xfe;

const ascii = (b: Uint8Array, i: number, s: string) =>
  s.split('').every((c, k) => b[i + k] === c.charCodeAt(0));

/** Orientação EXIF (1–8) de um segmento APP1 "Exif", ou null. */
export function lerOrientacaoExif(seg: Uint8Array): number | null {
  // seg = conteúdo do APP1 sem o marcador/tamanho: "Exif\0\0" + TIFF
  if (seg.length < 14 || !ascii(seg, 0, 'Exif\0\0')) return null;
  const t = 6;
  const le = seg[t] === 0x49 && seg[t + 1] === 0x49; // "II" = little endian
  const be = seg[t] === 0x4d && seg[t + 1] === 0x4d; // "MM" = big endian
  if (!le && !be) return null;
  const u16 = (o: number) => (le ? seg[t + o] | (seg[t + o + 1] << 8) : (seg[t + o] << 8) | seg[t + o + 1]);
  const u32 = (o: number) => (le
    ? (seg[t + o] | (seg[t + o + 1] << 8) | (seg[t + o + 2] << 16) | (seg[t + o + 3] << 24)) >>> 0
    : ((seg[t + o] << 24) | (seg[t + o + 1] << 16) | (seg[t + o + 2] << 8) | seg[t + o + 3]) >>> 0);
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  if (t + ifd + 2 > seg.length) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (t + e + 12 > seg.length) return null;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** Segmento APP1 completo (com marcador e tamanho) contendo só a orientação. */
export function exifSoOrientacao(orientacao: number): Uint8Array {
  const corpo = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,                   // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,       // TIFF big endian, IFD0 em 8
    0x00, 0x01,                                           // 1 entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,       // Orientation, SHORT, 1
    0x00, orientacao & 0xff, 0x00, 0x00,                  // valor
    0x00, 0x00, 0x00, 0x00,                               // sem próximo IFD
  ];
  const len = corpo.length + 2;
  return Uint8Array.from([0xff, APP1, len >> 8, len & 0xff, ...corpo]);
}

/**
 * Remove metadados de um JPEG sem alterar os dados da imagem. Devolve os
 * novos bytes, ou null se o arquivo não for um JPEG que dê para tratar com
 * segurança (aí o original deve ser usado).
 */
export function removerMetadadosJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  const partes: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientacao: number | null = null;
  let posExif = -1; // onde inserir o EXIF mínimo (logo após o APP0)
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;               // estrutura inesperada
    let m = bytes[i + 1];
    while (m === 0xff) { i++; m = bytes[i + 1]; }      // bytes de preenchimento
    if (m === undefined) return null;
    if (m === SOS) break;                              // início dos dados da imagem
    if (m === EOI || (m >= 0xd0 && m <= 0xd7) || m === 0x01) return null; // fim antes da imagem
    if (i + 4 > bytes.length) return null;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return null;
    const seg = bytes.subarray(i, i + 2 + len);
    const conteudo = bytes.subarray(i + 4, i + 2 + len);
    const ehApp = m >= 0xe0 && m <= 0xef;
    let manter = !ehApp && m !== COM;
    if (m === APP0) manter = true;
    if (m === APP2 && ascii(conteudo, 0, 'ICC_PROFILE\0')) manter = true;
    if (m === APP14 && ascii(conteudo, 0, 'Adobe')) manter = true;
    if (m === APP1 && orientacao === null) {
      const o = lerOrientacaoExif(conteudo);
      if (o !== null) orientacao = o;
    }
    if (manter) {
      partes.push(seg);
      if (m === APP0) posExif = partes.length;
    }
    i += 2 + len;
  }
  if (i >= bytes.length) return null;                  // não achou os dados da imagem

  // Dados da imagem: do primeiro SOS até o EOI (inclusive). Dentro dos dados
  // codificados, 0xFF vem sempre seguido de 0x00 ou RSTn; o primeiro FFD9 é o
  // fim da imagem principal. O que vem depois (imagens anexadas) é retirado.
  let fim = -1;
  for (let k = i; k < bytes.length - 1; k++) {
    if (bytes[k] === 0xff && bytes[k + 1] === EOI) { fim = k + 2; break; }
  }
  if (fim < 0) return null;
  if (orientacao !== null && orientacao !== 1) {
    partes.splice(posExif > 0 ? posExif : 1, 0, exifSoOrientacao(orientacao));
  }
  partes.push(bytes.subarray(i, fim));

  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

const ehJpeg = (f: File) => f.type === 'image/jpeg' || f.type === 'image/jpg'
  || (!f.type && /\.jpe?g$/i.test(f.name));

/** Decodifica e devolve os pixels (respeitando a orientação), ou null. */
async function pixels(blob: Blob): Promise<{ w: number; h: number; d: Uint8ClampedArray } | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bmp = await createImageBitmap(blob);
  try {
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
  } finally {
    bmp.close();
  }
}

/**
 * Comprovante de DAM antes do envio: JPEG → sem metadados (sem perda).
 * Qualquer outro tipo (PDF, PNG, WEBP) volta intacto. Só troca o arquivo se:
 * o resultado for menor E a imagem decodificada for IDÊNTICA à original,
 * pixel a pixel. Em qualquer falha, devolve o original — nunca impede o envio.
 */
export async function otimizarComprovanteDam(file: File): Promise<File> {
  try {
    if (!ehJpeg(file)) return file;
    const original = new Uint8Array(await file.arrayBuffer());
    const novo = removerMetadadosJpeg(original);
    if (!novo || novo.length >= original.length) return file;

    const blobNovo = new Blob([novo], { type: 'image/jpeg' });
    const [a, b] = await Promise.all([pixels(file), pixels(blobNovo)]);
    if (!a || !b || a.w !== b.w || a.h !== b.h || a.d.length !== b.d.length) return file;
    for (let k = 0; k < a.d.length; k++) if (a.d[k] !== b.d[k]) return file;

    return new File([novo], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
