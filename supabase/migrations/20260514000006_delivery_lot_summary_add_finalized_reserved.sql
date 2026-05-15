-- Extend delivery_lot_summary view to expose finalized and reserved quantities
-- separately so the frontend can show two distinct progress bars.
--
--   finalized_quantity  = sum from completed deliveries  (already delivered)
--   reserved_quantity   = sum from pending deliveries    (registered, not yet delivered)
--   used_quantity       = finalized + reserved           (kept for backward compat / stock validation)
--   remaining_quantity  = initial − used_quantity        (truly available to register)

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

  -- Finalized: quantity from completed deliveries
  COALESCE(
    SUM(di.quantity) FILTER (WHERE d.status = 'completed'),
    0
  ) AS finalized_quantity,

  -- Reserved: quantity from pending deliveries (registered but not yet delivered)
  COALESCE(
    SUM(di.quantity) FILTER (WHERE d.status = 'pending'),
    0
  ) AS reserved_quantity,

  -- Used (total committed = finalized + reserved, excludes cancelled)
  COALESCE(
    SUM(di.quantity) FILTER (WHERE d.status IS DISTINCT FROM 'cancelled'),
    0
  ) AS used_quantity,

  -- Remaining: available to register
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

-- anon access was already revoked in migration 20260514000005
GRANT SELECT ON public.delivery_lot_summary TO authenticated;
