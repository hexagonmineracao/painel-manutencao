-- Login por usuário em vez de email. O Supabase Auth exige um email
-- internamente, então usamos um domínio sintético (usuario@painel.local)
-- que nunca é usado para enviar nada de verdade — só serve de identificador.

alter table profiles add column username text;

update profiles set username = 'thales' where username is null;

alter table profiles alter column username set not null;
alter table profiles add constraint profiles_username_key unique (username);
