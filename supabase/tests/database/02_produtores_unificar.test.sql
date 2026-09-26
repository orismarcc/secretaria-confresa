-- CPF padronizado, cadastros parecidos e Unificar/Desfazer (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm9@teste.local'),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op9@teste.local');
insert into public.profiles (id, email, name) values
  ('00000000-0000-0000-0000-0000000000a9', 'adm9@teste.local', 'Adm'), ('00000000-0000-0000-0000-0000000000b9', 'op9@teste.local', 'Op')
on conflict (id) do nothing;
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000b9');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a9', 'admin'), ('00000000-0000-0000-0000-0000000000b9', 'operator');
insert into public.settlements (id, name) values ('50000000-0000-0000-0000-000000000001', 'PA Unif Teste');
insert into public.demand_types (id, name, category) values
  ('50000000-0000-0000-0000-000000000011', 'Tipo A', 'patrulha_mecanizada'),
  ('50000000-0000-0000-0000-000000000012', 'Tipo B', 'patrulha_mecanizada');

-- ─── CPF ────────────────────────────────────────────────────────────────────
insert into public.producers (id, name, cpf, settlement_id, phone) values
  ('60000000-0000-0000-0000-000000000001', 'José da Silva Teste', '52998224725', '50000000-0000-0000-0000-000000000001', '(66) 98888-1111');
select is((select cpf from public.producers where id = '60000000-0000-0000-0000-000000000001'), '529.982.247-25',
  'CPF digitado só com números é gravado no formato padrão');
select ok((select cpf_encrypted is not null from public.producers where id = '60000000-0000-0000-0000-000000000001'),
  'CPF continua sendo criptografado');
select throws_ok($$ insert into public.producers (name, cpf) values ('Outro', '529.982.247-25') $$, '23505', null,
  'mesmo CPF (formatado) é bloqueado');
select throws_ok($$ insert into public.producers (name, cpf) values ('Outro', '529982247-25') $$, '23505', null,
  'mesmo CPF digitado de outro jeito também é bloqueado');
insert into public.producers (id, name, cpf) values ('60000000-0000-0000-0000-000000000009', 'Empresa Teste', '11222333000181');
select is((select cpf from public.producers where id = '60000000-0000-0000-0000-000000000009'), '11.222.333/0001-81',
  'CNPJ digitado só com números vai para o formato padrão');
update public.producers set name = 'José da Silva Teste' where id = '60000000-0000-0000-0000-000000000001';
select is((select cpf from public.producers where id = '60000000-0000-0000-0000-000000000001'), '529.982.247-25',
  'editar outros campos não mexe no CPF');

-- ─── Parecidos ──────────────────────────────────────────────────────────────
insert into public.producers (id, name, cpf, settlement_id, phone, latitude, longitude) values
  ('60000000-0000-0000-0000-000000000002', 'Jose da Silva Teste', '11144477735', '50000000-0000-0000-0000-000000000001', null, -10.7, -51.7);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
set local role authenticated;
select is((select motivo from public.produtores_parecidos('Qualquer', '529.982.247-25') limit 1), 'mesmo CPF',
  'parecidos: acha pelo CPF');
select is((select motivo from public.produtores_parecidos('Fulano', null, '66988881111') limit 1), 'mesmo telefone',
  'parecidos: acha pelo telefone (qualquer formato)');
select ok((select count(*) from public.produtores_parecidos('JOSE DA SILVA TESTE', null, null, '50000000-0000-0000-0000-000000000001')) >= 2,
  'parecidos: acha nome parecido sem acento/maiúsculas no mesmo assentamento');
select is((select count(*)::int from public.produtores_parecidos('José da Silva Teste', null, null, null, '60000000-0000-0000-0000-000000000001')
  where id = '60000000-0000-0000-0000-000000000001'), 0, 'parecidos: ignora o próprio cadastro em edição');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.produtores_parecidos('José da Silva Teste', '529.982.247-25')), 0,
  'parecidos: operador não recebe nada');
select throws_ok($$ select public.unificar_produtores('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'operador NÃO pode unificar');
reset role;

-- ─── Unificar ───────────────────────────────────────────────────────────────
insert into public.producer_properties (id, producer_id, name, settlement_id) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'Sítio do repetido', '50000000-0000-0000-0000-000000000001');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, property_id) values
  ('71000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000001', current_date, '70000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000001', current_date, null);
insert into public.producer_demands (producer_id, demand_type_id) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000011'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000011'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000012');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.unificar_produtores('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002') $$,
  'admin unifica os dois cadastros');
reset role;

select is((select count(*)::int from public.producers where id = '60000000-0000-0000-0000-000000000002'), 0, 'cadastro repetido foi removido');
select is((select count(*)::int from public.services where producer_id = '60000000-0000-0000-0000-000000000001'), 2, 'atendimentos passaram para o principal');
select is((select producer_id::text from public.producer_properties where id = '70000000-0000-0000-0000-000000000001'),
  '60000000-0000-0000-0000-000000000001', 'propriedade passou para o principal');
select is((select count(*)::int from public.producer_demands where producer_id = '60000000-0000-0000-0000-000000000001'), 2,
  'tipos de demanda somados sem duplicar');
select is((select latitude::float from public.producers where id = '60000000-0000-0000-0000-000000000001'), -10.7::float,
  'localização vazia do principal foi preenchida com a do repetido');
select is((select phone from public.producers where id = '60000000-0000-0000-0000-000000000001'), '(66) 98888-1111',
  'dado já existente no principal NÃO é sobrescrito');

-- ─── Desfazer ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.desfazer_unificacao((select id from public.backup_unificacao_produtores
  where manter_id = '60000000-0000-0000-0000-000000000001' order by unificado_em desc limit 1)) $$, 'admin desfaz a unificação');
reset role;
select is((select count(*)::int from public.services where producer_id = '60000000-0000-0000-0000-000000000002'), 2,
  'desfazer: atendimentos voltaram ao cadastro restaurado');
select ok((select latitude is null from public.producers where id = '60000000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.producer_demands where producer_id = '60000000-0000-0000-0000-000000000001'),
  'desfazer: principal voltou exatamente como era');

select * from finish();
rollback;
