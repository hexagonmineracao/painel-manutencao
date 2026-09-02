# Painel de Manutenção

Painel web para gestão de manutenção, controle de combustível e horímetro de máquinas (escavadeiras e similares).

- Cadastro de máquinas (modelo, nome/apelido, número)
- Registro de manutenções (o que foi feito, quando, horímetro, custo)
- Registro de abastecimento e horímetro (data/hora, litros, custo)
- Relatórios de consumo de combustível e manutenções, gerais e por máquina
- Alertas de manutenção preventiva com base no intervalo de horímetro
- Login por email/senha, com dois papéis: `admin` (gerencia máquinas e usuários) e `colaborador` (mecânico/operador, registra manutenções e abastecimentos)

## Stack

- [Vite](https://vite.dev) + React + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security, Edge Functions)
- Deploy estático no GitHub Pages via GitHub Actions

## Configuração do Supabase

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Rode a migration em `supabase/migrations/0001_init.sql` no **SQL Editor** do painel Supabase (ou via `supabase db push`, se tiver o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e o projeto linkado).
3. Deploy da Edge Function que cria novos usuários (usada pela tela "Usuários"):
   ```bash
   supabase functions deploy create-user
   ```
4. Crie o primeiro usuário administrador:
   - Vá em **Authentication > Users** no painel Supabase e crie um usuário com email/senha.
   - No **SQL Editor**, rode (substituindo o UUID pelo do usuário criado):
     ```sql
     insert into profiles (id, full_name, role)
     values ('UUID-DO-USUARIO', 'Seu Nome', 'admin');
     ```
   - Os próximos usuários (mecânicos/colaboradores) podem ser criados direto pela tela "Usuários" do painel, já logado como admin.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a anon key do seu projeto Supabase
npm run dev
```

## Deploy (GitHub Pages)

1. No repositório do GitHub, vá em **Settings > Pages** e selecione a fonte "GitHub Actions".
2. Em **Settings > Secrets and variables > Actions**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Todo push na branch `main` publica automaticamente via o workflow em `.github/workflows/deploy.yml`.
