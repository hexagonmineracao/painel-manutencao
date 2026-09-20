-- Grupos de máquinas (empresa própria x terceirizadas). Cadastro de grupo é
-- só admin pra não repetir o problema de duplicidade que aconteceu com
-- máquinas (cadastro aberto a todos gerou nomes repetidos/variados); atribuir
-- o grupo a uma máquina continua acessível a quem cria/edita a máquina.
create table machine_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table machine_groups enable row level security;

create policy "machine_groups: select autenticado" on machine_groups
  for select to authenticated
  using (true);

create policy "machine_groups: admin insere" on machine_groups
  for insert to authenticated
  with check (is_admin());

create policy "machine_groups: admin atualiza" on machine_groups
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "machine_groups: admin exclui" on machine_groups
  for delete to authenticated
  using (is_admin());

alter table machines add column group_id uuid references machine_groups (id) on delete set null;
