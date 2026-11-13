-- Associações (etapa 1): estrutura, regras e permissões.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000019a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm19@teste.local', '{"name":"Admin 19"}'),
  ('00000000-0000-0000-0000-0000000019c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coo19@teste.local', '{"name":"Coord 19"}'),
  ('00000000-0000-0000-0000-0000000019d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ass19@teste.local', '{"name":"Assist 19"}'),
  ('00000000-0000-0000-0000-0000000019e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op19@teste.local', '{"name":"Op 19"}');
insert into public.profiles (id, email, name, job_title) values
  ('00000000-0000-0000-0000-0000000019a1', 'adm19@teste.local', 'Admin 19', 'Secretário'),
  ('00000000-0000-0000-0000-0000000019c1', 'coo19@teste.local', 'Coord 19', 'Coordenador'),
  ('00000000-0000-0000-0000-0000000019d1', 'ass19@teste.local', 'Assist 19', 'Assistente de Campo'),
  ('00000000-0000-0000-0000-0000000019e1', 'op19@teste.local', 'Op 19', null)
on conflict (id) do update set job_title = excluded.job_title;
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000019a1','00000000-0000-0000-0000-0000000019c1','00000000-0000-0000-0000-0000000019d1','00000000-0000-0000-0000-0000000019e1');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000019a1', 'admin'), ('00000000-0000-0000-0000-0000000019c1', 'admin'),
  ('00000000-0000-0000-0000-0000000019d1', 'admin'), ('00000000-0000-0000-0000-0000000019e1', 'operator');

insert into public.demand_types (id, name, category) values ('20000000-0000-0000-0000-0000000019a1', 'Grade Teste 19', 'patrulha_mecanizada');
insert into public.machinery (id, name, patrimony_number) values ('80000000-0000-0000-0000-0000000019a1', 'Trator Teste 19', 'PAT-19');

select is((select public from storage.buckets where id = 'associacoes'), false, 'bucket de associações é privado');
-- O banco de teste copia só a ESTRUTURA da produção (sem dados): o checklist
-- padrão (semente) pode não estar aqui. Garante o item usado no teste.
insert into public.associacao_checklist_itens (codigo, nome, categoria, tem_validade)
values ('cnd_federal', 'CND Federal', 'fiscal', true) on conflict (codigo) do nothing;
select ok((select count(*) from public.associacao_checklist_itens where codigo = 'cnd_federal') = 1, 'item do checklist disponível (código único)');

-- ─── Admin pleno ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
set local role authenticated;

insert into public.associacoes (id, nome, cnpj, situacao) values ('19000000-0000-0000-0000-000000000001', 'Associação Teste', '11222333000181', 'ativa');
select throws_ok($$ insert into public.associacoes (nome, cnpj) values ('Outra', '11222333000181') $$, '23505', null, 'CNPJ não se repete');
select throws_ok($$ insert into public.associacoes (nome, cnpj) values ('Formato', '11.222.333/0001-81') $$, '23514', null, 'CNPJ guardado só com números');
select throws_ok($$ insert into public.associacoes (nome, situacao) values ('X', 'suspensa') $$, '23514', null, 'situação só ativa/inativa/em regularização');

insert into public.associacao_documentos (associacao_id, item_id, titulo, data_validade)
select '19000000-0000-0000-0000-000000000001', id, 'CND Federal', current_date + 100 from public.associacao_checklist_itens where codigo = 'cnd_federal';
select is((select count(*)::int from public.associacao_documentos where associacao_id = '19000000-0000-0000-0000-000000000001'), 1, 'documento cadastrado');

insert into public.associacao_cessoes (associacao_id, machinery_id, data_cessao) values ('19000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-0000000019a1', current_date);
select throws_ok($$ insert into public.associacao_cessoes (associacao_id, machinery_id, data_cessao) values ('19000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-0000000019a1', current_date) $$,
  '23505', null, 'máquina não fica cedida duas vezes ao mesmo tempo');
update public.associacao_cessoes set data_devolucao = current_date where machinery_id = '80000000-0000-0000-0000-0000000019a1';
select lives_ok($$ insert into public.associacao_cessoes (associacao_id, machinery_id, data_cessao) values ('19000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-0000000019a1', current_date) $$,
  'depois de devolvida, pode ser cedida de novo');

select throws_ok($$ insert into public.associacao_atendimentos (associacao_id, demand_type_id, data_atendimento) values ('19000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000019a1', current_date) $$,
  '23514', null, 'atendimento exige o produtor (cadastro ou nome)');
select lives_ok($$ insert into public.associacao_atendimentos (associacao_id, demand_type_id, data_atendimento, produtor_nome, horas, area_ha, machinery_id) values ('19000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000019a1', current_date, 'Associado Teste', 3, 2, '80000000-0000-0000-0000-0000000019a1') $$,
  'atendimento da associação com associado sem cadastro');
reset role;

-- ─── Coordenador: consulta, não exclui ───────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.associacoes where id = '19000000-0000-0000-0000-000000000001'), 1, 'coordenador consulta');
delete from public.associacoes where id = '19000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.associacoes where id = '19000000-0000-0000-0000-000000000001'), 1, 'coordenador não exclui');

-- ─── Assistente de Campo e operador: sem acesso ──────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019d1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.associacoes), 0, 'assistente de campo não vê associações');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019e1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.associacao_atendimentos), 0, 'operador não vê atendimentos das associações');
reset role;

select * from finish();
rollback;
