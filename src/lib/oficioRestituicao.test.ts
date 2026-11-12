import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PizZip from 'pizzip';
import {
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
});
