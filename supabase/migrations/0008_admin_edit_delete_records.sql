-- Admin quer liberdade total pra corrigir qualquer lançamento (manutenção,
-- abastecimento, entrada de combustível, movimentação de estoque), não só
-- criar. Até aqui essas tabelas só tinham select/insert.
create policy "maintenance_records: admin atualiza" on maintenance_records
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "maintenance_records: admin exclui" on maintenance_records
  for delete to authenticated
  using (is_admin());

create policy "fuel_records: admin atualiza" on fuel_records
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "fuel_records: admin exclui" on fuel_records
  for delete to authenticated
  using (is_admin());

create policy "fuel_deliveries: admin atualiza" on fuel_deliveries
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "fuel_deliveries: admin exclui" on fuel_deliveries
  for delete to authenticated
  using (is_admin());

create policy "material_movements: admin atualiza" on material_movements
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "material_movements: admin exclui" on material_movements
  for delete to authenticated
  using (is_admin());
