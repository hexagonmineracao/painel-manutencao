// Edge Function: cria um novo usuário (auth + profile) a pedido de um admin.
// Necessário porque a criação de usuários exige a service role key, que nunca
// deve ficar exposta no frontend estático — ela só existe no runtime da function.
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Client autenticado como o chamador, só para checar se é admin.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()

  if (!caller) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Apenas administradores podem criar usuários' }), {
      status: 403,
    })
  }

  const { email, password, full_name, role } = await req.json()
  if (!email || !password || !full_name || !role) {
    return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    return new Response(JSON.stringify({ error: createError?.message ?? 'Falha ao criar usuário' }), {
      status: 400,
    })
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    full_name,
    role,
  })
  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 400 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
