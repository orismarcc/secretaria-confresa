-- ============================================================================
-- Editor de ofícios: o texto escrito no sistema (como no Word / Google Docs)
-- fica guardado no ofício e nos modelos de texto.
-- Só ACRESCENTA colunas opcionais. Nenhum dado existente é alterado.
-- ============================================================================

ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS conteudo_html text,
  ADD COLUMN IF NOT EXISTS conteudo_atualizado_em timestamptz;

ALTER TABLE public.oficio_modelos
  ADD COLUMN IF NOT EXISTS conteudo_html text;

-- Limite de tamanho (texto puro do editor; imagens não entram aqui).
ALTER TABLE public.oficios DROP CONSTRAINT IF EXISTS oficios_conteudo_tamanho;
ALTER TABLE public.oficios ADD CONSTRAINT oficios_conteudo_tamanho
  CHECK (conteudo_html IS NULL OR length(conteudo_html) <= 2000000);
ALTER TABLE public.oficio_modelos DROP CONSTRAINT IF EXISTS oficio_modelos_conteudo_tamanho;
ALTER TABLE public.oficio_modelos ADD CONSTRAINT oficio_modelos_conteudo_tamanho
  CHECK (conteudo_html IS NULL OR length(conteudo_html) <= 2000000);

NOTIFY pgrst, 'reload schema';
