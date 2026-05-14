-- ============================================================
-- Delivery Lots & Items — Stock/Rastreabilidade System
-- ============================================================

-- 1. delivery_lots: each batch/stock record linked to a demand type
CREATE TABLE IF NOT EXISTS public.delivery_lots (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_type_id UUID         NOT NULL REFERENCES public.demand_types(id) ON DELETE RESTRICT,
  name           TEXT         NOT NULL,
  initial_quantity NUMERIC(12,3) NOT NULL CHECK (initial_quantity > 0),
  unit           TEXT         NOT NULL DEFAULT 'unidade',
  supplier       TEXT,
  lot_date       DATE         DEFAULT CURRENT_DATE,
  notes          TEXT,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_by     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. delivery_items: junction — one delivery can draw from one or more lots
CREATE TABLE IF NOT EXISTS public.delivery_items (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID         NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  lot_id      UUID         NOT NULL REFERENCES public.delivery_lots(id) ON DELETE RESTRICT,
  quantity    NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(delivery_id, lot_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_lots_demand_type
  ON public.delivery_lots(demand_type_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lots_active
  ON public.delivery_lots(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery
  ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_lot
  ON public.delivery_items(lot_id);

-- 4. Enable Row Level Security
ALTER TABLE public.delivery_lots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (authenticated users have full access)
DO $$
BEGIN
  -- delivery_lots
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_lots' AND policyname='auth_read_delivery_lots') THEN
    CREATE POLICY auth_read_delivery_lots   ON public.delivery_lots FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_lots' AND policyname='auth_insert_delivery_lots') THEN
    CREATE POLICY auth_insert_delivery_lots ON public.delivery_lots FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_lots' AND policyname='auth_update_delivery_lots') THEN
    CREATE POLICY auth_update_delivery_lots ON public.delivery_lots FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_lots' AND policyname='auth_delete_delivery_lots') THEN
    CREATE POLICY auth_delete_delivery_lots ON public.delivery_lots FOR DELETE TO authenticated USING (true);
  END IF;

  -- delivery_items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_items' AND policyname='auth_read_delivery_items') THEN
    CREATE POLICY auth_read_delivery_items   ON public.delivery_items FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_items' AND policyname='auth_insert_delivery_items') THEN
    CREATE POLICY auth_insert_delivery_items ON public.delivery_items FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_items' AND policyname='auth_update_delivery_items') THEN
    CREATE POLICY auth_update_delivery_items ON public.delivery_items FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_items' AND policyname='auth_delete_delivery_items') THEN
    CREATE POLICY auth_delete_delivery_items ON public.delivery_items FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 6. Stock validation trigger — prevents negative stock server-side
CREATE OR REPLACE FUNCTION public.validate_lot_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initial  NUMERIC;
  v_lot_name TEXT;
  v_used     NUMERIC;
BEGIN
  SELECT initial_quantity, name
  INTO   v_initial, v_lot_name
  FROM   public.delivery_lots
  WHERE  id = NEW.lot_id;

  -- Sum quantity already allocated to OTHER items for this lot
  -- (for UPDATE, excludes the row being updated since it's a BEFORE trigger)
  SELECT COALESCE(SUM(di.quantity), 0)
  INTO   v_used
  FROM   public.delivery_items di
  JOIN   public.deliveries d ON d.id = di.delivery_id
  WHERE  di.lot_id = NEW.lot_id
    AND  d.status IS DISTINCT FROM 'cancelled'
    AND  di.id != NEW.id;   -- safe for INSERT (NEW.id not yet in table)

  IF (v_initial - v_used - NEW.quantity) < 0 THEN
    RAISE EXCEPTION
      'Estoque insuficiente para o lote "%". Saldo disponível: %',
      v_lot_name,
      ROUND(v_initial - v_used, 3);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lot_stock ON public.delivery_items;
CREATE TRIGGER trg_validate_lot_stock
  BEFORE INSERT OR UPDATE OF quantity
  ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lot_stock();

-- 7. View: lot summary with computed remaining quantity
CREATE OR REPLACE VIEW public.delivery_lot_summary AS
SELECT
  l.id,
  l.demand_type_id,
  l.name,
  l.initial_quantity,
  l.unit,
  l.supplier,
  l.lot_date,
  l.notes,
  l.is_active,
  l.created_by,
  l.created_at,
  dt.name     AS demand_type_name,
  dt.category AS demand_type_category,
  COALESCE(
    SUM(di.quantity) FILTER (WHERE d.status IS DISTINCT FROM 'cancelled'),
    0
  ) AS used_quantity,
  l.initial_quantity - COALESCE(
    SUM(di.quantity) FILTER (WHERE d.status IS DISTINCT FROM 'cancelled'),
    0
  ) AS remaining_quantity
FROM  public.delivery_lots l
LEFT JOIN public.demand_types  dt ON dt.id = l.demand_type_id
LEFT JOIN public.delivery_items di ON di.lot_id = l.id
LEFT JOIN public.deliveries     d  ON d.id  = di.delivery_id
GROUP BY
  l.id, l.demand_type_id, l.name, l.initial_quantity, l.unit,
  l.supplier, l.lot_date, l.notes, l.is_active, l.created_by, l.created_at,
  dt.name, dt.category;

GRANT SELECT ON public.delivery_lot_summary TO authenticated, anon;
