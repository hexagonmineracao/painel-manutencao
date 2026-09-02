-- Dispensa de alertas (manutenção preventiva e anomalia de consumo), com
-- opção de "resolvido" (permanente até o alerta mudar de causa) ou
-- "lembrar depois" (remind_at). alert_key é determinístico e muda quando
-- a causa do alerta muda (ex: novo registro de manutenção), então uma
-- dispensa antiga fica automaticamente obsoleta sem precisar limpar nada.
create table alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  dismissed_by uuid not null references profiles (id),
  dismissed_at timestamptz not null default now(),
  remind_at timestamptz
);

create index alert_dismissals_key_idx on alert_dismissals (alert_key, dismissed_at desc);

alter table alert_dismissals enable row level security;

create policy "alert_dismissals: select autenticado" on alert_dismissals
  for select to authenticated
  using (true);

create policy "alert_dismissals: insert autenticado" on alert_dismissals
  for insert to authenticated
  with check (dismissed_by = auth.uid());

-- Estoque do tanque principal: um "estoque inicial" de referência a partir
-- do qual somamos entradas e subtraímos saídas para saber o saldo atual.
create table tank_settings (
  id smallint primary key default 1,
  initial_liters numeric not null default 0,
  initial_date timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tank_settings_singleton check (id = 1)
);

insert into tank_settings (id, initial_liters, initial_date) values (1, 0, now());

alter table tank_settings enable row level security;

create policy "tank_settings: select autenticado" on tank_settings
  for select to authenticated
  using (true);

create policy "tank_settings: admin atualiza" on tank_settings
  for update to authenticated
  using (is_admin())
  with check (is_admin());
