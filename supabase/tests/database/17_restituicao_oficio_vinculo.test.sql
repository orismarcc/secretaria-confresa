-- Vínculo atendimento ↔ ofício de restituição.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_column('public', 'services', 'restituicao_oficio_id', 'atendimento guarda o ofício de restituição');

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci')
on conflict (name) do nothing;
insert into public.settlements (id, name) values ('10000000-0000-0000-0000-0000000017a1', 'PA Teste 17');
insert into public.demand_types (id, name, category) values ('20000000-0000-0000-0000-0000000017a1', 'PC Teste 17', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf, settlement_id) values
  ('30000000-0000-0000-0000-0000000017a1', 'Produtor 17', '12345678909', '10000000-0000-0000-0000-0000000017a1');
insert into public.oficios (id, numero, data_oficio, destinatario, assunto, categoria)
values ('17000000-0000-0000-0000-000000000001', 5, '2033-02-01', 'Sec. de Finanças', 'Restituição', 'Restituição de DAM'),
       ('17000000-0000-0000-0000-000000000002', 6, '2033-02-01', 'Sec. de Finanças', 'Restituição', 'Restituição de DAM');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, dam_paid, dam_value,
  restituicao_status, restituicao_valor, restituicao_oficio, restituicao_oficio_id) values
  ('40000000-0000-0000-0000-0000000017a1', '30000000-0000-0000-0000-0000000017a1', '20000000-0000-0000-0000-0000000017a1', '10000000-0000-0000-0000-0000000017a1',
   current_date, 'cancelled', true, 100, 'pendente', 100, '5/2033', '17000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-0000000017a2', '30000000-0000-0000-0000-0000000017a1', '20000000-0000-0000-0000-0000000017a1', '10000000-0000-0000-0000-0000000017a1',
   current_date, 'cancelled', true, 100, 'pendente', 100, '6/2033', '17000000-0000-0000-0000-000000000002');

-- excluir o ofício não apaga o atendimento: só solta o vínculo
delete from public.oficios where id = '17000000-0000-0000-0000-000000000001';
select is((select restituicao_oficio_id from public.services where id = '40000000-0000-0000-0000-0000000017a1'), null,
  'excluir o ofício solta o vínculo');
select is((select restituicao_status from public.services where id = '40000000-0000-0000-0000-0000000017a1'), 'pendente',
  'restituição continua pendente');

-- reativar com pendente desfaz o vínculo
update public.services set status = 'pending' where id = '40000000-0000-0000-0000-0000000017a2';
select is((select restituicao_oficio_id from public.services where id = '40000000-0000-0000-0000-0000000017a2'), null,
  'reativar o atendimento desfaz o vínculo com o ofício');

select * from finish();
rollback;
