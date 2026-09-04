import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { FuelDelivery, FuelRecord, FuelType, Machine } from '../lib/database.types'

// Remove acentos pra "Diesel" encontrar "Diesel S10" já cadastrado.
function normalize(s: string) {
  return s
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return !(code >= 0x0300 && code <= 0x036f)
    })
    .join('')
    .toLowerCase()
    .trim()
}

function nowForInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function toInputValue(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

type Movement =
  | ({ kind: 'entrada' } & FuelDelivery)
  | ({ kind: 'saida' } & FuelRecord)

export function Fuel() {
  const { profile } = useAuth()
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([])
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [typesRes, deliveriesRes, recordsRes, machinesRes] = await Promise.all([
      supabase.from('fuel_types').select('*').order('name').returns<FuelType[]>(),
      supabase
        .from('fuel_deliveries')
        .select('*')
        .order('delivered_at', { ascending: false })
        .returns<FuelDelivery[]>(),
      supabase
        .from('fuel_records')
        .select('*')
        .order('recorded_at', { ascending: false })
        .returns<FuelRecord[]>(),
      supabase.from('machines').select('*').order('name').returns<Machine[]>(),
    ])
    setFuelTypes(typesRes.data ?? [])
    setDeliveries(deliveriesRes.data ?? [])
    setRecords(recordsRes.data ?? [])
    setMachines(machinesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function balanceFor(type: FuelType) {
    const since = new Date(type.initial_date).getTime()
    const inSum = deliveries
      .filter((d) => d.fuel_type_id === type.id && new Date(d.delivered_at).getTime() >= since)
      .reduce((s, d) => s + Number(d.liters), 0)
    const outSum = records
      .filter((r) => r.fuel_type_id === type.id && new Date(r.recorded_at).getTime() >= since)
      .reduce((s, r) => s + Number(r.liters), 0)
    return Number(type.initial_liters) + inSum - outSum
  }

  async function handleDeleteType(type: FuelType) {
    const confirmed = window.confirm(
      `Excluir "${type.name}"? Isso também apaga todo o histórico de entrada e saída dele. Essa ação não pode ser desfeita.`,
    )
    if (!confirmed) return
    const { error } = await supabase.from('fuel_types').delete().eq('id', type.id)
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
          <h1 className="text-xl font-semibold text-slate-900">Combustível</h1>
          <p className="text-sm text-slate-500">Diesel e outros combustíveis do tanque</p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-brand-dark"
        >
          {showNewForm ? 'Cancelar' : 'Novo tipo'}
        </button>
      </div>

      {showNewForm && (
        <FuelTypeForm
          existing={fuelTypes}
          onSaved={() => {
            setShowNewForm(false)
            load()
          }}
          onUseExisting={(id) => {
            setShowNewForm(false)
            setExpandedId(id)
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : fuelTypes.length === 0 ? (
        <p className="text-slate-500">Nenhum combustível cadastrado.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {fuelTypes.map((type) => {
            const balance = balanceFor(type)
            const low = type.min_stock != null && balance < type.min_stock
            return (
              <div key={type.id}>
                <div className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                  <button
                    onClick={() => setExpandedId(expandedId === type.id ? null : type.id)}
                    className="font-medium text-slate-900 text-left"
                  >
                    {type.name}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className={low ? 'text-red-600 font-medium' : 'text-slate-500'}>
                      {balance.toFixed(0)} {type.unit}
                      {low && ' · estoque baixo'}
                    </span>
                    {profile?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => setEditingTypeId(editingTypeId === type.id ? null : type.id)}
                          className="text-xs text-slate-500 underline hover:text-slate-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteType(type)}
                          className="text-xs text-red-600 underline hover:text-red-800"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingTypeId === type.id && (
                  <div className="px-4 pb-4">
                    <FuelTypeForm
                      existing={fuelTypes}
                      initial={type}
                      onSaved={() => {
                        setEditingTypeId(null)
                        load()
                      }}
                      onCancel={() => setEditingTypeId(null)}
                    />
                  </div>
                )}
                {expandedId === type.id && (
                  <FuelTypePanel
                    type={type}
                    machines={machines}
                    movements={[
                      ...deliveries
                        .filter((d) => d.fuel_type_id === type.id)
                        .map((d): Movement => ({ kind: 'entrada', ...d })),
                      ...records
                        .filter((r) => r.fuel_type_id === type.id)
                        .map((r): Movement => ({ kind: 'saida', ...r })),
                    ].sort((a, b) => {
                      const da = a.kind === 'entrada' ? a.delivered_at : a.recorded_at
                      const db = b.kind === 'entrada' ? b.delivered_at : b.recorded_at
                      return new Date(db).getTime() - new Date(da).getTime()
                    })}
                    isAdmin={profile?.role === 'admin'}
                    onChanged={load}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FuelTypeForm({
  existing,
  initial,
  onSaved,
  onUseExisting,
  onCancel,
}: {
  existing: FuelType[]
  initial?: FuelType
  onSaved: () => void
  onUseExisting?: (id: string) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? 'L')
  const [minStock, setMinStock] = useState(initial?.min_stock != null ? String(initial.min_stock) : '')
  const [initialLiters, setInitialLiters] = useState(
    initial ? String(initial.initial_liters) : '0',
  )
  const [initialDate, setInitialDate] = useState(
    initial ? toInputValue(initial.initial_date) : nowForInput(),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const suggestions =
    !initial && name.trim().length >= 2
      ? existing.filter((t) => normalize(t.name).includes(normalize(name))).slice(0, 5)
      : []

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = {
      name,
      unit,
      min_stock: minStock ? Number(minStock) : null,
      initial_liters: Number(initialLiters),
      initial_date: new Date(initialDate).toISOString(),
    }
    const { error } = initial
      ? await supabase.from('fuel_types').update(payload).eq('id', initial.id)
      : await supabase.from('fuel_types').insert(payload)
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
      className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end"
    >
      <div className="relative">
        <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Diesel S10, Arla 32"
          autoComplete="off"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-sm text-sm">
            <p className="px-3 pt-2 text-xs text-slate-400">Já existe algo parecido:</p>
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                <span className="text-slate-700">
                  {s.name} <span className="text-slate-400">({s.unit})</span>
                </span>
                {onUseExisting && (
                  <button
                    type="button"
                    onClick={() => onUseExisting(s.id)}
                    className="text-slate-500 underline hover:text-slate-900 text-xs whitespace-nowrap ml-2"
                  >
                    Usar este
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Unidade</label>
        <input
          required
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Estoque mínimo (opcional)</label>
        <input
          type="number"
          step="0.01"
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div />
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Estoque de referência</label>
        <input
          type="number"
          step="0.01"
          required
          value={initialLiters}
          onChange={(e) => setInitialLiters(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">A partir de</label>
        <input
          type="datetime-local"
          required
          value={initialDate}
          onChange={(e) => setInitialDate(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-slate-400 sm:col-span-2">
        O saldo atual é calculado a partir daqui: estoque de referência + entradas − saídas desde essa data.
      </p>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Salvar combustível'}
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

function FuelTypePanel({
  type,
  machines,
  movements,
  isAdmin,
  onChanged,
}: {
  type: FuelType
  machines: Machine[]
  movements: Movement[]
  isAdmin: boolean
  onChanged: () => void
}) {
  const [formKind, setFormKind] = useState<'entrada' | 'saida' | null>(null)
  const [editing, setEditing] = useState<Movement | null>(null)

  async function handleDelete(m: Movement) {
    const confirmed = window.confirm('Excluir essa movimentação? Essa ação não pode ser desfeita.')
    if (!confirmed) return
    const table = m.kind === 'entrada' ? 'fuel_deliveries' : 'fuel_records'
    const { error } = await supabase.from(table).delete().eq('id', m.id)
    if (error) {
      alert(error.message)
      return
    }
    onChanged()
  }

  return (
    <div className="bg-slate-50 px-4 py-4 space-y-4 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setEditing(null)
            setFormKind(formKind === 'entrada' ? null : 'entrada')
          }}
          className="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-100"
        >
          Registrar entrada
        </button>
        <button
          onClick={() => {
            setEditing(null)
            setFormKind(formKind === 'saida' ? null : 'saida')
          }}
          className="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-100"
        >
          Registrar saída
        </button>
      </div>

      {formKind === 'entrada' && !editing && (
        <DeliveryForm fuelType={type} onSaved={() => { setFormKind(null); onChanged() }} />
      )}
      {formKind === 'saida' && !editing && (
        <DispenseForm
          fuelType={type}
          machines={machines}
          onSaved={() => { setFormKind(null); onChanged() }}
        />
      )}

      {editing && editing.kind === 'entrada' && (
        <DeliveryForm
          fuelType={type}
          initial={editing}
          onSaved={() => { setEditing(null); onChanged() }}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing && editing.kind === 'saida' && (
        <DispenseForm
          fuelType={type}
          machines={machines}
          initial={editing}
          onSaved={() => { setEditing(null); onChanged() }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Movimentações recentes</p>
        {movements.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {movements.slice(0, 12).map((m) => {
              const machine = m.kind === 'saida' ? machines.find((x) => x.id === m.machine_id) : null
              const date = m.kind === 'entrada' ? m.delivered_at : m.recorded_at
              return (
                <li
                  key={`${m.kind}-${m.id}`}
                  className="text-sm flex items-center justify-between bg-white rounded-md px-3 py-2 border border-slate-100 flex-wrap gap-1"
                >
                  <span>
                    <span className={m.kind === 'entrada' ? 'text-green-700' : 'text-slate-700'}>
                      {m.kind === 'entrada' ? '+ ' : '- '}
                      {Number(m.liters).toFixed(1)} {type.unit}
                    </span>
                    {machine && <span className="text-slate-400"> · {machine.name}</span>}
                    {m.kind === 'saida' && <span className="text-slate-400"> · {m.hourmeter} h</span>}
                    {m.kind === 'entrada' && m.supplier && (
                      <span className="text-slate-400"> · {m.supplier}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-slate-400">{new Date(date).toLocaleDateString('pt-BR')}</span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setFormKind(null)
                            setEditing(editing?.id === m.id ? null : m)
                          }}
                          className="text-xs text-slate-500 underline hover:text-slate-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="text-xs text-red-600 underline hover:text-red-800"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function DeliveryForm({
  fuelType,
  initial,
  onSaved,
  onCancel,
}: {
  fuelType: FuelType
  initial?: FuelDelivery
  onSaved: () => void
  onCancel?: () => void
}) {
  const { session } = useAuth()
  const [deliveredAt, setDeliveredAt] = useState(
    initial ? toInputValue(initial.delivered_at) : nowForInput(),
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
      : await supabase
          .from('fuel_deliveries')
          .insert({ ...payload, user_id: session.user.id, fuel_type_id: fuelType.id })

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
      className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end"
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
        <label className="block text-xs font-medium text-slate-700 mb-1">Observações (opcional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2 flex items-center gap-2">
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

function DispenseForm({
  fuelType,
  machines,
  initial,
  onSaved,
  onCancel,
}: {
  fuelType: FuelType
  machines: Machine[]
  initial?: FuelRecord
  onSaved: () => void
  onCancel?: () => void
}) {
  const { session } = useAuth()
  const [recordedAt, setRecordedAt] = useState(
    initial ? toInputValue(initial.recorded_at) : nowForInput(),
  )
  const [machineId, setMachineId] = useState(initial?.machine_id ?? '')
  const [hourmeter, setHourmeter] = useState(initial ? String(initial.hourmeter) : '')
  const [liters, setLiters] = useState(initial ? String(initial.liters) : '')
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSubmitting(true)
    setError(null)

    const payload = {
      machine_id: machineId,
      recorded_at: new Date(recordedAt).toISOString(),
      hourmeter: Number(hourmeter),
      liters: Number(liters),
      cost: cost ? Number(cost) : null,
    }

    const { error } = initial
      ? await supabase.from('fuel_records').update(payload).eq('id', initial.id)
      : await supabase
          .from('fuel_records')
          .insert({ ...payload, user_id: session.user.id, fuel_type_id: fuelType.id })

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
      className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Máquina</label>
        <select
          required
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Selecione...
          </option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
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
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {fuelType.name} ({fuelType.unit})
        </label>
        <input
          type="number"
          step="0.01"
          required
          value={liters}
          onChange={(e) => setLiters(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700 mb-1">Custo (R$, opcional)</label>
        <input
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-[calc(50%-6px)]"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Salvar saída'}
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
