-- Entregas: lote com modelo padrão de termo (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.demand_types (id, name, category) values ('ba000000-0000-0000-0000-000000000002', 'Mudas Teste', 'entregas');
insert into public.delivery_lots (id, demand_type_id, name, initial_quantity, unit) values
  ('ba000000-0000-0000-0000-000000000010', 'ba000000-0000-0000-0000-000000000002', 'Lote sem termo', 100, 'unidade');
insert into public.delivery_lots (id, demand_type_id, name, initial_quantity, unit, usa_termo_padrao, termo_objeto) values
  ('ba000000-0000-0000-0000-000000000011', 'ba000000-0000-0000-0000-000000000002', 'Lote açaí', 500, 'unidade', true, 'mudas de açaí');

select is((select usa_termo_padrao from public.delivery_lots where id = 'ba000000-0000-0000-0000-000000000010'), false,
  'lote novo não usa o modelo padrão por padrão');
select is((select termo_objeto from public.delivery_lot_summary where id = 'ba000000-0000-0000-0000-000000000011'), 'mudas de açaí',
  'resumo dos lotes traz o objeto do termo');
select is((select usa_termo_padrao from public.delivery_lot_summary where id = 'ba000000-0000-0000-0000-000000000011'), true,
  'resumo dos lotes traz se usa o modelo padrão');
select is((select remaining_quantity from public.delivery_lot_summary where id = 'ba000000-0000-0000-0000-000000000011'), 500::numeric,
  'cálculo de saldo do lote continua igual');

select * from finish();
rollback;
