-- Entrada de combustível no tanque principal (recebimento de diesel).
-- Não há checagem de saldo/negativo de propósito: pode haver diferença
-- entre entrada e saída (medição, evaporação, etc.) e isso deve aparecer
-- no relatório como "quebra", não ser bloqueado no cadastro.

create table fuel_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id),
  delivered_at timestamptz not null,
  liters numeric not null,
  total_cost numeric not null,
  supplier text,
  notes text,
  created_at timestamptz not null default now()
);

create index fuel_deliveries_delivered_at_idx on fuel_deliveries (delivered_at);

alter table fuel_deliveries enable row level security;

create policy "fuel_deliveries: select autenticado" on fuel_deliveries
  for select to authenticated
  using (true);

create policy "fuel_deliveries: insert autenticado" on fuel_deliveries
  for insert to authenticated
  with check (user_id = auth.uid());
