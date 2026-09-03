import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { MaintenanceType } from '../lib/database.types'

function nowForInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function NewMaintenance() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [performedAt, setPerformedAt] = useState(nowForInput())
  const [hourmeter, setHourmeter] = useState('')
  const [type, setType] = useState<MaintenanceType>('preventiva')
  const [description, setDescription] = useState('')
  const [nextDueHourmeter, setNextDueHourmeter] = useState('')
  const [cost, setCost] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id || !session) return
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.from('maintenance_records').insert({
      machine_id: id,
      user_id: session.user.id,
      performed_at: new Date(performedAt).toISOString(),
      hourmeter: Number(hourmeter),
      type,
      description,
      cost: cost ? Number(cost) : null,
      next_due_hourmeter: nextDueHourmeter ? Number(nextDueHourmeter) : null,
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
      <h1 className="text-xl font-semibold text-slate-900">Registrar manutenção</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data e hora</label>
          <input
            type="datetime-local"
            required
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MaintenanceType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="preventiva">Preventiva</option>
            <option value="corretiva">Corretiva</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">O que foi feito</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Próximo horímetro previsto (opcional)
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="Ex: 1450 — deixe em branco para usar o intervalo padrão da máquina"
            value={nextDueHourmeter}
            onChange={(e) => setNextDueHourmeter(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            Em qual horímetro essa manutenção precisa ser feita de novo. Se informado, esse valor manda
            no alerta de manutenção preventiva em vez do intervalo padrão da máquina.
          </p>
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
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
