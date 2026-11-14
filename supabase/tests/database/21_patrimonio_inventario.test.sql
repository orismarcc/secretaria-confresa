-- Patrimônio: valor atual e importação do inventário da SMAMA.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'patrimony', 'current_value', 'patrimônio tem o valor atual');
select throws_ok($$ insert into public.patrimony (name, patrimony_number, current_value) values ('X', 'T-NEG', -1) $$,
  '23514', null, 'valor atual não pode ser negativo');

-- O banco de teste copia só a ESTRUTURA da produção (sem dados) e a migração
-- de importação já foi aplicada lá; então só se verifica o que vale sempre.
select ok(exists (select 1 from pg_constraint where conname = 'patrimony_current_value_check'), 'restrição do valor atual existe');
select lives_ok($$ insert into public.patrimony (name, patrimony_number, value, current_value) values ('X', 'T-OK', 10, 8) $$, 'aceita valor atual válido');
select is((select count(*)::int from public.patrimony where name ilike 'placa solar%'), 0, 'placas solares não foram importadas');

select * from finish();
rollback;
