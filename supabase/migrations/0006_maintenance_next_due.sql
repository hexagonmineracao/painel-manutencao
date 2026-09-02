-- Permite que cada registro de manutenção defina o próprio "próximo
-- horímetro previsto", em vez de depender só do intervalo fixo da máquina
-- (que não dá conta de manutenções com prazos diferentes: óleo, filtro, etc.)
alter table maintenance_records add column next_due_hourmeter numeric;
