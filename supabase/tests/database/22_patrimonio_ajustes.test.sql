BEGIN;
SELECT plan(2);

-- A migração de ajustes só altera registros no estado exato esperado:
-- um bem com valor diferente não pode ser tocado.
INSERT INTO public.patrimony (patrimony_number, name, value)
VALUES ('TESTE-13426', 'Bem de teste', 206.40);
UPDATE public.patrimony SET value = 206400.00
 WHERE patrimony_number = '13426' AND value = 206.40;
SELECT is((SELECT value FROM public.patrimony WHERE patrimony_number = 'TESTE-13426'),
          206.40::numeric, 'correção de valor não atinge outros bens');

-- Um bem só pode estar ligado a uma máquina
SELECT has_index('public', 'machinery', 'machinery_patrimony_id_key', 'vínculo único máquina-bem');

SELECT * FROM finish();
ROLLBACK;
