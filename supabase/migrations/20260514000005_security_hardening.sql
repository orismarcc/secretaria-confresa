-- =============================================================================
-- Security Hardening — restrict overly broad RLS policies
-- SAFE: all current users have either 'admin' or 'operator' role, so
--       swapping USING (true) → has_role() does not break any workflow.
-- =============================================================================

-- ─── 1. Remove anon access from the lot-summary view ─────────────────────────
-- The original migration granted SELECT to both authenticated AND anon, meaning
-- unauthenticated visitors could query stock/inventory data via the REST API.
REVOKE SELECT ON public.delivery_lot_summary FROM anon;

-- ─── 2. delivery_lots — restrict to admin / operator ─────────────────────────
DROP POLICY IF EXISTS "auth_read_delivery_lots"   ON public.delivery_lots;
DROP POLICY IF EXISTS "auth_insert_delivery_lots" ON public.delivery_lots;
DROP POLICY IF EXISTS "auth_update_delivery_lots" ON public.delivery_lots;
DROP POLICY IF EXISTS "auth_delete_delivery_lots" ON public.delivery_lots;

CREATE POLICY "admin_operator_select_delivery_lots"
  ON public.delivery_lots FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_insert_delivery_lots"
  ON public.delivery_lots FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_update_delivery_lots"
  ON public.delivery_lots FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_only_delete_delivery_lots"
  ON public.delivery_lots FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ─── 3. delivery_items — restrict to admin / operator ────────────────────────
DROP POLICY IF EXISTS "auth_read_delivery_items"   ON public.delivery_items;
DROP POLICY IF EXISTS "auth_insert_delivery_items" ON public.delivery_items;
DROP POLICY IF EXISTS "auth_update_delivery_items" ON public.delivery_items;
DROP POLICY IF EXISTS "auth_delete_delivery_items" ON public.delivery_items;

CREATE POLICY "admin_operator_select_delivery_items"
  ON public.delivery_items FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_insert_delivery_items"
  ON public.delivery_items FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_update_delivery_items"
  ON public.delivery_items FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_delete_delivery_items"
  ON public.delivery_items FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- ─── 4. deliveries — enable RLS (table created via dashboard, never secured) ─
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated"       ON public.deliveries;
DROP POLICY IF EXISTS "admin_operator_select_deliveries"  ON public.deliveries;
DROP POLICY IF EXISTS "admin_operator_insert_deliveries"  ON public.deliveries;
DROP POLICY IF EXISTS "admin_operator_update_deliveries"  ON public.deliveries;
DROP POLICY IF EXISTS "admin_operator_delete_deliveries"  ON public.deliveries;

CREATE POLICY "admin_operator_select_deliveries"
  ON public.deliveries FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_insert_deliveries"
  ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_update_deliveries"
  ON public.deliveries FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_delete_deliveries"
  ON public.deliveries FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- ─── 5. sefaz_producers — restrict to admin / operator ───────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sefaz_producers;

CREATE POLICY "admin_operator_sefaz_producers"
  ON public.sefaz_producers FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- ─── 6. sefaz_services — restrict to admin / operator ────────────────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sefaz_services;

CREATE POLICY "admin_operator_sefaz_services"
  ON public.sefaz_services FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- ─── 7. responsible_technicians — restrict to admin / operator ───────────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.responsible_technicians;

CREATE POLICY "admin_operator_responsible_technicians"
  ON public.responsible_technicians FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- ─── 8. patrimony — restrict to admin / operator (delete: admin only) ────────
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.patrimony;

CREATE POLICY "admin_operator_select_patrimony"
  ON public.patrimony FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_insert_patrimony"
  ON public.patrimony FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_operator_update_patrimony"
  ON public.patrimony FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "admin_only_delete_patrimony"
  ON public.patrimony FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
