import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

function nowForInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function NewFuelRecord() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [recordedAt, setRecordedAt] = useState(nowForInput())
  const [hourmeter, setHourmeter] = useState('')
  const [liters, setLiters] = useState('')
  const [cost, setCost] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id || !session) return
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.from('fuel_records').insert({
      machine_id: id,
      user_id: session.user.id,
      recorded_at: new Date(recordedAt).toISOString(),
      hourmeter: Number(hourmeter),
      liters: Number(liters),
      cost: cost ? Number(cost) : null,
    })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/machines/${id}`)
  }

  return (
    <div className="max-w-lg space-y-4">
      <Link to={`/machines/${id}`} className="text-sm text-slate-500 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold text-slate-900">Registrar abastecimento</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data e hora</label>
          <input
            type="datetime-local"
            required
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Horímetro (h)</label>
          <input
            type="number"
            step="0.1"
            required
            value={hourmeter}
            onChange={(e) => setHourmeter(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Combustível (litros)</label>
          <input
            type="number"
            step="0.01"
            required
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Custo (R$, opcional)</label>
          <input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
