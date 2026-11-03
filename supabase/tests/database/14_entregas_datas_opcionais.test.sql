-- Entregas sem Data Início / Data Fim (campos removidos do cadastro).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select col_is_null('public', 'deliveries', 'delivery_date_start', 'data início é opcional');
select col_is_null('public', 'deliveries', 'delivery_date_end', 'data fim é opcional');
select * from finish();
rollback;
