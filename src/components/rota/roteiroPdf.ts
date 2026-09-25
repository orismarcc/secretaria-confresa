// PDF do roteiro de visitas técnicas (padrão visual dos demais relatórios).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoTransparent from '@/assets/logo-transparent.png';

const GREEN: [number, number, number] = [45, 90, 39];

export interface LinhaRoteiro {
  ordem: number;
  produtor: string;
  propriedade: string;
  telefone: string;
  chegada: string;
  trecho: string;
  coordenadas: string;
}

function carregarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoTransparent;
  });
}

export async function exportarRoteiroPdf(linhas: LinhaRoteiro[], resumo: string[], rodapeRota: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const img = await carregarLogo();
  let h = 24;
  if (img) {
    const lw = 46;
    const lh = lw * (img.naturalHeight / img.naturalWidth);
    doc.addImage(img, 'PNG', 12, 6, lw, lh, undefined, 'FAST');
    h = Math.max(lh + 8, 26);
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text('Roteiro de Visitas Técnicas', W / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, W / 2, 20, { align: 'center' });
  doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(12, h, W - 12, h);
  let y = h + 6;
  doc.setFontSize(9); doc.setTextColor(40);
  resumo.forEach((r) => { doc.text(r, 12, y); y += 4.5; });

  autoTable(doc, {
    startY: y + 1,
    head: [['#', 'Produtor', 'Propriedade / local', 'Telefone', 'Chegada prevista', 'Trecho até aqui', 'Coordenadas', 'Visto']],
    body: linhas.map((l) => [String(l.ordem), l.produtor, l.propriedade, l.telefone, l.chegada, l.trecho, l.coordenadas, '']),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 7: { cellWidth: 18 } },
    margin: { left: 12, right: 12 },
  });
  const fy = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(7); doc.setTextColor(110);
  doc.text(rodapeRota, 12, Math.min(fy, doc.internal.pageSize.getHeight() - 14), { maxWidth: W - 24 });

  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Secretaria de Agricultura de Confresa/MT · Página ${p} de ${n}`, W / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
  }
  doc.save(`roteiro-visitas-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
