-- Patrimônio: valor atual e importação do inventário da SMAMA.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'patrimony', 'current_value', 'patrimônio tem o valor atual');
select throws_ok($$ insert into public.patrimony (name, patrimony_number, current_value) values ('X', 'T-NEG', -1) $$,
  '23514', null, 'valor atual não pode ser negativo');

-- No banco de teste (sem dados), a importação cadastra os bens da planilha.
select is((select name from public.patrimony where patrimony_number = '12908'), 'Pá carregadeira LW 300KV', 'bem importado com nome');
select is((select current_value::text from public.patrimony where patrimony_number = '12550'), '48125.00', 'valor atual importado');
select is((select count(*)::int from public.patrimony where name ilike 'placa solar%'), 0, 'placas solares não foram importadas');

select * from finish();
rollback;
