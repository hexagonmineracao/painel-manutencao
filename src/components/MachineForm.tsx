import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Machine } from '../lib/database.types'

export function MachineForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Machine
  onSaved: () => void
  onCancel?: () => void
}) {
  const [model, setModel] = useState(initial?.model ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [number, setNumber] = useState(initial?.number ?? '')
  const [interval, setInterval] = useState(
    initial?.maintenance_interval_hours != null ? String(initial.maintenance_interval_hours) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      model,
      name,
      number,
      maintenance_interval_hours: interval ? Number(interval) : null,
    }

    const { error } = initial
      ? await supabase.from('machines').update(payload).eq('id', initial.id)
      : await supabase.from('machines').insert(payload)

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
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
        <label className="block text-xs font-medium text-slate-700 mb-1">Intervalo padrão (h)</label>
        <input
          type="number"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          placeholder="Opcional"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-slate-400 sm:col-span-4">
        Usado só quando o mecânico não informa "próximo horímetro previsto" ao registrar a manutenção.
      </p>
      {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      <div className="sm:col-span-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Salvar máquina'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 px-2">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
