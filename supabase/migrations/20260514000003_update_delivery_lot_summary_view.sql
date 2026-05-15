-- Update delivery_lot_summary view to include responsible_technician_id
-- (added to delivery_lots in migration 20260514000002)

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
  l.responsible_technician_id,
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
  l.responsible_technician_id, dt.name, dt.category;

GRANT SELECT ON public.delivery_lot_summary TO authenticated, anon;

-- Index for FK lookup
CREATE INDEX IF NOT EXISTS idx_delivery_lots_technician
  ON public.delivery_lots(responsible_technician_id)
  WHERE responsible_technician_id IS NOT NULL;
