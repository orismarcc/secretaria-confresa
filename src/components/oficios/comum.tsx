// Peças compartilhadas da página Ofícios.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { triggerDownload } from '@/lib/comunicado';
import { baixarConteudoOficio } from '@/hooks/useOficios';
import {
  MODELO_PADRAO_URL, ehDocx, nomeSeguro, preencherModeloDocx, situacaoInfo,
  type DadosModelo, type OficioModelo,
} from '@/lib/oficios';

export function SituacaoBadge({ situacao, className }: { situacao: string; className?: string }) {
  const s = situacaoInfo(situacao);
  return <Badge variant="outline" className={cn('font-medium whitespace-nowrap', s.classe, className)}>{s.rotulo}</Badge>;
}

/** Modelo escolhido: null = modelo padrão (timbrado oficial). */
export type ModeloEscolhido = OficioModelo | null;

/**
 * Gera o documento a partir do modelo, preenchendo os campos ({numero},
 * {data}, ...). Modelo em PDF não tem campos: baixa o próprio PDF.
 * Devolve um aviso quando o modelo não pôde ser preenchido (sai o original).
 */
export async function gerarDocumentoDoModelo(modelo: ModeloEscolhido, dados: DadosModelo): Promise<string | null> {
  const nomeBase = `Oficio-${dados.numero.replace('/', '-')}`;
  if (modelo && !ehDocx(modelo.arquivo_nome)) {
    if (!modelo.arquivo_path) throw new Error('Este modelo não tem arquivo.');
    const bytes = await baixarConteudoOficio(modelo.arquivo_path);
    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), `${nomeBase}-${nomeSeguro(modelo.arquivo_nome || 'modelo.pdf')}`);
    return 'Modelo em PDF: o arquivo foi baixado como está (PDF não tem campos para preencher).';
  }
  let conteudo: ArrayBuffer;
  if (modelo) {
    if (!modelo.arquivo_path) throw new Error('Este modelo não tem arquivo.');
    conteudo = await baixarConteudoOficio(modelo.arquivo_path);
  } else {
    const resp = await fetch(MODELO_PADRAO_URL);
    if (!resp.ok) throw new Error('Modelo padrão não encontrado.');
    conteudo = await resp.arrayBuffer();
  }
  try {
    triggerDownload(preencherModeloDocx(conteudo, dados), `${nomeBase}.docx`);
    return null;
  } catch {
    // Modelo com chaves mal formadas: entrega o original, sem alterar nada.
    triggerDownload(new Blob([conteudo], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), `${nomeBase}.docx`);
    return 'Não foi possível preencher os campos deste modelo (verifique as chaves { }). O modelo foi baixado sem alterações.';
  }
}
