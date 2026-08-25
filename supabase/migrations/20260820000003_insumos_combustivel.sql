-- ============================================================
-- Logística de Insumos passa a cobrar combustível por distância.
--   Mesma lógica do caminhão do calcário: distância (km) × consumo (L/km) = litros.
--   Registros antigos não mudam; a UI preserva o valor de litros existente quando
--   distância/consumo não estão preenchidos.
-- ============================================================

UPDATE public.demand_types
  SET charges_fuel_by_distance = true
WHERE category = 'logistica_insumos';

NOTIFY pgrst, 'reload schema';
