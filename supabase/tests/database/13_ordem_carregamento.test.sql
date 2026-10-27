-- Ordem de carregamento: coluna opcional, sem afetar atendimentos existentes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select has_column('public', 'services', 'loading_order_url', 'atendimento tem a ordem de carregamento');
select col_is_null('public', 'services', 'loading_order_url', 'ordem de carregamento é opcional');
select * from finish();
rollback;
