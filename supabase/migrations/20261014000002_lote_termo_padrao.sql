-- ============================================================================
-- Entregas: termo de compromisso gerado a partir do MODELO PADRÃO, por lote.
--   * delivery_lots.usa_termo_padrao — o lote usa o modelo padrão (padrão: não);
--   * delivery_lots.termo_objeto     — o "objeto" que entra no modelo
--     (ex.: "mudas de açaí"). Só o objeto muda; o restante é o texto do modelo.
--   * delivery_lot_summary passa a trazer essas duas colunas (no FIM; as
--     colunas existentes, a lógica e as permissões continuam iguais).
-- Só ACRESCENTA. Idempotente.
-- ============================================================================

ALTER TABLE public.delivery_lots
  ADD COLUMN IF NOT EXISTS usa_termo_padrao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS termo_objeto text;

CREATE OR REPLACE VIEW public.delivery_lot_summary AS
 SELECT l.id,
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
    dt.name AS demand_type_name,
    dt.category AS demand_type_category,
    COALESCE(sum(di.quantity) FILTER (WHERE d.status = 'completed'::text), 0::numeric) AS finalized_quantity,
    COALESCE(sum(di.quantity) FILTER (WHERE d.status = 'pending'::text), 0::numeric) AS reserved_quantity,
    COALESCE(sum(di.quantity) FILTER (WHERE d.status IS DISTINCT FROM 'cancelled'::text), 0::numeric) AS used_quantity,
    l.initial_quantity - COALESCE(sum(di.quantity) FILTER (WHERE d.status IS DISTINCT FROM 'cancelled'::text), 0::numeric) AS remaining_quantity,
    l.usa_termo_padrao,
    l.termo_objeto
   FROM delivery_lots l
     LEFT JOIN demand_types dt ON dt.id = l.demand_type_id
     LEFT JOIN delivery_items di ON di.lot_id = l.id
     LEFT JOIN deliveries d ON d.id = di.delivery_id
  GROUP BY l.id, l.demand_type_id, l.name, l.initial_quantity, l.unit, l.supplier, l.lot_date, l.notes, l.is_active, l.created_by, l.created_at, l.responsible_technician_id, dt.name, dt.category;

NOTIFY pgrst, 'reload schema';
