-- Restituição da DAM de atendimento cancelado: colunas opcionais, valores
-- válidos e limpeza do pedido pendente ao reativar o atendimento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_column('public', 'services', 'restituicao_status', 'atendimento tem o status da restituição');
select col_is_null('public', 'services', 'restituicao_valor', 'valor da restituição é opcional');

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci')
on conflict (name) do nothing;
insert into public.settlements (id, name) values ('10000000-0000-0000-0000-0000000015a1', 'PA Teste Rest');
insert into public.demand_types (id, name, category) values ('20000000-0000-0000-0000-0000000015a1', 'PC Teste', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf, settlement_id) values
  ('30000000-0000-0000-0000-0000000015a1', 'Produtor Restituicao', '12345678909', '10000000-0000-0000-0000-0000000015a1');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, dam_paid, dam_value) values
  ('40000000-0000-0000-0000-0000000015a1', '30000000-0000-0000-0000-0000000015a1', '20000000-0000-0000-0000-0000000015a1', '10000000-0000-0000-0000-0000000015a1', current_date, 'pending', true, 500),
  ('40000000-0000-0000-0000-0000000015a2', '30000000-0000-0000-0000-0000000015a1', '20000000-0000-0000-0000-0000000015a1', '10000000-0000-0000-0000-0000000015a1', current_date, 'pending', true, 300);

-- cancelar com pedido de restituição
update public.services set status = 'cancelled', cancellation_reason = 'Chuva',
  restituicao_status = 'pendente', restituicao_valor = 500, restituicao_motivo = 'climatica',
  restituicao_oficio = '1/2026', restituicao_solicitada_em = now()
where id = '40000000-0000-0000-0000-0000000015a1';
select is((select restituicao_status from public.services where id = '40000000-0000-0000-0000-0000000015a1'), 'pendente',
  'cancelado fica com a restituição pendente');

select throws_ok($$ update public.services set restituicao_status = 'outro' where id = '40000000-0000-0000-0000-0000000015a1' $$,
  '23514', null, 'status da restituição só aceita pendente/confirmada');
select throws_ok($$ update public.services set restituicao_motivo = 'outro' where id = '40000000-0000-0000-0000-0000000015a1' $$,
  '23514', null, 'motivo só aceita climática/área inadequada');

-- confirmar
update public.services set restituicao_status = 'confirmada', restituicao_confirmada_em = now()
where id = '40000000-0000-0000-0000-0000000015a1';
select isnt((select restituicao_confirmada_em from public.services where id = '40000000-0000-0000-0000-0000000015a1'), null,
  'confirmação registra a data');

-- desfazer confirmação limpa a data
update public.services set restituicao_status = 'pendente' where id = '40000000-0000-0000-0000-0000000015a1';
select is((select restituicao_confirmada_em from public.services where id = '40000000-0000-0000-0000-0000000015a1'), null,
  'voltar para pendente limpa a data de confirmação');

-- reativar com pedido pendente: o pedido é descartado
update public.services set status = 'pending' where id = '40000000-0000-0000-0000-0000000015a1';
select is((select restituicao_status from public.services where id = '40000000-0000-0000-0000-0000000015a1'), null,
  'reativar o atendimento descarta a restituição pendente');

-- o outro atendimento não é afetado
select is((select restituicao_status from public.services where id = '40000000-0000-0000-0000-0000000015a2'), null,
  'atendimento sem pedido continua sem restituição');

select * from finish();
rollback;
