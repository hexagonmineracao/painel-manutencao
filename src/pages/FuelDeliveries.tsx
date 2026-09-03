import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { exportToCsv } from '../lib/csv'
import type { FuelDelivery, TankSettings } from '../lib/database.types'

function nowForInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function FuelDeliveries() {
  const { profile } = useAuth()
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([])
  const [tankSettings, setTankSettings] = useState<TankSettings | null>(null)
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [deliveriesRes, settingsRes] = await Promise.all([
      supabase
        .from('fuel_deliveries')
        .select('*')
        .order('delivered_at', { ascending: false })
        .returns<FuelDelivery[]>(),
      supabase.from('tank_settings').select('*').eq('id', 1).returns<TankSettings[]>().single(),
    ])
    const deliveries = deliveriesRes.data ?? []
    setDeliveries(deliveries)
    const settings = settingsRes.data
    setTankSettings(settings)

    if (settings) {
      const since = settings.initial_date
      const [deliveredSince, consumedSince] = await Promise.all([
        supabase
          .from('fuel_deliveries')
          .select('liters')
          .gte('delivered_at', since)
          .returns<Array<{ liters: number }>>(),
        supabase
          .from('fuel_records')
          .select('liters')
          .gte('recorded_at', since)
          .returns<Array<{ liters: number }>>(),
      ])
      const totalIn = (deliveredSince.data ?? []).reduce((s, r) => s + Number(r.liters), 0)
      const totalOut = (consumedSince.data ?? []).reduce((s, r) => s + Number(r.liters), 0)
      setCurrentStock(Number(settings.initial_liters) + totalIn - totalOut)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function handleExport() {
    exportToCsv(
      'entradas_combustivel',
      ['Data', 'Litros', 'Valor total', 'R$/L', 'Fornecedor', 'Observações'],
      deliveries.map((d) => [
        new Date(d.delivered_at).toLocaleString('pt-BR'),
        Number(d.liters).toFixed(1),
        Number(d.total_cost).toFixed(2),
        (Number(d.total_cost) / Number(d.liters)).toFixed(3),
        d.supplier ?? '',
        d.notes ?? '',
      ]),
    )
  }

  async function handleDelete(delivery: FuelDelivery) {
    const confirmed = window.confirm('Excluir essa entrada de combustível? Essa ação não pode ser desfeita.')
    if (!confirmed) return
    const { error } = await supabase.from('fuel_deliveries').delete().eq('id', delivery.id)
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Entrada de combustível</h1>
          <p className="text-sm text-slate-500">Recebimento de diesel no tanque principal</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="bg-white border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-50"
          >
            Exportar CSV
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-brand-dark"
          >
            {showForm ? 'Cancelar' : 'Nova entrada'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Estoque atual estimado do tanque</p>
          <p className="text-2xl font-semibold text-slate-900">
            {currentStock != null ? `${currentStock.toFixed(0)} L` : '—'}
          </p>
          {tankSettings && (
            <p className="text-xs text-slate-400">
              Referência: {Number(tankSettings.initial_liters).toFixed(0)} L em{' '}
              {new Date(tankSettings.initial_date).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="text-sm text-slate-500 underline hover:text-slate-900"
          >
            {showSettings ? 'Cancelar' : 'Configurar estoque inicial'}
          </button>
        )}
      </div>

      {showSettings && tankSettings && (
        <TankSettingsForm
          settings={tankSettings}
          onSaved={() => {
            setShowSettings(false)
            load()
          }}
        />
      )}

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
            <div key={d.id}>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {d.liters.toFixed(1)} L {d.supplier ? `· ${d.supplier}` : ''}
                  </p>
                  <p className="text-slate-500">
                    {new Date(d.delivered_at).toLocaleString('pt-BR')} · R${' '}
                    {(d.total_cost / d.liters).toFixed(3)}/L
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 whitespace-nowrap">
                    R$ {Number(d.total_cost).toFixed(2)}
                  </span>
                  {profile?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => setEditingId(editingId === d.id ? null : d.id)}
                        className="text-xs text-slate-500 underline hover:text-slate-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        className="text-xs text-red-600 underline hover:text-red-800"
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editingId === d.id && (
                <div className="px-4 pb-4">
                  <DeliveryForm
                    initial={d}
                    onCreated={() => {
                      setEditingId(null)
                      load()
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TankSettingsForm({ settings, onSaved }: { settings: TankSettings; onSaved: () => void }) {
  const [liters, setLiters] = useState(String(settings.initial_liters))
  const [date, setDate] = useState(settings.initial_date.slice(0, 16))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase
      .from('tank_settings')
      .update({
        initial_liters: Number(liters),
        initial_date: new Date(date).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
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
      className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Estoque de referência (L)</label>
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
        <label className="block text-xs font-medium text-slate-700 mb-1">A partir de</label>
        <input
          type="datetime-local"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      <p className="text-xs text-slate-400 sm:col-span-3">
        O estoque atual é calculado a partir daqui: valor de referência + entradas − saídas desde essa data.
      </p>
    </form>
  )
}

function DeliveryForm({
  initial,
  onCreated,
  onCancel,
}: {
  initial?: FuelDelivery
  onCreated: () => void
  onCancel?: () => void
}) {
  const { session } = useAuth()
  const [deliveredAt, setDeliveredAt] = useState(
    initial ? initial.delivered_at.slice(0, 16) : nowForInput(),
  )
  const [liters, setLiters] = useState(initial ? String(initial.liters) : '')
  const [totalCost, setTotalCost] = useState(initial ? String(initial.total_cost) : '')
  const [supplier, setSupplier] = useState(initial?.supplier ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSubmitting(true)
    setError(null)

    const payload = {
      delivered_at: new Date(deliveredAt).toISOString(),
      liters: Number(liters),
      total_cost: Number(totalCost),
      supplier: supplier || null,
      notes: notes || null,
    }

    const { error } = initial
      ? await supabase.from('fuel_deliveries').update(payload).eq('id', initial.id)
      : await supabase.from('fuel_deliveries').insert({ ...payload, user_id: session.user.id })

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
      <div className="sm:col-span-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Salvar entrada'}
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
