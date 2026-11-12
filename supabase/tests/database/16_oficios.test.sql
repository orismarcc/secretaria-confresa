-- Ofícios: numeração por ano sem duplicidade, histórico de arquivos e
-- permissões (equipe interna; Assistente/operador não; Coordenador não exclui).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000016a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm16@teste.local', '{"name":"Admin 16"}'),
  ('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coo16@teste.local', '{"name":"Coord 16"}'),
  ('00000000-0000-0000-0000-0000000016d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ass16@teste.local', '{"name":"Assist 16"}'),
  ('00000000-0000-0000-0000-0000000016e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op16@teste.local', '{"name":"Op 16"}');
insert into public.profiles (id, email, name, job_title) values
  ('00000000-0000-0000-0000-0000000016a1', 'adm16@teste.local', 'Admin 16', 'Secretário'),
  ('00000000-0000-0000-0000-0000000016c1', 'coo16@teste.local', 'Coord 16', 'Coordenador'),
  ('00000000-0000-0000-0000-0000000016d1', 'ass16@teste.local', 'Assist 16', 'Assistente de Campo'),
  ('00000000-0000-0000-0000-0000000016e1', 'op16@teste.local', 'Op 16', null)
on conflict (id) do update set job_title = excluded.job_title;
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000016a1','00000000-0000-0000-0000-0000000016c1','00000000-0000-0000-0000-0000000016d1','00000000-0000-0000-0000-0000000016e1');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000016a1', 'admin'),
  ('00000000-0000-0000-0000-0000000016c1', 'admin'),
  ('00000000-0000-0000-0000-0000000016d1', 'admin'),
  ('00000000-0000-0000-0000-0000000016e1', 'operator');

select is((select public from storage.buckets where id = 'oficios'), false, 'bucket de ofícios é privado');

-- ─── Admin pleno ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);
set local role authenticated;

insert into public.oficios (id, data_oficio, destinatario, assunto, categoria)
values ('16000000-0000-0000-0000-000000000001', '2031-03-10', 'Sec. de Finanças', 'Teste A', 'Solicitação');
insert into public.oficios (id, data_oficio, destinatario, assunto, categoria)
values ('16000000-0000-0000-0000-000000000002', '2031-04-01', 'Câmara', 'Teste B', 'Solicitação');
select is((select numero from public.oficios where id = '16000000-0000-0000-0000-000000000001'), 1, 'primeiro ofício do ano recebe o nº 1');
select is((select numero from public.oficios where id = '16000000-0000-0000-0000-000000000002'), 2, 'segundo recebe o nº 2 (sequencial)');
select is((select ano from public.oficios where id = '16000000-0000-0000-0000-000000000001'), 2031, 'ano vem da data do ofício');
select is(public.proximo_numero_oficio(2031), 3, 'próximo número sugerido do ano');

insert into public.oficios (id, data_oficio, destinatario, assunto, categoria)
values ('16000000-0000-0000-0000-000000000003', '2032-01-05', 'Câmara', 'Ano novo', 'Solicitação');
select is((select numero from public.oficios where id = '16000000-0000-0000-0000-000000000003'), 1, 'numeração recomeça a cada ano');

select throws_ok($$ insert into public.oficios (numero, data_oficio, destinatario, assunto, categoria) values (2, '2031-07-01', 'X', 'Dup', 'Solicitação') $$,
  '23505', null, 'número repetido no mesmo ano é recusado');
select lives_ok($$ insert into public.oficios (numero, data_oficio, destinatario, assunto, categoria) values (10, '2031-07-01', 'X', 'Manual', 'Solicitação') $$,
  'número informado manualmente (livre) é aceito');

-- arquivo assinado: versões
select is(public.registrar_arquivo_oficio('16000000-0000-0000-0000-000000000001', 'of/1/v1.pdf', 'v1.pdf', 100, null), 1, 'primeiro PDF = versão 1');
select is(public.registrar_arquivo_oficio('16000000-0000-0000-0000-000000000001', 'of/1/v2.pdf', 'v2.pdf', 200, 'assinatura corrigida'), 2, 'substituição = versão 2');
select is((select arquivo_path from public.oficios where id = '16000000-0000-0000-0000-000000000001'), 'of/1/v2.pdf', 'ofício aponta para a versão atual');
select is((select count(*)::int from public.oficio_arquivos where oficio_id = '16000000-0000-0000-0000-000000000001'), 2, 'histórico guarda as duas versões');

update public.oficios set arquivo_path = 'outro.pdf', assunto = 'Teste A editado' where id = '16000000-0000-0000-0000-000000000001';
select is((select arquivo_path from public.oficios where id = '16000000-0000-0000-0000-000000000001'), 'of/1/v2.pdf', 'editar o ofício não troca o arquivo por fora do histórico');

update public.oficio_arquivos set arquivo_nome = 'x' where oficio_id = '16000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.oficio_arquivos where arquivo_nome = 'x'), 0, 'histórico não pode ser alterado');
reset role;

-- ─── Coordenador: consulta, mas não exclui ───────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016c1","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from public.oficios) >= 3, 'coordenador consulta os ofícios');
delete from public.oficios where id = '16000000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.oficios where id = '16000000-0000-0000-0000-000000000002'), 1, 'coordenador não exclui ofício');

-- ─── Assistente de Campo e operador: sem acesso ──────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016d1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.oficios), 0, 'assistente de campo não vê ofícios');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016e1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.oficios), 0, 'operador não vê ofícios');
reset role;

select * from finish();
rollback;
