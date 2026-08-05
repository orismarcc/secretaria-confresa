-- ============================================================================
-- Controle de combustível da secretaria (NÃO é categoria de atendimento).
-- Registra os tipos de combustível utilizados e a quantidade (litros) mês a mês.
-- Aditivo, idempotente. RLS: admins gerenciam, autenticados leem.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fuel_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type       text NOT NULL,
  reference_month date NOT NULL,               -- primeiro dia do mês de referência
  liters          numeric(14,2) NOT NULL DEFAULT 0,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fuel_type, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_fuel_usage_month ON public.fuel_usage (reference_month);

ALTER TABLE public.fuel_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage fuel_usage" ON public.fuel_usage;
CREATE POLICY "Admins can manage fuel_usage"
  ON public.fuel_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Fuel usage viewable by authenticated" ON public.fuel_usage;
CREATE POLICY "Fuel usage viewable by authenticated"
  ON public.fuel_usage FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_usage TO authenticated;

-- Seed com os dados do relatório (01/2026 a 07/2026). Só valores não nulos.
INSERT INTO public.fuel_usage (fuel_type, reference_month, liters) VALUES
  ('Gasolina',  '2026-01-01', 1064.89),
  ('Gasolina',  '2026-02-01', 2743.88),
  ('Gasolina',  '2026-03-01', 2986.93),
  ('Gasolina',  '2026-04-01', 2462.76),
  ('Gasolina',  '2026-05-01', 1862.25),
  ('Gasolina',  '2026-06-01', 2792.07),
  ('Gasolina',  '2026-07-01', 2633.57),
  ('Diesel',    '2026-01-01', 967.14),
  ('Diesel',    '2026-02-01', 2356.31),
  ('Diesel',    '2026-03-01', 3039.52),
  ('Diesel',    '2026-04-01', 2631.13),
  ('Diesel',    '2026-05-01', 4605.70),
  ('Diesel',    '2026-06-01', 2774.48),
  ('Diesel S10','2026-01-01', 5118.08),
  ('Diesel S10','2026-02-01', 9774.91),
  ('Diesel S10','2026-03-01', 11850.92),
  ('Diesel S10','2026-04-01', 10829.00),
  ('Diesel S10','2026-05-01', 8863.24),
  ('Diesel S10','2026-06-01', 9397.97),
  ('Diesel S10','2026-07-01', 9546.23)
ON CONFLICT (fuel_type, reference_month) DO NOTHING;

NOTIFY pgrst, 'reload schema';
