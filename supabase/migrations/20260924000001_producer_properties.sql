-- ============================================================================
-- Produtor com mais de uma propriedade (inclusive em assentamentos diferentes).
--
-- A propriedade que já existe no cadastro do produtor (settlement_id, gleba_id,
-- location_name, latitude, longitude) continua sendo a PRINCIPAL — nada é
-- movido. As propriedades ADICIONAIS ficam em producer_properties.
-- O atendimento aponta para a propriedade em services.property_id
-- (NULL = propriedade principal, exatamente como hoje).
-- Aditivo e idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.producer_properties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id   uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  name          text,                                   -- ex.: "Sítio Boa Vista" (opcional)
  settlement_id uuid NOT NULL REFERENCES public.settlements(id),
  gleba_id      uuid REFERENCES public.glebas(id) ON DELETE SET NULL,
  location_name text,
  latitude      numeric,
  longitude     numeric,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producer_properties_producer   ON public.producer_properties(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_properties_settlement ON public.producer_properties(settlement_id);

-- Mesma política de produtores: admin e operador leem; só admin altera.
-- (Sem dados pessoais nesta tabela.)
ALTER TABLE public.producer_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "producer_properties_select" ON public.producer_properties;
CREATE POLICY "producer_properties_select" ON public.producer_properties
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

DROP POLICY IF EXISTS "producer_properties_admin_write" ON public.producer_properties;
CREATE POLICY "producer_properties_admin_write" ON public.producer_properties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producer_properties TO authenticated;

-- Auditoria, como nas demais tabelas de cadastro.
DROP TRIGGER IF EXISTS trg_audit_producer_properties ON public.producer_properties;
CREATE TRIGGER trg_audit_producer_properties
  AFTER INSERT OR UPDATE OR DELETE ON public.producer_properties
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS update_producer_properties_updated_at ON public.producer_properties;
CREATE TRIGGER update_producer_properties_updated_at
  BEFORE UPDATE ON public.producer_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atendimento → propriedade. Sem ação no DELETE (NO ACTION): não se apaga uma
-- propriedade que tem atendimentos; apagar o PRODUTOR continua funcionando,
-- pois atendimentos e propriedades saem juntos na mesma cascata.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.producer_properties(id);

CREATE INDEX IF NOT EXISTS idx_services_property ON public.services(property_id);

-- Amarração: a propriedade tem de ser do mesmo produtor do atendimento, e o
-- assentamento do atendimento passa a ser o da propriedade.
CREATE OR REPLACE FUNCTION public.service_property_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE pp public.producer_properties%ROWTYPE;
BEGIN
  IF NEW.property_id IS NOT NULL THEN
    SELECT * INTO pp FROM public.producer_properties WHERE id = NEW.property_id;
    IF NOT FOUND OR pp.producer_id IS DISTINCT FROM NEW.producer_id THEN
      RAISE EXCEPTION 'Propriedade não pertence ao produtor do atendimento.';
    END IF;
    NEW.settlement_id := pp.settlement_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_service_property_guard ON public.services;
CREATE TRIGGER trg_service_property_guard
  BEFORE INSERT OR UPDATE OF property_id, producer_id, settlement_id ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.service_property_guard();

NOTIFY pgrst, 'reload schema';
