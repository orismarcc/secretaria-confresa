import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PizZip from 'pizzip';
import { PDFDocument } from 'pdf-lib';
import {
  buildOficioRestituicaoPdf,
  tipoDoArquivo,
  dimensoesImagem,
  comprovanteEhPdf,
  buildOficioRestituicaoDocx,
  descricaoServicoOficio,
  justificativaRestituicao,
  numeroOficioCompleto,
  dataOficio,
  type OficioRestituicaoData,
} from './oficioRestituicao';

const modelo = readFileSync(resolve(__dirname, '../../public/templates/oficio-restituicao.docx'));

const base: OficioRestituicaoData = {
  numero: '12/2026',
  data: new Date(2026, 10, 6),
  servico: descricaoServicoOficio('PC', 'patrulha_mecanizada'),
  motivo: 'climatica',
  nome: 'Produtor de Teste',
  cpf: '000.000.000-00',
  comunidade: 'PA Teste - Gleba Teste',
  telefone: '(66) 99999-9999',
  banco: 'Banco Teste',
  agencia: '0001',
  conta: '12345-6',
  pix: '',
  valor: 1211.15,
};

const lerBlob = (blob: Blob) => new Promise<ArrayBuffer>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(r.result as ArrayBuffer);
  r.onerror = () => erro(r.error);
  r.readAsArrayBuffer(blob);
});
const modeloZip = new PizZip(modelo);
const png = new Uint8Array(modeloZip.file('word/media/image4.png')!.asUint8Array()); // 342×82
const jpg = new Uint8Array(modeloZip.file('word/media/image1.jpg')!.asUint8Array()); // 769×142

async function textoDoDocx(d: OficioRestituicaoData): Promise<string> {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => modelo.buffer.slice(modelo.byteOffset, modelo.byteOffset + modelo.byteLength) })));
  const { blob } = await buildOficioRestituicaoDocx(d);
  const buf = await new Promise<ArrayBuffer>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as ArrayBuffer);
    r.onerror = () => erro(r.error);
    r.readAsArrayBuffer(blob);
  });
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml')!.asText();
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('|');
}

afterEach(() => vi.unstubAllGlobals());

