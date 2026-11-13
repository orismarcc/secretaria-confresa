-- Frotas × Patrimônio: patrimônio opcional para cedido/locado, obrigatório
-- para próprio; vínculo opcional e único com o bem do Patrimônio.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.patrimony (id, name, patrimony_number) values ('20000000-0000-0000-0000-000000000a01', 'Trator do patrimônio', 'PAT-T20');

select lives_ok($$ insert into public.machinery (name, patrimony_number, vinculo, vinculo_inicio) values ('Locado sem patrimônio', null, 'locado', current_date) $$,
  'locado pode não ter patrimônio');
select lives_ok($$ insert into public.machinery (name, vinculo, vinculo_inicio) values ('Cedido sem patrimônio', 'cedido', current_date) $$,
  'cedido pode não ter patrimônio');
select throws_ok($$ insert into public.machinery (name, patrimony_number, vinculo) values ('Próprio sem nº', null, 'proprio') $$,
  '23514', null, 'próprio continua exigindo o nº de patrimônio');
select lives_ok($$ insert into public.machinery (name, patrimony_number, patrimony_id) values ('Próprio ligado', 'PAT-T20', '20000000-0000-0000-0000-000000000a01') $$,
  'próprio pode ser ligado ao bem do Patrimônio');
select throws_ok($$ insert into public.machinery (name, patrimony_number, patrimony_id) values ('Outro', 'PAT-X', '20000000-0000-0000-0000-000000000a01') $$,
  '23505', null, 'um bem do Patrimônio só se liga a uma máquina');

delete from public.patrimony where id = '20000000-0000-0000-0000-000000000a01';
select is((select patrimony_id from public.machinery where name = 'Próprio ligado'), null, 'excluir o bem só desfaz o vínculo');

select * from finish();
rollback;
