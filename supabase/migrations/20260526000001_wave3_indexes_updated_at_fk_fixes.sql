-- =============================================================================
-- Wave 3 — Auditoria de integridade: índices, updated_at e correções de FK
-- Auditoria de 2026-05-26. Todas as instruções são idempotentes.
-- =============================================================================

-- ─── 1. Índices para FKs sem índice (M-01) ───────────────────────────────────
-- Todas as FKs devem ter índice na coluna filho para evitar seq-scans em JOINs
-- e em ON DELETE cascades.

CREATE INDEX IF NOT EXISTS idx_locations_settlement_id
  ON public.locations(settlement_id);

CREATE INDEX IF NOT EXISTS idx_producers_settlement_id
  ON public.producers(settlement_id);

CREATE INDEX IF NOT EXISTS idx_producers_location_id
  ON public.producers(location_id)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_demand_type_id
  ON public.services(demand_type_id);

CREATE INDEX IF NOT EXISTS idx_services_settlement_id
  ON public.services(settlement_id)
  WHERE settlement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_location_id
  ON public.services(location_id)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_operator_id
  ON public.services(operator_id)
  WHERE operator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_machinery_id
  ON public.services(machinery_id)
  WHERE machinery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_responsible_technician_id
  ON public.services(responsible_technician_id)
  WHERE responsible_technician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_photos_service_id
  ON public.service_photos(service_id);

CREATE INDEX IF NOT EXISTS idx_sefaz_producers_settlement_id
  ON public.sefaz_producers(settlement_id)
  WHERE settlement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sefaz_services_sefaz_producer_id
  ON public.sefaz_services(sefaz_producer_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_demand_type_id
  ON public.deliveries(demand_type_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_settlement_id
  ON public.deliveries(settlement_id)
  WHERE settlement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_created_by
  ON public.deliveries(created_by)
  WHERE created_by IS NOT NULL;

-- ─── 2. Colunas updated_at nas tabelas que não têm (M-09) ───────────────────
-- Todas as entidades mutáveis devem ter updated_at para rastreabilidade.
-- Valor inicial = created_at (ou now() como fallback seguro).

ALTER TABLE public.demand_types
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.machinery
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.patrimony
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.delivery_lots
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.responsible_technicians
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.sefaz_producers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.sefaz_services
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── 3. Triggers de updated_at para as tabelas acima ────────────────────────
-- A função update_updated_at_column() já existe (criada na migration inicial).
-- Cada bloco DO só cria o trigger se ele ainda não existir.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_demand_types_updated_at'
    AND tgrelid = 'public.demand_types'::regclass) THEN
    CREATE TRIGGER update_demand_types_updated_at
      BEFORE UPDATE ON public.demand_types
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_settlements_updated_at'
    AND tgrelid = 'public.settlements'::regclass) THEN
    CREATE TRIGGER update_settlements_updated_at
      BEFORE UPDATE ON public.settlements
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_locations_updated_at'
    AND tgrelid = 'public.locations'::regclass) THEN
    CREATE TRIGGER update_locations_updated_at
      BEFORE UPDATE ON public.locations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_producers_updated_at'
    AND tgrelid = 'public.producers'::regclass) THEN
    CREATE TRIGGER update_producers_updated_at
      BEFORE UPDATE ON public.producers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_machinery_updated_at'
    AND tgrelid = 'public.machinery'::regclass) THEN
    CREATE TRIGGER update_machinery_updated_at
      BEFORE UPDATE ON public.machinery
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patrimony_updated_at'
    AND tgrelid = 'public.patrimony'::regclass) THEN
    CREATE TRIGGER update_patrimony_updated_at
      BEFORE UPDATE ON public.patrimony
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_delivery_lots_updated_at'
    AND tgrelid = 'public.delivery_lots'::regclass) THEN
    CREATE TRIGGER update_delivery_lots_updated_at
      BEFORE UPDATE ON public.delivery_lots
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_responsible_technicians_updated_at'
    AND tgrelid = 'public.responsible_technicians'::regclass) THEN
    CREATE TRIGGER update_responsible_technicians_updated_at
      BEFORE UPDATE ON public.responsible_technicians
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sefaz_producers_updated_at'
    AND tgrelid = 'public.sefaz_producers'::regclass) THEN
    CREATE TRIGGER update_sefaz_producers_updated_at
      BEFORE UPDATE ON public.sefaz_producers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sefaz_services_updated_at'
    AND tgrelid = 'public.sefaz_services'::regclass) THEN
    CREATE TRIGGER update_sefaz_services_updated_at
      BEFORE UPDATE ON public.sefaz_services
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ─── 4. Corrigir deliveries.created_by: auth.users → profiles (A-03) ────────
-- delivery_lots.created_by já foi corrigido na migration 20260518000001.
-- deliveries.created_by ficou apontando para auth.users, que não é acessível
-- via PostgREST (schema auth não exposto). Redirecionar para profiles.
-- profiles.id == auth.users.id por design (trigger handle_new_user), portanto
-- nenhum dado existente é invalidado por esta mudança.

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_created_by_fkey;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─── 5. Tornar explícitos os ON DELETE implícitos críticos (A-06) ─────────────
-- Comportamento NO ACTION é igual a RESTRICT na prática para writes unitários,
-- mas RESTRICT é self-documenting e garante verificação imediata (não adiada).
-- Tabelas afetadas: services, producers, deliveries.

-- services.demand_type_id
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_demand_type_id_fkey;
ALTER TABLE public.services
  ADD CONSTRAINT services_demand_type_id_fkey
  FOREIGN KEY (demand_type_id) REFERENCES public.demand_types(id) ON DELETE RESTRICT;

-- services.machinery_id
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_machinery_id_fkey;
ALTER TABLE public.services
  ADD CONSTRAINT services_machinery_id_fkey
  FOREIGN KEY (machinery_id) REFERENCES public.machinery(id) ON DELETE RESTRICT;

-- services.settlement_id
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_settlement_id_fkey;
ALTER TABLE public.services
  ADD CONSTRAINT services_settlement_id_fkey
  FOREIGN KEY (settlement_id) REFERENCES public.settlements(id) ON DELETE RESTRICT;

-- services.location_id
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_location_id_fkey;
ALTER TABLE public.services
  ADD CONSTRAINT services_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;

-- producers.settlement_id
ALTER TABLE public.producers DROP CONSTRAINT IF EXISTS producers_settlement_id_fkey;
ALTER TABLE public.producers
  ADD CONSTRAINT producers_settlement_id_fkey
  FOREIGN KEY (settlement_id) REFERENCES public.settlements(id) ON DELETE RESTRICT;

-- producers.location_id
ALTER TABLE public.producers DROP CONSTRAINT IF EXISTS producers_location_id_fkey;
ALTER TABLE public.producers
  ADD CONSTRAINT producers_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;

-- deliveries.demand_type_id
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_demand_type_id_fkey;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_demand_type_id_fkey
  FOREIGN KEY (demand_type_id) REFERENCES public.demand_types(id) ON DELETE RESTRICT;

-- deliveries.settlement_id
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_settlement_id_fkey;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_settlement_id_fkey
  FOREIGN KEY (settlement_id) REFERENCES public.settlements(id) ON DELETE RESTRICT;

-- ─── 6. Recarregar cache do PostgREST ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
