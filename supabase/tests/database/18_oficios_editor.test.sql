-- Editor de ofícios: colunas de conteúdo opcionais e limite de tamanho.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_column('public', 'oficios', 'conteudo_html', 'ofício guarda o texto do editor');
select has_column('public', 'oficio_modelos', 'conteudo_html', 'modelo guarda o texto do editor');

insert into public.oficios (id, numero, data_oficio, destinatario, assunto, categoria, conteudo_html)
values ('18000000-0000-0000-0000-000000000001', 1, '2034-01-02', 'X', 'Y', 'Outros', '<p>Texto</p>');
select is((select conteudo_html from public.oficios where id = '18000000-0000-0000-0000-000000000001'), '<p>Texto</p>', 'texto salvo');

select throws_ok($$ update public.oficios set conteudo_html = repeat('a', 2000001) where id = '18000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'texto acima do limite é recusado');

select * from finish();
rollback;
