-- Cancelado com DAM paga fica com restituição pendente automaticamente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- O banco de teste não tem dados: cria o mínimo necessário (fictício).
insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci')
on conflict (name) do nothing;
insert into public.demand_types (id, name, category) values ('00000000-0000-0000-0000-00000000a002', 'Serviço Teste Restituição', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf) values ('00000000-0000-0000-0000-00000000a001', 'Produtor Teste Restituição', '39053344705');

insert into public.services (id, producer_id, demand_type_id, scheduled_date, status, dam_issued, dam_paid, dam_value)
values ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', current_date, 'pending', true, true, 350);

update public.services set status = 'cancelled' where id = '00000000-0000-0000-0000-00000000a003';
select is((select restituicao_status from public.services where id = '00000000-0000-0000-0000-00000000a003'), 'pendente', 'cancelar com DAM paga deixa a restituição pendente');
select is((select restituicao_valor::text from public.services where id = '00000000-0000-0000-0000-00000000a003'), '350.00', 'valor da restituição = valor da DAM');

update public.services set restituicao_status = 'confirmada' where id = '00000000-0000-0000-0000-00000000a003';
select is((select restituicao_status from public.services where id = '00000000-0000-0000-0000-00000000a003'), 'confirmada', 'confirmação continua possível');

-- Cancelado sem DAM paga: nada muda
insert into public.services (id, producer_id, demand_type_id, scheduled_date, status, dam_paid)
values ('00000000-0000-0000-0000-00000000a004', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000a002', current_date, 'cancelled', false);
select is((select restituicao_status from public.services where id = '00000000-0000-0000-0000-00000000a004'), null, 'cancelado sem DAM paga fica sem restituição');

-- DAM marcada como paga depois do cancelamento
update public.services set dam_paid = true, dam_value = 120 where id = '00000000-0000-0000-0000-00000000a004';
select is((select restituicao_status from public.services where id = '00000000-0000-0000-0000-00000000a004'), 'pendente', 'DAM paga depois do cancelamento também fica pendente');

select * from finish();
rollback;
