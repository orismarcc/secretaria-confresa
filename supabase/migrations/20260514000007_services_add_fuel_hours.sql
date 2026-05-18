-- Add fuel_liters and worked_hours columns to the services table.
-- These fields apply to patrulha_mecanizada and logistica_insumos categories.
-- NUMERIC(10,2) → up to 99,999,999.99 litres / hours.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS fuel_liters  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS worked_hours NUMERIC(8,2);

-- Indexes are intentionally omitted for now (analytical queries only).
