// Termo de compromisso de entrega — MODELO PADRÃO (base: "TERMO DE COMPROMISSO
// DE ENTREGA E USO DE MUDAS DE AÇAÍ"). Só o OBJETO (definido no lote), a
// quantidade e os dados do produtor mudam; o restante é o texto do modelo.
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DadosTermo {
  /** Objeto do termo, como cadastrado no lote (ex.: "mudas de açaí"). */
  objeto: string;
  quantidade: number;
  /** Unidade do lote (ex.: "unidade", "kg"). */
  unidade?: string | null;
  produtor: string;
  cpf?: string | null;
  data?: Date;
}

const fmtQtd = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** "50 mudas de açaí" (unidade) ou "20 kg de sementes de milho". */
export function quantidadeComObjeto(qtd: number, objeto: string, unidade?: string | null): string {
  const u = (unidade || '').trim().toLowerCase();
  const obj = objeto.trim();
  return !u || u === 'unidade' || u === 'unidades' ? `${fmtQtd(qtd)} ${obj}` : `${fmtQtd(qtd)} ${u} de ${obj}`;
}

function fmtCpf(cpf?: string | null): string {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return cpf?.trim() || '______________________________';
}

type Bloco = { t: 'titulo' | 'clausula' | 'p' | 'item'; texto: string };

/** Texto do termo (blocos), já com objeto, quantidade e produtor. */
export function textoTermo(d: DadosTermo): { blocos: Bloco[]; data: string; produtor: string; cpf: string } {
  const objeto = d.objeto.trim();
  return {
    blocos: [
      { t: 'titulo', texto: `TERMO DE COMPROMISSO DE ENTREGA E USO DE ${objeto.toUpperCase()}` },
      { t: 'p', texto: 'Pelo presente instrumento, de um lado o MUNICÍPIO DE CONFRESA, pessoa jurídica de direito público interno, inscrito no CNPJ nº 37.464.716/0001-50, com sede administrativa na cidade de Confresa/MT, por meio da SECRETARIA MUNICIPAL DE AGRICULTURA, doravante denominada CEDENTE, representada pelo Secretário de Agricultura do município e, de outro lado, o(a) produtor(a) rural abaixo identificado(a), doravante denominado(a) BENEFICIÁRIO(A), resolvem firmar o presente TERMO DE COMPROMISSO, que se regerá pelas cláusulas e condições seguintes:' },
      { t: 'clausula', texto: 'CLÁUSULA PRIMEIRA – DO OBJETO' },
      { t: 'p', texto: `O presente Termo tem por objeto a entrega gratuita de ${objeto} ao BENEFICIÁRIO(A), destinada ao fomento da produção agrícola, fortalecimento da agricultura familiar e incentivo ao desenvolvimento rural sustentável no Município de Confresa/MT.` },
      { t: 'clausula', texto: 'CLÁUSULA SEGUNDA – DA QUANTIDADE E ESPECIFICAÇÃO DAS MUDAS' },
      { t: 'p', texto: `Serão entregues ao BENEFICIÁRIO(A) ${quantidadeComObjeto(d.quantidade, objeto, d.unidade)}, em condições adequadas para o plantio, conforme disponibilidade da Secretaria Municipal de Agricultura.` },
      { t: 'clausula', texto: 'CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO BENEFICIÁRIO' },
      { t: 'p', texto: 'O BENEFICIÁRIO(A) compromete-se a:' },
      { t: 'item', texto: 'I – Utilizar efetivamente as mudas recebidas, destinando-as exclusivamente ao plantio em sua propriedade rural, sendo vedada a venda, doação ou repasse a terceiros;' },
      { t: 'item', texto: 'II – Providenciar local adequado para o recebimento, armazenamento temporário e plantio das mudas, observando condições mínimas de solo, espaçamento e manejo;' },
      { t: 'item', texto: 'III – Realizar o plantio em prazo razoável, compatível com a natureza das mudas, de modo a garantir sua sobrevivência e desenvolvimento;' },
      { t: 'item', texto: 'IV – Responsabilizar-se pelos cuidados necessários após o plantio, incluindo irrigação, manejo e tratos culturais adequados;' },
      { t: 'item', texto: 'V – Permitir, quando solicitado, a vistoria técnica da Secretaria Municipal de Agricultura para acompanhamento e verificação do cumprimento deste Termo.' },
      { t: 'clausula', texto: 'CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA SECRETARIA MUNICIPAL DE AGRICULTURA' },
      { t: 'p', texto: 'Compete à Secretaria Municipal de Agricultura:' },
      { t: 'item', texto: 'I – Realizar a entrega das mudas ao BENEFICIÁRIO(A), conforme disponibilidade e cronograma definido;' },
      { t: 'item', texto: 'II – Orientar tecnicamente, quando possível, quanto ao manejo e plantio das mudas;' },
      { t: 'item', texto: 'III – Acompanhar e fiscalizar a correta destinação das mudas, quando necessário.' },
      { t: 'clausula', texto: 'CLÁUSULA QUINTA – DAS VEDAÇÕES' },
      { t: 'p', texto: 'É expressamente proibido ao BENEFICIÁRIO(A):' },
      { t: 'item', texto: 'I – Comercializar ou transferir as mudas recebidas;' },
      { t: 'item', texto: 'II – Utilizar as mudas para finalidade diversa da prevista neste Termo;' },
      { t: 'item', texto: 'III – Deixar de realizar o plantio sem justificativa técnica ou força maior.' },
      { t: 'clausula', texto: 'CLÁUSULA SEXTA – DAS PENALIDADES' },
      { t: 'p', texto: 'O descumprimento das obrigações assumidas neste Termo poderá implicar:' },
      { t: 'item', texto: 'I – Impedimento de participação do BENEFICIÁRIO(A) em futuros programas e ações de fomento promovidos pelo Município;' },
      { t: 'item', texto: 'II – Adoção de outras medidas administrativas cabíveis, conforme a legislação vigente.' },
      { t: 'clausula', texto: 'CLÁUSULA SÉTIMA – DA VIGÊNCIA' },
      { t: 'p', texto: 'O presente Termo entra em vigor na data de sua assinatura, permanecendo válido até a verificação do cumprimento das obrigações aqui assumidas.' },
      { t: 'clausula', texto: 'CLÁUSULA OITAVA – DO FORO' },
      { t: 'p', texto: 'Fica eleito o foro da Comarca de Confresa/MT para dirimir quaisquer dúvidas ou controvérsias oriundas deste Termo, renunciando as partes a qualquer outro, por mais privilegiado que seja.' },
      { t: 'p', texto: 'E, por estarem de pleno acordo, firmam o presente Termo em duas vias de igual teor e forma.' },
    ],
    data: `Confresa/MT, ${format(d.data ?? new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`,
    produtor: d.produtor.trim().toUpperCase(),
    cpf: fmtCpf(d.cpf),
  };
}

