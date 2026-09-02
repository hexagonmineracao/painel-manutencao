import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile, Role } from '../lib/database.types'

export function Users() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name').returns<Profile[]>()
    setProfiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Usuários</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-800"
        >
          {showForm ? 'Cancelar' : 'Novo usuário'}
        </button>
      </div>

      {showForm && (
        <UserForm
          onCreated={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {profiles.map((p) => (
            <div key={p.id}>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-slate-900">{p.full_name}</span>
                  <span className="text-slate-400 ml-2">@{p.username}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 capitalize">{p.role}</span>
                  <button
                    onClick={() => setResettingId(resettingId === p.id ? null : p.id)}
                    className="text-slate-500 hover:text-slate-900 text-xs underline"
                  >
                    Redefinir senha
                  </button>
                </div>
              </div>
              {resettingId === p.id && (
                <ResetPasswordForm userId={p.id} onDone={() => setResettingId(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.functions.invoke('reset-password', {
      body: { user_id: userId, password },
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setSuccess(true)
    setPassword('')
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-3 flex items-end gap-2 bg-slate-50">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Nova senha</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-md hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? 'Salvando...' : 'Salvar'}
      </button>
      <button type="button" onClick={onDone} className="text-sm text-slate-500 px-2">
        Fechar
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Senha redefinida.</p>}
    </form>
  )
}

function UserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('colaborador')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.functions.invoke('create-user', {
      body: { username, password, full_name: fullName, role },
    })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    onCreated()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Usuário</label>
        <input
          required
          pattern="[a-zA-Z0-9._-]+"
          title="Sem espaços ou acentos. Ex: joao.silva"
          placeholder="joao.silva"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Senha provisória</label>
        <input
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Função</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="colaborador">Colaborador (mecânico/operador)</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-5">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Criando...' : 'Criar'}
        </button>
      </div>
    </form>
  )
}