describe('ofício de restituição da DAM', () => {
  it('descreve o serviço conforme o tipo', () => {
    expect(descricaoServicoOficio('PC')).toBe('escavação com Patrulha Mecanizada (PC)');
    expect(descricaoServicoOficio('Grade', 'patrulha_mecanizada')).toBe('gradagem com Patrulha Mecanizada (Grade)');
    expect(descricaoServicoOficio('Pá Carregadeira', 'patrulha_mecanizada')).toBe('Patrulha Mecanizada (Pá Carregadeira)');
  });

  it('justificativa segue a opção escolhida e o serviço', () => {
    expect(justificativaRestituicao('climatica', 'escavação com Patrulha Mecanizada (PC)')).toContain('condições climáticas atuais');
    expect(justificativaRestituicao('climatica', 'escavação com Patrulha Mecanizada (PC)')).toContain('destinada à escavação');
    expect(justificativaRestituicao('area_inadequada', 'gradagem com Patrulha Mecanizada (Grade)')).toBe(
      'A restituição justifica-se pela impossibilidade de execução do serviço, uma vez que a área destinada ao serviço não apresenta condições adequadas para a realização dos trabalhos no momento.',
    );
  });

  it('número e data no padrão do modelo', () => {
    expect(numeroOficioCompleto('473', new Date(2026, 0, 1))).toBe('473/2026');
    expect(numeroOficioCompleto('473/2026')).toBe('473/2026');
    expect(dataOficio(new Date(2026, 10, 6))).toBe('06 de novembro de 2026');
  });

  it('preenche o modelo .docx sem deixar campos e sem a linha do PIX quando não há chave', async () => {
    const t = await textoDoDocx(base);
    expect(t).toContain('OFÍCIO Nº 12/2026 – SMA');
    expect(t).toContain('SERVIÇO DE ESCAVAÇÃO COM PATRULHA MECANIZADA (PC)');
    expect(t).toContain('Nome completo: PRODUTOR DE TESTE');
    expect(t).toContain('Banco: BANCO TESTE');
    expect(t).toContain('Valor: R$ 1.211,15');
    expect(t).toContain('condições climáticas atuais');
    expect(t).not.toContain('Chave PIX');
    expect(t).not.toMatch(/[{}]/);
  });

  it('com chave PIX a linha aparece; motivo "área" troca o parágrafo', async () => {
    const t = await textoDoDocx({ ...base, pix: 'chave-teste', motivo: 'area_inadequada' });
    expect(t).toContain('Chave PIX: |chave-teste');
    expect(t).toContain('não apresenta condições adequadas');
    expect(t).not.toContain('condições climáticas atuais');
  });

  it('identifica o comprovante pelos bytes e lê o tamanho da imagem', () => {
    expect(tipoDoArquivo(png)).toBe('png');
    expect(tipoDoArquivo(jpg)).toBe('jpeg');
    expect(tipoDoArquivo(new TextEncoder().encode('%PDF-1.4 xxxxxxxx'))).toBe('pdf');
    expect(tipoDoArquivo(new TextEncoder().encode('qualquer coisa'))).toBeNull();
    expect(dimensoesImagem(png, 'png')).toEqual({ w: 342, h: 82 });
    expect(dimensoesImagem(jpg, 'jpeg')).toEqual({ w: 769, h: 142 });
    expect(comprovanteEhPdf('https://x.supabase.co/a/b/123.pdf?token=1')).toBe(true);
    expect(comprovanteEhPdf('https://x.supabase.co/a/b/123.jpg?token=1')).toBe(false);
  });

  it('DOC: comprovante em imagem entra numa página logo após o ofício', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => modelo.buffer.slice(modelo.byteOffset, modelo.byteOffset + modelo.byteLength) })));
    const r = await buildOficioRestituicaoDocx(base, { bytes: jpg, tipo: 'jpeg' });
    expect(r.comprovanteIncluido).toBe(true);
    const zip = new PizZip(await lerBlob(r.blob));
    expect(zip.file('word/media/comprovante-dam.jpg')).toBeTruthy();
    expect(zip.file('word/_rels/document.xml.rels')!.asText()).toContain('media/comprovante-dam.jpg');
    const xml = zip.file('word/document.xml')!.asText();
    const ofim = xml.indexOf('CASSIO RODRIGUES DA COSTA');
    const comp = xml.indexOf('COMPROVANTE DE PAGAMENTO DA DAM');
    expect(comp).toBeGreaterThan(ofim);           // depois da assinatura
    expect(comp).toBeLessThan(xml.lastIndexOf('<w:sectPr'));
    // comprovante PDF não entra no DOC
    const r2 = await buildOficioRestituicaoDocx(base, { bytes: new TextEncoder().encode('%PDF-1.4 x'), tipo: 'pdf' });
    expect(r2.comprovanteIncluido).toBe(false);
  });

  it('PDF: comprovante em PDF tem as páginas juntadas após o ofício', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => modelo.buffer.slice(modelo.byteOffset, modelo.byteOffset + modelo.byteLength) })));
    const anexo = await PDFDocument.create();
    anexo.addPage(); anexo.addPage();
    const so = await buildOficioRestituicaoPdf(base);
    const nOficio = (await PDFDocument.load(await lerBlob(so.blob))).getPageCount();
    const r = await buildOficioRestituicaoPdf(base, { bytes: await anexo.save(), tipo: 'pdf' });
    expect(r.comprovanteIncluido).toBe(true);
    expect((await PDFDocument.load(await lerBlob(r.blob))).getPageCount()).toBe(nOficio + 2);
    const ri = await buildOficioRestituicaoPdf(base, { bytes: png, tipo: 'png' });
    expect(ri.comprovanteIncluido).toBe(true);
    expect((await PDFDocument.load(await lerBlob(ri.blob))).getPageCount()).toBe(nOficio + 1);
  }, 20000);
});