/** Monta o PDF (um termo; várias páginas se preciso). */
export function montarTermoPdf(d: DadosTermo): jsPDF {
  const { blocos, data, produtor, cpf } = textoTermo(d);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 62;               // margem lateral
  const larg = W - 2 * M;
  let y = 64;
  const quebra = (h: number) => { if (y + h > H - 56) { doc.addPage(); y = 64; } };

  const paragrafo = (texto: string, opts: { bold?: boolean; center?: boolean; indent?: number; size?: number; gap?: number } = {}) => {
    const size = opts.size ?? 11;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const ind = opts.indent ?? 0;
    const linhas: string[] = doc.splitTextToSize(texto, larg - ind);
    const alt = size * 1.35;
    linhas.forEach((ln, i) => {
      quebra(alt);
      const palavras = ln.trim().split(/\s+/);
      if (opts.center) doc.text(ln, W / 2, y, { align: 'center' });
      else if (i < linhas.length - 1 && palavras.length > 1) {
        // Justificado (como no modelo): distribui o espaço entre as palavras;
        // a última linha do parágrafo fica alinhada à esquerda.
        const larguras = palavras.map((p) => doc.getTextWidth(p));
        const espaco = (larg - ind - larguras.reduce((s, w) => s + w, 0)) / (palavras.length - 1);
        let x = M + ind;
        palavras.forEach((p, k) => { doc.text(p, x, y); x += larguras[k] + espaco; });
      } else doc.text(ln, M + ind, y);
      y += alt;
    });
    y += opts.gap ?? 8;
  };

  for (const b of blocos) {
    if (b.t === 'titulo') paragrafo(b.texto, { bold: true, center: true, size: 12.5, gap: 16 });
    else if (b.t === 'clausula') { y += 4; paragrafo(b.texto, { bold: true, gap: 6 }); }
    else if (b.t === 'item') paragrafo(b.texto, { indent: 0, gap: 6 });
    else paragrafo(b.texto);
  }

  // Data e assinaturas (mantidas juntas na mesma página)
  quebra(230);
  y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(data, W - M, y, { align: 'right' });
  y += 60;
  const assinatura = (linhas: { t: string; bold?: boolean }[]) => {
    doc.setLineWidth(0.6);
    doc.line(W / 2 - 150, y, W / 2 + 150, y);
    y += 15;
    for (const l of linhas) {
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal'); doc.setFontSize(10.5);
      doc.text(l.t, W / 2, y, { align: 'center' });
      y += 14;
    }
    y += 40;
  };
  assinatura([{ t: produtor, bold: true }, { t: 'BENEFICIÁRIO(A)' }, { t: `CPF ${cpf}` }]);
  assinatura([{ t: 'CASSIO COSTA', bold: true }, { t: 'Secretário de Agricultura' }]);
  return doc;
}

const nomeArquivo = (s: string) => (s || 'produtor').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Gera e baixa o termo em PDF. */
export function baixarTermoPdf(d: DadosTermo): void {
  montarTermoPdf(d).save(`Termo-${nomeArquivo(d.objeto)}-${nomeArquivo(d.produtor)}.pdf`);
}
