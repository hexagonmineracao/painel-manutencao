-- Combustível passa a funcionar como o Estoque de materiais: um catálogo de
-- "tipos" (Diesel, Arla 32 etc.), cada um com seu próprio controle de
-- entrada/saída e saldo — em vez de um único "tanque" fixo.
create table fuel_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'L',
  min_stock numeric,
  initial_liters numeric not null default 0,
  initial_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table fuel_types enable row level security;

create policy "fuel_types: select autenticado" on fuel_types
  for select to authenticated
  using (true);

create policy "fuel_types: insert autenticado" on fuel_types
  for insert to authenticated
  with check (true);

create policy "fuel_types: admin atualiza" on fuel_types
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "fuel_types: admin exclui" on fuel_types
  for delete to authenticated
  using (is_admin());

-- Cria o tipo padrão "Diesel" e vincula tudo que já existe a ele.
insert into fuel_types (name, unit) values ('Diesel', 'L');

alter table fuel_deliveries add column fuel_type_id uuid references fuel_types (id);
alter table fuel_records add column fuel_type_id uuid references fuel_types (id);

update fuel_deliveries set fuel_type_id = (select id from fuel_types where name = 'Diesel')
  where fuel_type_id is null;
update fuel_records set fuel_type_id = (select id from fuel_types where name = 'Diesel')
  where fuel_type_id is null;

alter table fuel_deliveries alter column fuel_type_id set not null;
alter table fuel_records alter column fuel_type_id set not null;

-- Estoque de referência agora é por tipo de combustível (fuel_types acima),
-- não um valor único de "tanque principal".
drop table tank_settings;
