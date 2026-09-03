-- Cadastro de máquina passa a ser aberto a qualquer usuário autenticado;
-- editar/excluir continua só para admin.
drop policy "machines: admin gerencia" on machines;

create policy "machines: insert autenticado" on machines
  for insert to authenticated
  with check (true);

create policy "machines: admin atualiza" on machines
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "machines: admin exclui" on machines
  for delete to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- Estoque de materiais (filtros, óleos, etc.) — mesmo padrão do combustível:
-- catálogo simples + movimentações, saldo calculado (entradas - saídas), sem
-- campo de saldo persistido.
-- ---------------------------------------------------------------------------
create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  min_stock numeric,
  created_at timestamptz not null default now()
);

alter table materials enable row level security;

create policy "materials: select autenticado" on materials
  for select to authenticated
  using (true);

create policy "materials: insert autenticado" on materials
  for insert to authenticated
  with check (true);

create policy "materials: admin atualiza" on materials
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "materials: admin exclui" on materials
  for delete to authenticated
  using (is_admin());

create table material_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete cascade,
  machine_id uuid references machines (id) on delete set null,
  user_id uuid not null references profiles (id),
  type text not null check (type in ('entrada', 'saida')),
  quantity numeric not null,
  cost numeric,
  moved_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create index material_movements_material_id_idx on material_movements (material_id);

alter table material_movements enable row level security;

create policy "material_movements: select autenticado" on material_movements
  for select to authenticated
  using (true);

create policy "material_movements: insert autenticado" on material_movements
  for insert to authenticated
  with check (user_id = auth.uid());
