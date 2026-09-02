// Login é por usuário, não por email — mas o Supabase Auth exige um email
// internamente, então cada usuário recebe um email sintético neste domínio,
// que nunca é usado para enviar nada de verdade.
export const LOGIN_DOMAIN = 'painel.local'

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`
}
