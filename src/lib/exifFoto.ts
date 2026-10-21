// Lê, de uma foto JPEG, a localização (GPS) e a data/hora em que foi TIRADA,
// gravadas pelo celular dentro do arquivo (EXIF). Só leitura.
// Usado quando o operador escolhe uma foto da GALERIA: a localização certa é a
// de quando a foto foi tirada, não a de quando ele registrou no app.
// Observação: alguns celulares (e o seletor de fotos do Android recente)
// retiram a localização da foto ao compartilhar — aí não há o que ler.

export interface ExifFoto {
  latitude: number | null;
  longitude: number | null;
  /** Data/hora em que a foto foi tirada (horário do aparelho). */
  tiradaEm: Date | null;
}

export function lerExifDeBytes(b: Uint8Array): ExifFoto | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) return null;                // início da imagem: sem EXIF
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    if (m === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      return lerTiff(b.subarray(i + 10, i + 2 + len));        // depois de "Exif\0\0"
    }
    i += 2 + len;
  }
  return null;
}

function lerTiff(t: Uint8Array): ExifFoto | null {
  if (t.length < 8) return null;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  const u16 = (o: number) => (o + 2 > t.length ? 0 : le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const u32 = (o: number) => (o + 4 > t.length ? 0 : (le
    ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24))
    : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3])) >>> 0);
  const entradas = (ifd: number) => {
    const out = new Map<number, { tipo: number; n: number; pos: number }>();
    if (!ifd || ifd + 2 > t.length) return out;
    const qtd = u16(ifd);
    for (let k = 0; k < qtd; k++) {
      const e = ifd + 2 + k * 12;
      if (e + 12 > t.length) break;
      out.set(u16(e), { tipo: u16(e + 2), n: u32(e + 4), pos: e + 8 });
    }
    return out;
  };
  const tamTipo = (tipo: number) => ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[tipo] || 1;
  const posValor = (e: { tipo: number; n: number; pos: number }) => (tamTipo(e.tipo) * e.n <= 4 ? e.pos : u32(e.pos));
  const texto = (e?: { tipo: number; n: number; pos: number }) => {
    if (!e) return '';
    const p = posValor(e);
    let s = '';
    for (let k = 0; k < e.n && p + k < t.length; k++) { const c = t[p + k]; if (c === 0) break; s += String.fromCharCode(c); }
    return s.trim();
  };
  const graus = (e?: { tipo: number; n: number; pos: number }) => {
    if (!e || e.tipo !== 5 || e.n < 3) return null;
    const p = posValor(e);
    const r = (k: number) => { const den = u32(p + k * 8 + 4); return den ? u32(p + k * 8) / den : NaN; };
    const v = r(0) + r(1) / 60 + r(2) / 3600;
    return Number.isFinite(v) ? v : null;
  };

  const ifd0 = entradas(u32(4));
  let latitude: number | null = null, longitude: number | null = null, tiradaEm: Date | null = null;

  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const gps = entradas(u32(gpsPtr.pos));
    const lat = graus(gps.get(0x0002)), lng = graus(gps.get(0x0004));
    if (lat !== null && lng !== null && !(lat === 0 && lng === 0)) {
      latitude = texto(gps.get(0x0001)).toUpperCase().startsWith('S') ? -lat : lat;
      longitude = texto(gps.get(0x0003)).toUpperCase().startsWith('W') ? -lng : lng;
    }
  }
  const exifPtr = ifd0.get(0x8769);
  const dataTxt = (exifPtr && texto(entradas(u32(exifPtr.pos)).get(0x9003))) || texto(ifd0.get(0x0132));
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dataTxt);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);   // horário do aparelho
    if (!Number.isNaN(d.getTime()) && +m[1] > 2000) tiradaEm = d;
  }
  if (latitude === null && tiradaEm === null) return null;
  return { latitude, longitude, tiradaEm };
}

/** Lê o EXIF de um arquivo de imagem (nunca falha: sem dados → null). */
export async function lerExifFoto(arquivo: Blob): Promise<ExifFoto | null> {
  try {
    if (arquivo.type && !/jpe?g/i.test(arquivo.type)) return null;
    // O EXIF fica no começo do arquivo — basta ler os primeiros 256 KB.
    const buf = new Uint8Array(await arquivo.slice(0, 256 * 1024).arrayBuffer());
    return lerExifDeBytes(buf);
  } catch {
    return null;
  }
}
