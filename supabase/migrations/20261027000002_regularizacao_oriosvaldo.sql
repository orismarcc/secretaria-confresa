-- ============================================================================
-- Regularização retroativa (pedido da Secretaria em 27/10/2026): atendimento
-- de Perfuração de solo (implemento) realizado e não lançado na época.
--   Produtor: cadastro existente (PA Independente 1) · 4 h · 0,5 ha
--   Cadastro: 06/05/2026 · Finalização: 24/10/2026
-- Lançamento com AUDITORIA NORMAL (o registro da auditoria mostra a data real
-- deste lançamento). Idempotente: id fixo, não duplica se rodar de novo.
-- ============================================================================

INSERT INTO public.services (
  id, producer_id, demand_type_id, settlement_id, status, priority,
  scheduled_date, created_at, completed_at, worked_hours, worked_area, notes
)
SELECT
  'a7c1e2d4-5b6f-4c8e-9d0a-27102026a001'::uuid,
  p.id,
  'c99898a8-f0e7-4b53-b16b-cb5df8676745'::uuid,
  p.settlement_id,
  'completed', 'medium',
  DATE '2026-05-06',
  TIMESTAMPTZ '2026-05-06 12:00:00+00',
  TIMESTAMPTZ '2026-10-24 12:00:00+00',
  4, 0.5,
  'Lançamento retroativo — regularizado em 27/10/2026.'
FROM public.producers p
WHERE p.id = 'b4a7f764-77db-404f-a99f-ec00d2e49aa3'::uuid
ON CONFLICT (id) DO NOTHING;
