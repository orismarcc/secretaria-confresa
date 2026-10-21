import { describe, it, expect } from 'vitest';
import { lerExifDeBytes } from './exifFoto';

// Monta um JPEG mínimo com EXIF: IFD0 → GPS IFD e Exif IFD (DateTimeOriginal).
function jpegComExif({ le = true, lat = [10, 39, 18.36], latRef = 'S', lng = [51, 34, 9.6], lngRef = 'W', data = '2026:10:14 09:12:30', comGps = true }: any = {}) {
  const out: number[] = [];
  const u16 = (v: number) => (le ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) => (le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const ent = (tag: number, tipo: number, n: number, valor: number[]) => [...u16(tag), ...u16(tipo), ...u32(n), ...valor];
  // layout fixo: header(8) | IFD0 @8 (2 entradas: 2+24+4=30) → 38 | GPS IFD @38 (4 entradas: 2+48+4=54) → 92 |
  // ExifIFD @92 (1 entrada: 2+12+4=18) → 110 | rationals lat @110 (24), lng @134 (24) | data @158 (20)
  const rac = (vals: number[]) => vals.flatMap((v) => [...u32(Math.round(v * 100)), ...u32(100)]);
  const tiff = [
    ...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8),
    ...u16(2), ...ent(0x8825, 4, 1, u32(comGps ? 38 : 0)), ...ent(0x8769, 4, 1, u32(92)), ...u32(0),
    ...u16(4),
    ...ent(0x0001, 2, 2, [latRef.charCodeAt(0), 0, 0, 0]), ...ent(0x0002, 5, 3, u32(110)),
    ...ent(0x0003, 2, 2, [lngRef.charCodeAt(0), 0, 0, 0]), ...ent(0x0004, 5, 3, u32(134)), ...u32(0),
    ...u16(1), ...ent(0x9003, 2, 20, u32(158)), ...u32(0),
    ...rac(lat), ...rac(lng), ...[...data].map((c: string) => c.charCodeAt(0)), 0,
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  out.push(0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xda, 0, 2, 0xff, 0xd9);
  return Uint8Array.from(out);
}

describe('EXIF da foto (galeria)', () => {
  it('lê localização e hora em que a foto foi tirada (little endian)', () => {
    const r = lerExifDeBytes(jpegComExif())!;
    expect(r.latitude!).toBeCloseTo(-(10 + 39 / 60 + 18.36 / 3600), 5);
    expect(r.longitude!).toBeCloseTo(-(51 + 34 / 60 + 9.6 / 3600), 5);
    expect(r.tiradaEm!.getFullYear()).toBe(2026);
    expect(r.tiradaEm!.getHours()).toBe(9);
    expect(r.tiradaEm!.getMinutes()).toBe(12);
  });

  it('big endian também', () => {
    const r = lerExifDeBytes(jpegComExif({ le: false }))!;
    expect(r.latitude!).toBeCloseTo(-10.6551, 3);
    expect(r.longitude!).toBeCloseTo(-51.5693, 3);
  });

  it('foto sem localização (ex.: removida ao compartilhar) devolve só a hora', () => {
    const r = lerExifDeBytes(jpegComExif({ comGps: false }))!;
    expect(r.latitude).toBeNull();
    expect(r.tiradaEm).not.toBeNull();
  });

  it('arquivo que não é JPEG ou sem EXIF devolve null', () => {
    expect(lerExifDeBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(lerExifDeBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9]))).toBeNull();
  });
});
