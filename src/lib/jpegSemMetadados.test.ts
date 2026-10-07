import { describe, it, expect } from 'vitest';
import { removerMetadadosJpeg, lerOrientacaoExif, exifSoOrientacao, otimizarComprovanteDam } from './jpegSemMetadados';

// JPEG real 16x12 (gerado por navegador): SOI, APP0 (JFIF), APP2 (ICC), tabelas, imagem, EOI.
const BASE = Uint8Array.from(atob(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAMABADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAQMFBv/EACEQAAEDAwQDAAAAAAAAAAAAAAIAEhMBERYDBxQVISJh/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAdEQABBAIDAAAAAAAAAAAAAAABAAIFBgMRIWGx/9oADAMBAAIRAxEAPwCft4O1PS62c5j2/IKLHuJBA0Wul9nufe3izfqwIigNE0RoravRjOEpb5rK0vOyd9+L/9k=',
), (c) => c.charCodeAt(0));

const seg = (marker: number, conteudo: number[]) => {
  const len = conteudo.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...conteudo];
};
const txt = (s: string) => s.split('').map((c) => c.charCodeAt(0));

/** EXIF "de celular": orientação + um campo grande (simula marca, GPS, miniatura). */
function exifCelular(orientacao: number, le = true, lixo = 3000) {
  const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (le ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8),
    ...u16(2),
    ...u16(0x010f), ...u16(2), ...u32(4), ...txt('ABC\0'),     // Make (ASCII, inline)
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientacao), 0, 0,
    ...u32(0), ...new Array(lixo).fill(0x55)];
  return seg(0xe1, [...txt('Exif\0\0'), ...tiff]);
}

/** Insere segmentos depois do APP0 e (opcionalmente) dados após o fim da imagem. */
function comMetadados(extras: number[][], depoisDoFim: number[] = []) {
  const app0Fim = 2 + 2 + ((BASE[4] << 8) | BASE[5]);
  return Uint8Array.from([...BASE.subarray(0, app0Fim), ...extras.flat(), ...BASE.subarray(app0Fim), ...depoisDoFim]);
}

const imagem = (b: Uint8Array) => {   // do SOS até o EOI
  for (let i = 2; i < b.length - 1; i++) if (b[i] === 0xff && b[i + 1] === 0xda) {
    for (let k = i; k < b.length - 1; k++) if (b[k] === 0xff && b[k + 1] === 0xd9) return b.subarray(i, k + 2);
  }
  return null;
};
const temSeg = (b: Uint8Array, marker: number, prefixo?: string) => {
  let i = 2;
  while (i < b.length && !(b[i] === 0xff && b[i + 1] === 0xda)) {
    const m = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3];
    if (m === marker && (!prefixo || txt(prefixo).every((c, k) => b[i + 4 + k] === c))) return true;
    i += 2 + len;
  }
  return false;
};

describe('JPEG sem metadados (sem perda)', () => {
  it('retira EXIF, XMP, comentário, APP de fabricante, MPF e anexos; mantém JFIF, ICC e a imagem byte a byte', () => {
    const entrada = comMetadados([
      exifCelular(1),
      seg(0xe1, [...txt('http://ns.adobe.com/xap/1.0/\0'), ...new Array(500).fill(0x41)]), // XMP
      seg(0xfe, txt('comentario qualquer')),                                               // COM
      seg(0xed, new Array(400).fill(0x42)),                                                // APP13
      seg(0xe2, [...txt('MPF\0'), ...new Array(50).fill(0)]),                              // MPF
    ], [0xff, 0xd8, ...new Array(2000).fill(0x99), 0xff, 0xd9]);                           // imagem anexada
    const out = removerMetadadosJpeg(entrada)!;
    expect(out).not.toBeNull();
    expect(out.length).toBeLessThan(BASE.length + 40);
    expect(out.length).toBeLessThan(entrada.length - 6000);
    expect(temSeg(out, 0xe0, 'JFIF')).toBe(true);
    expect(temSeg(out, 0xe2, 'ICC_PROFILE')).toBe(true);
    expect(temSeg(out, 0xe1)).toBe(false);          // orientação 1 = nada a guardar
    expect(temSeg(out, 0xfe)).toBe(false);
    expect(temSeg(out, 0xed)).toBe(false);
    expect(temSeg(out, 0xe2, 'MPF')).toBe(false);
    expect(Array.from(imagem(out)!)).toEqual(Array.from(imagem(BASE)!));
    expect(out[out.length - 2]).toBe(0xff); expect(out[out.length - 1]).toBe(0xd9);
  });

  it('JPEG já limpo sai igual ao original', () => {
    expect(Array.from(removerMetadadosJpeg(BASE)!)).toEqual(Array.from(BASE));
  });

  it('mantém a rotação (EXIF mínimo só com a orientação), little e big endian', () => {
    for (const le of [true, false]) {
      const out = removerMetadadosJpeg(comMetadados([exifCelular(6, le)]))!;
      let i = 2; let orient: number | null = null;
      while (!(out[i] === 0xff && out[i + 1] === 0xda)) {
        const len = (out[i + 2] << 8) | out[i + 3];
        if (out[i + 1] === 0xe1) orient = lerOrientacaoExif(out.subarray(i + 4, i + 2 + len));
        i += 2 + len;
      }
      expect(orient).toBe(6);
      expect(out.length).toBeLessThan(BASE.length + 40);
    }
  });

  it('EXIF mínimo é lido corretamente', () => {
    for (let o = 1; o <= 8; o++) expect(lerOrientacaoExif(exifSoOrientacao(o).subarray(4))).toBe(o);
  });

  it('arquivo que não é JPEG (ou JPEG quebrado) não é tratado', () => {
    expect(removerMetadadosJpeg(txt('%PDF-1.4 qualquer') as unknown as Uint8Array)).toBeNull();
    expect(removerMetadadosJpeg(Uint8Array.from(txt('%PDF-1.4')))).toBeNull();
    expect(removerMetadadosJpeg(BASE.subarray(0, 300))).toBeNull();      // cortado antes da imagem
    const semFim = BASE.subarray(0, BASE.length - 2);
    expect(removerMetadadosJpeg(semFim)).toBeNull();                       // sem EOI
  });

  it('PDF e PNG passam intactos (mesmo objeto)', async () => {
    const pdf = new File([Uint8Array.from(txt('%PDF-1.4 teste'))], 'comprovante.pdf', { type: 'application/pdf' });
    const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'c.png', { type: 'image/png' });
    expect(await otimizarComprovanteDam(pdf)).toBe(pdf);
    expect(await otimizarComprovanteDam(png)).toBe(png);
  });

  it('sem como conferir os pixels (ambiente sem decodificador), envia o ORIGINAL', async () => {
    const jpg = new File([comMetadados([exifCelular(1)])], 'foto.jpg', { type: 'image/jpeg' });
    expect(await otimizarComprovanteDam(jpg)).toBe(jpg);
  });
});
