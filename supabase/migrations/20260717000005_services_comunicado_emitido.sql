-- Sinaliza que o Comunicado de DAM foi emitido — estado distinto de
-- "DAM pendente" (dam_issued) e "DAM paga" (dam_paid).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS comunicado_emitido boolean NOT NULL DEFAULT false;

-- Reclassifica comunicados já emitidos pela versão anterior (que marcava
-- dam_issued): tinham valor de DAM (só o comunicado grava dam_value) e ainda
-- não foram pagos. Passam a "Comunicado emitido" (não mais "pendente").
UPDATE public.services
SET comunicado_emitido = true,
    dam_issued = false
WHERE dam_value IS NOT NULL
  AND dam_paid = false
  AND dam_issued = true;

NOTIFY pgrst, 'reload schema';
