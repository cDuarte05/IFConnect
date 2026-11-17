-- docs/banco/rls.sql
-- Habilitação de Row Level Security (RLS) no Supabase / PostgreSQL para o IFConnect.
--
-- O Supabase expõe por padrão uma API REST pública (PostgREST / Data API).
-- Este script ativa o RLS em todas as tabelas públicas da aplicação, garantindo
-- que acessos anônimos diretos pelo frontend ou por terceiros à Data API do Supabase
-- sejam bloqueados, e que apenas conexões autorizadas do backend (via service_role / pooler)
-- consigam ler e gravar dados.
--
-- Execução: Copie e cole este bloco no SQL Editor do Dashboard do Supabase.

do $$
declare
  t text;
  tabelas text[] := array[
    'users',
    'categories',
    'articles',
    'campaigns',
    'donations',
    'comments',
    'agente_chunks'
  ];
begin
  foreach t in array tabelas loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) then
      execute format('alter table public.%I enable row level security;', t);
      raise notice 'RLS habilitado com sucesso para a tabela: %', t;
    end if;
  end loop;
end $$;
