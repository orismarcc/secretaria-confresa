-- ============================================================
-- Anexo do "pedido" do calcário (quando o calcário é pago).
--   Nas demandas de calcário (Logística do Calcário e ...(com combustível)),
--   permite marcar "Calcário pago?" e anexar o documento do pedido — apenas
--   para arquivar o documento. Reutiliza o bucket privado 'dam-receipts'
--   (mesmas políticas), gravando o arquivo sob o prefixo 'pedidos/'.
-- ============================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS limestone_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS limestone_order_url text;

NOTIFY pgrst, 'reload schema';
