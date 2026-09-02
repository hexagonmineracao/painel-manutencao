-- Painel de Gestão de Manutenção, Combustível e Horímetro
-- Schema inicial: profiles, machines, maintenance_records, fuel_records + RLS

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'colaborador')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: select próprio ou admin" on profiles
  for select to authenticated
  using (true);

create policy "profiles: admin gerencia" on profiles
  for all to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------
create table machines (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  name text not null,
  number text not null unique,
  current_hourmeter numeric not null default 0,
  maintenance_interval_hours numeric,
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);

alter table machines enable row level security;

create policy "machines: select autenticado" on machines
  for select to authenticated
  using (true);

create policy "machines: admin gerencia" on machines
  for all to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- maintenance_records
-- ---------------------------------------------------------------------------
create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  user_id uuid not null references profiles (id),
  performed_at timestamptz not null,
  hourmeter numeric not null,
  type text not null check (type in ('preventiva', 'corretiva', 'outro')),
  description text not null,
  cost numeric,
  created_at timestamptz not null default now()
);

create index maintenance_records_machine_id_idx on maintenance_records (machine_id);

alter table maintenance_records enable row level security;

create policy "maintenance_records: select autenticado" on maintenance_records
  for select to authenticated
  using (true);

create policy "maintenance_records: insert autenticado" on maintenance_records
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- fuel_records
-- ---------------------------------------------------------------------------
create table fuel_records (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  user_id uuid not null references profiles (id),
  recorded_at timestamptz not null,
  hourmeter numeric not null,
  liters numeric not null,
  cost numeric,
  created_at timestamptz not null default now()
);

create index fuel_records_machine_id_idx on fuel_records (machine_id);

alter table fuel_records enable row level security;

create policy "fuel_records: select autenticado" on fuel_records
  for select to authenticated
  using (true);

create policy "fuel_records: insert autenticado" on fuel_records
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Mantém machines.current_hourmeter sempre com a leitura mais recente
-- ---------------------------------------------------------------------------
create or replace function bump_machine_hourmeter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update machines
  set current_hourmeter = new.hourmeter
  where id = new.machine_id
    and new.hourmeter > current_hourmeter;
  return new;
end;
$$;

create trigger maintenance_records_bump_hourmeter
  after insert on maintenance_records
  for each row execute function bump_machine_hourmeter();

create trigger fuel_records_bump_hourmeter
  after insert on fuel_records
  for each row execute function bump_machine_hourmeter();
