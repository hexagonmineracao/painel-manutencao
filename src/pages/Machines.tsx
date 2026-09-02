import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { Machine } from '../lib/database.types'

export function Machines() {
  const { profile } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('machines').select('*').order('name').returns<Machine[]>()
    setMachines(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Máquinas</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-slate-900 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-800"
          >
            {showForm ? 'Cancelar' : 'Nova máquina'}
          </button>
        )}
      </div>

      {showForm && (
        <MachineForm
          onCreated={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : machines.length === 0 ? (
        <p className="text-slate-500">Nenhuma máquina cadastrada.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {machines.map((m) => (
            <Link
              key={m.id}
              to={`/machines/${m.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-sm text-slate-500">
                  {m.model} · nº {m.number}
                </p>
              </div>
              <span className="text-sm text-slate-500">{m.current_hourmeter} h</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MachineForm({ onCreated }: { onCreated: () => void }) {
  const [model, setModel] = useState('')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [interval, setInterval] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('machines').insert({
      model,
      name,
      number,
      maintenance_interval_hours: interval ? Number(interval) : null,
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
      className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Modelo</label>
        <input
          required
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Ex: CAT 320"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Nome/apelido</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Escavadeira 01"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Número/patrimônio</label>
        <input
          required
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Intervalo preventivo (h)
        </label>
        <input
          type="number"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          placeholder="Opcional"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      <div className="sm:col-span-4">
        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Salvar máquina'}
        </button>
      </div>
    </form>
  )
}
