import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const dia = (delta: number) => { const d = new Date(); d.setDate(d.getDate() + delta); return d.toISOString().slice(0, 10); };
const estado = {
  associacoes: [{ id: 'A', nome: 'Associação Teste', sigla: 'AT', situacao: 'ativa' }],
  itens: [{ id: 'cnd', nome: 'CND Federal', categoria: 'fiscal', obrigatorio: true, tem_validade: true, ordem: 1, ativo: true }],
  docs: [] as Record<string, unknown>[],
};
vi.mock('@/hooks/useAssociacoes', () => ({
  useAssociacoes: () => ({ data: estado.associacoes }),
  useItensChecklist: () => ({ data: estado.itens }),
  useDocumentosAssociacoes: () => ({ data: estado.docs }),
  useDispensas: () => ({ data: [] }),
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { AlertasVencimentoAssociacoes } from './AlertasVencimento';

const doc = (p: Record<string, unknown>) => ({ id: Math.random().toString(36).slice(2), associacao_id: 'A', item_id: null, titulo: 'Doc', numero: null, data_emissao: null, data_validade: null, arquivo_path: null, arquivo_nome: null, arquivo_tamanho: null, observacao: null, enviado_por: null, created_at: '2026-01-01', ...p });

describe('Alertas de vencimento das associações', () => {
  it('mostra vencido e vencendo e abre a associação', () => {
    estado.docs = [doc({ item_id: 'cnd', data_validade: dia(-2) }), doc({ titulo: 'Contrato de comodato', data_validade: dia(10) })];
    render(<AlertasVencimentoAssociacoes ocultarSeVazio />);
    expect(screen.getByText(/2 alerta\(s\) · 1 vencido/)).toBeInTheDocument();
    expect(screen.getByText(/vencido há 2 dia\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/vence em 10 dia\(s\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('CND Federal'));
    expect(navigate).toHaveBeenCalledWith('/associacoes/A?aba=regularizacao');
  });
  it('tudo em dia: some no Dashboard e mostra faixa verde na página', () => {
    estado.docs = [doc({ item_id: 'cnd', data_validade: dia(120) })];
    const { container, rerender } = render(<AlertasVencimentoAssociacoes ocultarSeVazio />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AlertasVencimentoAssociacoes />);
    expect(screen.getByText(/Nenhum documento vencido ou vencendo/)).toBeInTheDocument();
  });
});
