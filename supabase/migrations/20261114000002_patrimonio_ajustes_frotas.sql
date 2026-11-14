-- ============================================================================
-- Patrimônio: correções pedidas após a importação do inventário SMAMA
--  1) Valores de aquisição que tinham perdido os milhares:
--     13426 Trator Budny  R$ 206,40 -> R$ 206.400,00
--     016930 Semirreboque R$ 214,90 -> R$ 214.900,00
--  2) Liga as máquinas de Frotas aos seus bens no Patrimônio (só onde o bem
--     é inequívoco e a máquina ainda não tem vínculo).
-- Idempotente e restrito aos registros exatos (só altera se ainda estiver
-- no estado esperado).
-- ============================================================================

UPDATE public.patrimony SET value = 206400.00
 WHERE patrimony_number = '13426' AND value = 206.40;

UPDATE public.patrimony SET value = 214900.00
 WHERE patrimony_number = '016930' AND value = 214.90;

-- Frotas -> Patrimônio (por número municipal, estadual ou "PAT-")
WITH pares(maquina_num, bem_num) AS (VALUES
  ('16924',   '16924'),      -- Pá carregadeira Lonking
  ('15835',   '15835'),      -- PC 03 XCMG -> Escavadeira hidráulica XE215BR
  ('1392642', '1'),          -- Caminhão Meteor SQE3C83 (nº estadual 1392642)
  ('16033',   'PAT-16033')   -- Trator YTO
)
UPDATE public.machinery m
   SET patrimony_id = p.id
  FROM pares, public.patrimony p
 WHERE m.patrimony_number = pares.maquina_num
   AND p.patrimony_number = pares.bem_num
   AND m.patrimony_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.machinery o WHERE o.patrimony_id = p.id)
   AND (SELECT count(*) FROM public.machinery x WHERE x.patrimony_number = pares.maquina_num) = 1;
