-- Corrige "infinite recursion detected in policy for relation profiles":
-- as políticas de admin consultavam a própria tabela profiles, o que
-- reativa a checagem de RLS recursivamente. A solução padrão do Supabase
-- é mover essa checagem para uma função security definer, que roda como
-- dono da tabela e portanto não passa pelas políticas de RLS de novo.

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

drop policy "profiles: admin gerencia" on profiles;
create policy "profiles: admin gerencia" on profiles
  for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy "machines: admin gerencia" on machines;
create policy "machines: admin gerencia" on machines
  for all to authenticated
  using (is_admin())
  with check (is_admin());
