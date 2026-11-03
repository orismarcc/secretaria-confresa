-- ============================================================================
-- Entregas: Data Início / Data Fim deixaram de ser pedidas no cadastro
-- (03/11/2026). No banco de produção as duas colunas estavam como NOT NULL,
-- o que impedia cadastrar entregas novas. Passam a ser OPCIONAIS.
-- Só relaxa a regra: nenhuma data existente é alterada. Idempotente.
-- ============================================================================

ALTER TABLE public.deliveries ALTER COLUMN delivery_date_start DROP NOT NULL;
ALTER TABLE public.deliveries ALTER COLUMN delivery_date_end   DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
