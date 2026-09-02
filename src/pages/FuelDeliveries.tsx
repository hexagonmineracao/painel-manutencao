import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { FuelDelivery } from '../lib/database.types'

function nowForInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function FuelDeliveries() {
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('fuel_deliveries')
      .select('*')
      .order('delivered_at', { ascending: false })
      .returns<FuelDelivery[]>()
    setDeliveries(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Entrada de combustível</h1>
          <p className="text-sm text-slate-500">Recebimento de diesel no tanque principal</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-800"
        >
          {showForm ? 'Cancelar' : 'Nova entrada'}
        </button>
      </div>

      {showForm && (
        <DeliveryForm
          onCreated={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : deliveries.length === 0 ? (
        <p className="text-slate-500">Nenhuma entrada registrada.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {deliveries.map((d) => (
            <div key={d.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {d.liters.toFixed(1)} L {d.supplier ? `· ${d.supplier}` : ''}
                </p>
                <p className="text-slate-500">
                  {new Date(d.delivered_at).toLocaleString('pt-BR')} · R${' '}
                  {(d.total_cost / d.liters).toFixed(3)}/L
                </p>
              </div>
              <span className="text-slate-500 whitespace-nowrap">
                R$ {Number(d.total_cost).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeliveryForm({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuth()
  const [deliveredAt, setDeliveredAt] = useState(nowForInput())
  const [liters, setLiters] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.from('fuel_deliveries').insert({
      user_id: session.user.id,
      delivered_at: new Date(deliveredAt).toISOString(),
      liters: Number(liters),
      total_cost: Number(totalCost),
      supplier: supplier || null,
      notes: notes || null,
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
      className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Data e hora</label>
        <input
          type="datetime-local"
          required
          value={deliveredAt}
          onChange={(e) => setDeliveredAt(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Litros</label>
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
        <label className="block text-xs font-medium text-slate-700 mb-1">Valor total (R$)</label>
        <input
          type="number"
          step="0.01"
          required
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Fornecedor (opcional)</label>
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Observações (nota fiscal, etc.)
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Salvar entrada'}
        </button>
      </div>
    </form>
  )
}
