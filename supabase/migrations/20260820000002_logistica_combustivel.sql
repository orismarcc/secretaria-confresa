-- ============================================================
-- Logística com cobrança de combustível por distância.
--   Um tipo de demanda pode "cobrar combustível por distância": nesse caso o
--   atendimento informa distância (km) e consumo médio (L/km), e os litros são
--   calculados (distância × consumo) e gravados em fuel_liters — usados na DAM.
--   Os tipos existentes (Logística do Calcário, Insumos) NÃO são afetados.
-- ============================================================

ALTER TABLE public.demand_types
  ADD COLUMN IF NOT EXISTS charges_fuel_by_distance boolean DEFAULT false;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS distance_km numeric(10,2),
  ADD COLUMN IF NOT EXISTS fuel_consumption_per_km numeric(10,4);

-- Novo tipo para o caminhão que fica à disposição da secretaria (cobra combustível).
INSERT INTO public.demand_types (name, category, charges_fuel_by_distance, is_active)
SELECT 'Logística do Calcário (com combustível)', 'calcario', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.demand_types WHERE name = 'Logística do Calcário (com combustível)'
);

NOTIFY pgrst, 'reload schema';
