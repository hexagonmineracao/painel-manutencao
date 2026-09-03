-- Agora que manutenção/abastecimento podem ser editados ou excluídos, o
-- gatilho antigo (que só "empurrava" o horímetro pra cima em inserts) ficaria
-- desatualizado depois de uma edição ou exclusão. Troca por um recálculo
-- completo (maior horímetro entre os registros restantes da máquina) que
-- roda em insert, update e delete nas duas tabelas.
create or replace function recompute_machine_hourmeter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_machine_id uuid;
  max_hourmeter numeric;
begin
  target_machine_id := coalesce(new.machine_id, old.machine_id);

  select max(h) into max_hourmeter from (
    select hourmeter as h from maintenance_records where machine_id = target_machine_id
    union all
    select hourmeter as h from fuel_records where machine_id = target_machine_id
  ) readings;

  update machines set current_hourmeter = coalesce(max_hourmeter, 0) where id = target_machine_id;

  return coalesce(new, old);
end;
$$;

drop trigger maintenance_records_bump_hourmeter on maintenance_records;
drop trigger fuel_records_bump_hourmeter on fuel_records;

create trigger maintenance_records_recompute_hourmeter
  after insert or update or delete on maintenance_records
  for each row execute function recompute_machine_hourmeter();

create trigger fuel_records_recompute_hourmeter
  after insert or update or delete on fuel_records
  for each row execute function recompute_machine_hourmeter();
