-- ============================================================================
-- Trânsito: trajeto (local de saída Cidade/UF → destino) em termos e viagens, e
-- vínculo viagem → termo. Quando a viagem é feita sob um termo, veículo,
-- condutor, origem e destino passam a vir do termo (garantido no banco).
-- Aditivo e idempotente.
-- ============================================================================

ALTER TABLE public.termos_responsabilidade
  ADD COLUMN IF NOT EXISTS origem  text,   -- "Cidade/UF" de saída
  ADD COLUMN IF NOT EXISTS destino text;   -- "Cidade/UF" de destino

ALTER TABLE public.viagens
  ADD COLUMN IF NOT EXISTS origem   text,
  ADD COLUMN IF NOT EXISTS termo_id uuid REFERENCES public.termos_responsabilidade(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_viagens_termo ON public.viagens(termo_id);

-- Viagem sob termo: herda veículo, condutor e trajeto do termo (o que o termo
-- não informar, a viagem mantém).
CREATE OR REPLACE FUNCTION public.viagem_herda_termo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE t public.termos_responsabilidade%ROWTYPE;
BEGIN
  IF NEW.termo_id IS NOT NULL THEN
    SELECT * INTO t FROM public.termos_responsabilidade WHERE id = NEW.termo_id;
    IF FOUND THEN
      NEW.machinery_id := t.machinery_id;
      NEW.condutor_id  := t.condutor_id;
      NEW.origem       := COALESCE(t.origem,  NEW.origem);
      NEW.destino      := COALESCE(t.destino, NEW.destino);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_viagem_herda_termo ON public.viagens;
CREATE TRIGGER trg_viagem_herda_termo
  BEFORE INSERT OR UPDATE ON public.viagens
  FOR EACH ROW EXECUTE FUNCTION public.viagem_herda_termo();

-- Termo alterado: propaga às viagens vinculadas (mantém tudo amarrado).
CREATE OR REPLACE FUNCTION public.termo_propaga_viagens()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.machinery_id IS DISTINCT FROM OLD.machinery_id
     OR NEW.condutor_id IS DISTINCT FROM OLD.condutor_id
     OR NEW.origem IS DISTINCT FROM OLD.origem
     OR NEW.destino IS DISTINCT FROM OLD.destino THEN
    -- O UPDATE dispara trg_viagem_herda_termo, que aplica os valores do termo.
    UPDATE public.viagens SET updated_at = now() WHERE termo_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_termo_propaga_viagens ON public.termos_responsabilidade;
CREATE TRIGGER trg_termo_propaga_viagens
  AFTER UPDATE ON public.termos_responsabilidade
  FOR EACH ROW EXECUTE FUNCTION public.termo_propaga_viagens();

NOTIFY pgrst, 'reload schema';
