import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Oficio } from '@/lib/oficios';

const oficio: Oficio = {
  id: 'of-1', ano: 2026, numero: 474, data_oficio: '2026-11-12', destinatario: 'À Câmara Municipal', assunto: 'Convite para audiência',
  categoria: 'Convite', situacao: 'rascunho', descricao: 'Convidamos para a audiência.', modelo_id: null,
  arquivo_path: null, arquivo_nome: null, arquivo_tamanho: null, arquivo_versao: 0, conteudo_html: null,
  created_by: null, updated_by: null, created_at: '', updated_at: '',
};
const mutateAsync = vi.fn(async () => ({}));
vi.mock('@/hooks/useOficios', () => ({
  useOficios: () => ({ data: [oficio], isLoading: false }),
  useOficioModelos: () => ({ data: [], isLoading: false }),
  useSalvarConteudo: () => ({ mutateAsync, mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import OficioEditorPage from './OficioEditorPage';

describe('Editor de ofícios (tela)', () => {
  it('abre com o modelo padrão preenchido, barra de ferramentas e timbrado', async () => {
    render(
      <MemoryRouter initialEntries={['/oficios/editor/oficio/of-1']}>
        <Routes><Route path="/oficios/editor/:tipo/:id" element={<OficioEditorPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('OFÍCIO Nº 474/2026 – SMA')).toBeInTheDocument());
    expect(screen.getByText('À Câmara Municipal')).toBeInTheDocument();
    expect(screen.getByText('Convidamos para a audiência.')).toBeInTheDocument();
    expect(screen.getByText('12 de novembro de 2026', { exact: false })).toBeInTheDocument();
    for (const nome of ['Negrito (Ctrl+B)', 'Justificar', 'Lista numerada', 'Inserir tabela (3×3)', 'Desfazer (Ctrl+Z)']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Imprimir \/ PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Word/ })).toBeInTheDocument();
    // nada alterado ainda: "Salvar" desabilitado
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeDisabled();
    expect(document.querySelector('img[src="/templates/timbrado/rodape.jpg"]')).toBeTruthy();
  });

  it('ofício inexistente mostra aviso', () => {
    render(
      <MemoryRouter initialEntries={['/oficios/editor/oficio/nao-existe']}>
        <Routes><Route path="/oficios/editor/:tipo/:id" element={<OficioEditorPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Ofício não encontrado.')).toBeInTheDocument();
  });
});
