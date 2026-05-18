-- =============================================================================
-- Comprehensive Schema Fixes — 2026-05-18
-- Addresses all critical and warning findings from the codebase audit.
-- Every statement is idempotent (IF NOT EXISTS / DO $$ … END $$).
-- =============================================================================

-- ─── 1. Create deliveries table (was created via dashboard — no migration existed) ─

CREATE TABLE IF NOT EXISTS public.deliveries (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id         UUID         NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  demand_type_id      UUID         NOT NULL REFERENCES public.demand_types(id),
  settlement_id       UUID         REFERENCES public.settlements(id),
  quantity            NUMERIC(12,2),
  notes               TEXT,
  delivery_date_start DATE,
  delivery_date_end   DATE,
  status              TEXT         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at        TIMESTAMPTZ,
  created_by          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Ensure RLS is on (harmless if already on)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- Ensure the updated_at trigger fires on deliveries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_deliveries_updated_at'
      AND tgrelid = 'public.deliveries'::regclass
  ) THEN
    CREATE TRIGGER update_deliveries_updated_at
      BEFORE UPDATE ON public.deliveries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ─── 2. Add services.created_by (tracked in code but column never migrated) ─────

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─── 3. Fix delivery_lots.created_by FK: auth.users → profiles ──────────────────
-- PostgREST cannot join across the auth schema; pointing to profiles fixes this.
-- profiles.id == auth.users.id (created by handle_new_user trigger), so no data changes.

ALTER TABLE public.delivery_lots
  DROP CONSTRAINT IF EXISTS delivery_lots_created_by_fkey;

ALTER TABLE public.delivery_lots
  ADD CONSTRAINT delivery_lots_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─── 4. Fix operator UPDATE policy — allow finalizing in_progress services ──────
-- Previously, operators could only update pending/proximo services or services
-- already assigned to them. A service put in_progress by an admin (operator_id=NULL)
-- was unreachable by operators. Fix: also allow when status = 'in_progress'.

DROP POLICY IF EXISTS "Operators can update services" ON public.services;

CREATE POLICY "Operators can update services"
  ON public.services FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'operator'::app_role)
    AND (
      status IN ('pending', 'proximo', 'in_progress')
      OR operator_id = auth.uid()
    )
  );

-- ─── 5. Performance indexes ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_services_producer_id
  ON public.services(producer_id);

CREATE INDEX IF NOT EXISTS idx_services_created_by
  ON public.services(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_producer_id
  ON public.deliveries(producer_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_status
  ON public.deliveries(status);

-- ─── 6. Add CHECK constraint on demand_types.category ──────────────────────────
-- Prevents typos from silently breaking category-specific UI features.

ALTER TABLE public.demand_types
  DROP CONSTRAINT IF EXISTS demand_types_category_check;

ALTER TABLE public.demand_types
  ADD CONSTRAINT demand_types_category_check
  CHECK (category IS NULL OR category IN (
    'patrulha_mecanizada',
    'calcario',
    'logistica_insumos',
    'entregas',
    'assistencia_tecnica'
  ));

-- ─── 7. Ensure deliveries has required columns (added via dashboard historically) ─

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS quantity          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS notes             TEXT,
  ADD COLUMN IF NOT EXISTS delivery_date_start DATE,
  ADD COLUMN IF NOT EXISTS delivery_date_end   DATE,
  ADD COLUMN IF NOT EXISTS created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 8. Fix producers.location_name: ensure it's consistent with location_id join ─
-- No schema change needed — code fix handles this.

-- ─── 9. Reload PostgREST schema cache ────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
