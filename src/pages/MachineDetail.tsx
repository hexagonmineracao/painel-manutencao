import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { MachineForm } from '../components/MachineForm'
import type { FuelRecord, Machine, MaintenanceRecord, MaintenanceType } from '../lib/database.types'

type HistoryItem =
  | ({ kind: 'maintenance' } & MaintenanceRecord)
  | ({ kind: 'fuel' } & FuelRecord)

function toInputValue(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function MachineDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    const [machineRes, maintenanceRes, fuelRes] = await Promise.all([
      supabase.from('machines').select('*').eq('id', id).returns<Machine[]>().single(),
      supabase
        .from('maintenance_records')
        .select('*')
        .eq('machine_id', id)
        .order('performed_at', { ascending: false })
        .returns<MaintenanceRecord[]>(),
      supabase
        .from('fuel_records')
        .select('*')
        .eq('machine_id', id)
        .order('recorded_at', { ascending: false })
        .returns<FuelRecord[]>(),
    ])

    setMachine(machineRes.data)

    const maintenanceItems: HistoryItem[] = (maintenanceRes.data ?? []).map((r) => ({
      kind: 'maintenance',
      ...r,
    }))
    const fuelItems: HistoryItem[] = (fuelRes.data ?? []).map((r) => ({ kind: 'fuel', ...r }))
    const combined = [...maintenanceItems, ...fuelItems].sort((a, b) => {
      const dateA = a.kind === 'maintenance' ? a.performed_at : a.recorded_at
      const dateB = b.kind === 'maintenance' ? b.performed_at : b.recorded_at
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })
    setHistory(combined)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleDelete() {
    if (!machine) return
    const confirmed = window.confirm(
      `Excluir "${machine.name}"? Isso vai apagar todo o histórico de manutenção e abastecimento dessa máquina. Essa ação não pode ser desfeita.`,
    )
    if (!confirmed) return
    setDeleting(true)
    const { error } = await supabase.from('machines').delete().eq('id', machine.id)
    setDeleting(false)
    if (error) {
      alert(error.message)
      return
    }
    navigate('/machines')
  }

  async function handleDeleteHistoryItem(item: HistoryItem) {
    const confirmed = window.confirm('Excluir esse registro? Essa ação não pode ser desfeita.')
    if (!confirmed) return
    const table = item.kind === 'maintenance' ? 'maintenance_records' : 'fuel_records'
    const { error } = await supabase.from(table).delete().eq('id', item.id)
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  if (loading) return <p className="text-slate-500">Carregando...</p>
  if (!machine) return <p className="text-slate-500">Máquina não encontrada.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/machines" className="text-sm text-slate-500 hover:underline">
            ← Máquinas
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-1">{machine.name}</h1>
          <p className="text-sm text-slate-500">
            {machine.model} · nº {machine.number} · horímetro atual: {machine.current_hourmeter} h
          </p>
        </div>
        {profile?.role === 'admin' && !editing && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-slate-500 underline hover:text-slate-900"
            >
              Editar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <MachineForm
          initial={machine}
          onSaved={() => {
            setEditing(false)
            load()
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to={`/machines/${machine.id}/maintenance/new`}
          className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-400 text-center"
        >
          <p className="font-medium text-slate-900">Registrar manutenção</p>
          <p className="text-sm text-slate-500 mt-1">O que foi feito, quando, horímetro</p>
        </Link>
        <Link
          to={`/machines/${machine.id}/fuel/new`}
          className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-400 text-center"
        >
          <p className="font-medium text-slate-900">Registrar abastecimento</p>
          <p className="text-sm text-slate-500 mt-1">Data, horímetro, litros</p>
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900">
          Histórico
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">Nenhum registro ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="px-4 py-3 text-sm">
                {editingItem === item ? (
                  item.kind === 'maintenance' ? (
                    <MaintenanceEditForm
                      item={item}
                      onSaved={() => {
                        setEditingItem(null)
                        load()
                      }}
                      onCancel={() => setEditingItem(null)}
                    />
                  ) : (
                    <FuelEditForm
                      item={item}
                      onSaved={() => {
                        setEditingItem(null)
                        load()
                      }}
                      onCancel={() => setEditingItem(null)}
                    />
                  )
                ) : item.kind === 'maintenance' ? (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        Manutenção ({item.type}) — {item.description}
                      </p>
                      <p className="text-slate-500">
                        {new Date(item.performed_at).toLocaleString('pt-BR')} · horímetro{' '}
                        {item.hourmeter} h
                        {item.next_due_hourmeter != null &&
                          ` · próxima em ${item.next_due_hourmeter} h`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.cost != null && (
                        <span className="text-slate-500 whitespace-nowrap">
                          R$ {Number(item.cost).toFixed(2)}
                        </span>
                      )}
                      {profile?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="text-xs text-slate-500 underline hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteHistoryItem(item)}
                            className="text-xs text-red-600 underline hover:text-red-800"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">Abastecimento</p>
                      <p className="text-slate-500">
                        {new Date(item.recorded_at).toLocaleString('pt-BR')} · horímetro{' '}
                        {item.hourmeter} h · {item.liters} L
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.cost != null && (
                        <span className="text-slate-500 whitespace-nowrap">
                          R$ {Number(item.cost).toFixed(2)}
                        </span>
                      )}
                      {profile?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="text-xs text-slate-500 underline hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteHistoryItem(item)}
                            className="text-xs text-red-600 underline hover:text-red-800"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function MaintenanceEditForm({
  item,
  onSaved,
  onCancel,
}: {
  item: MaintenanceRecord
  onSaved: () => void
  onCancel: () => void
}) {
  const [performedAt, setPerformedAt] = useState(toInputValue(item.performed_at))
  const [hourmeter, setHourmeter] = useState(String(item.hourmeter))
  const [type, setType] = useState<MaintenanceType>(item.type)
  const [description, setDescription] = useState(item.description)
  const [nextDueHourmeter, setNextDueHourmeter] = useState(
    item.next_due_hourmeter != null ? String(item.next_due_hourmeter) : '',
  )
  const [cost, setCost] = useState(item.cost != null ? String(item.cost) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase
      .from('maintenance_records')
      .update({
        performed_at: new Date(performedAt).toISOString(),
        hourmeter: Number(hourmeter),
        type,
        description,
        cost: cost ? Number(cost) : null,
        next_due_hourmeter: nextDueHourmeter ? Number(nextDueHourmeter) : null,
      })
      .eq('id', item.id)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Data e hora</label>
        <input
          type="datetime-local"
          required
          value={performedAt}
          onChange={(e) => setPerformedAt(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Horímetro (h)</label>
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
        <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
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
      <div className="sm:col-span-3">
        <label className="block text-xs font-medium text-slate-700 mb-1">O que foi feito</label>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Próximo horímetro previsto</label>
        <input
          type="number"
          step="0.1"
          value={nextDueHourmeter}
          onChange={(e) => setNextDueHourmeter(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Custo (R$)</label>
        <input
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
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
          {submitting ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 px-2">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function FuelEditForm({
  item,
  onSaved,
  onCancel,
}: {
  item: FuelRecord
  onSaved: () => void
  onCancel: () => void
}) {
  const [recordedAt, setRecordedAt] = useState(toInputValue(item.recorded_at))
  const [hourmeter, setHourmeter] = useState(String(item.hourmeter))
  const [liters, setLiters] = useState(String(item.liters))
  const [cost, setCost] = useState(item.cost != null ? String(item.cost) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase
      .from('fuel_records')
      .update({
        recorded_at: new Date(recordedAt).toISOString(),
        hourmeter: Number(hourmeter),
        liters: Number(liters),
        cost: cost ? Number(cost) : null,
      })
      .eq('id', item.id)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Data e hora</label>
        <input
          type="datetime-local"
          required
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Horímetro (h)</label>
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
        <label className="block text-xs font-medium text-slate-700 mb-1">Custo (R$)</label>
        <input
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      <div className="sm:col-span-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 px-2">
          Cancelar
        </button>
      </div>
    </form>
  )
}
