-- ============================================================================
-- Logística do calcário: anexo da ORDEM DE CARREGAMENTO (documento), ao lado
-- do pedido do calcário pago. Mesmo armazenamento do pedido (bucket privado
-- 'dam-receipts', prefixo 'ordens/'), mesmas políticas.
-- Só ACRESCENTA uma coluna opcional. Nenhum dado existente é alterado.
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS loading_order_url text;

NOTIFY pgrst, 'reload schema';
