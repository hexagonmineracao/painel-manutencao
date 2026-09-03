import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { Machine, Material, MaterialMovement, MaterialMovementType } from '../lib/database.types'

// Remove acentos (via NFD + descarte dos diacríticos combinantes) pra
// "Oleo" encontrar "Óleo" na busca de duplicidade.
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

export function Materials() {
  const { profile } = useAuth()
  const [materials, setMaterials] = useState<Material[]>([])
  const [movements, setMovements] = useState<MaterialMovement[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [materialsRes, movementsRes, machinesRes] = await Promise.all([
      supabase.from('materials').select('*').order('name').returns<Material[]>(),
      supabase
        .from('material_movements')
        .select('*')
        .order('moved_at', { ascending: false })
        .returns<MaterialMovement[]>(),
      supabase.from('machines').select('*').order('name').returns<Machine[]>(),
    ])
    setMaterials(materialsRes.data ?? [])
    setMovements(movementsRes.data ?? [])
    setMachines(machinesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function balanceFor(materialId: string) {
    return movements
      .filter((m) => m.material_id === materialId)
      .reduce((sum, m) => sum + (m.type === 'entrada' ? Number(m.quantity) : -Number(m.quantity)), 0)
  }

  async function handleDeleteMaterial(material: Material) {
    const confirmed = window.confirm(
      `Excluir "${material.name}"? Isso também apaga todas as movimentações registradas dele. Essa ação não pode ser desfeita.`,
    )
    if (!confirmed) return
    const { error } = await supabase.from('materials').delete().eq('id', material.id)
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
          <h1 className="text-xl font-semibold text-slate-900">Estoque de materiais</h1>
          <p className="text-sm text-slate-500">Filtros, óleos e outras peças</p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="bg-slate-900 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-800"
        >
          {showNewForm ? 'Cancelar' : 'Novo material'}
        </button>
      </div>

      {showNewForm && (
        <MaterialForm
          existing={materials}
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
      ) : materials.length === 0 ? (
        <p className="text-slate-500">Nenhum material cadastrado.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {materials.map((mat) => {
            const balance = balanceFor(mat.id)
            const low = mat.min_stock != null && balance < mat.min_stock
            return (
              <div key={mat.id}>
                <div className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                  <button
                    onClick={() => setExpandedId(expandedId === mat.id ? null : mat.id)}
                    className="font-medium text-slate-900 text-left"
                  >
                    {mat.name}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className={low ? 'text-red-600 font-medium' : 'text-slate-500'}>
                      {balance.toFixed(1)} {mat.unit}
                      {low && ' · estoque baixo'}
                    </span>
                    {profile?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => setEditingMaterialId(editingMaterialId === mat.id ? null : mat.id)}
                          className="text-xs text-slate-500 underline hover:text-slate-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(mat)}
                          className="text-xs text-red-600 underline hover:text-red-800"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingMaterialId === mat.id && (
                  <div className="px-4 pb-4">
                    <MaterialForm
                      existing={materials}
                      initial={mat}
                      onSaved={() => {
                        setEditingMaterialId(null)
                        load()
                      }}
                      onCancel={() => setEditingMaterialId(null)}
                    />
                  </div>
                )}
                {expandedId === mat.id && (
                  <MaterialPanel
                    material={mat}
                    machines={machines}
                    movements={movements.filter((m) => m.material_id === mat.id)}
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

function MaterialForm({
  existing,
  initial,
  onSaved,
  onUseExisting,
  onCancel,
}: {
  existing: Material[]
  initial?: Material
  onSaved: () => void
  onUseExisting?: (materialId: string) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [minStock, setMinStock] = useState(initial?.min_stock != null ? String(initial.min_stock) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const suggestions =
    !initial && name.trim().length >= 2
      ? existing.filter((m) => normalize(m.name).includes(normalize(name))).slice(0, 5)
      : []

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = { name, unit, min_stock: minStock ? Number(minStock) : null }
    const { error } = initial
      ? await supabase.from('materials').update(payload).eq('id', initial.id)
      : await supabase.from('materials').insert(payload)
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
      <div className="relative">
        <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Óleo hidráulico 20L"
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
          placeholder="Ex: L, un, kg"
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
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      <div className="sm:col-span-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Salvar material'}
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

function MaterialPanel({
  material,
  machines,
  movements,
  isAdmin,
  onChanged,
}: {
  material: Material
  machines: Machine[]
  movements: MaterialMovement[]
  isAdmin: boolean
  onChanged: () => void
}) {
  const [formType, setFormType] = useState<MaterialMovementType | null>(null)
  const [editingMovement, setEditingMovement] = useState<MaterialMovement | null>(null)

  async function handleDeleteMovement(movement: MaterialMovement) {
    const confirmed = window.confirm('Excluir essa movimentação? Essa ação não pode ser desfeita.')
    if (!confirmed) return
    const { error } = await supabase.from('material_movements').delete().eq('id', movement.id)
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
            setEditingMovement(null)
            setFormType(formType === 'entrada' ? null : 'entrada')
          }}
          className="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-100"
        >
          Registrar entrada
        </button>
        <button
          onClick={() => {
            setEditingMovement(null)
            setFormType(formType === 'saida' ? null : 'saida')
          }}
          className="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-100"
        >
          Registrar saída
        </button>
      </div>

      {formType && !editingMovement && (
        <MovementForm
          material={material}
          machines={machines}
          type={formType}
          onSaved={() => {
            setFormType(null)
            onChanged()
          }}
        />
      )}

      {editingMovement && (
        <MovementForm
          material={material}
          machines={machines}
          type={editingMovement.type}
          initial={editingMovement}
          onSaved={() => {
            setEditingMovement(null)
            onChanged()
          }}
          onCancel={() => setEditingMovement(null)}
        />
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Movimentações recentes</p>
        {movements.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {movements.slice(0, 10).map((m) => {
              const machine = machines.find((mac) => mac.id === m.machine_id)
              return (
                <li
                  key={m.id}
                  className="text-sm flex items-center justify-between bg-white rounded-md px-3 py-2 border border-slate-100"
                >
                  <span>
                    <span className={m.type === 'entrada' ? 'text-green-700' : 'text-slate-700'}>
                      {m.type === 'entrada' ? '+ ' : '- '}
                      {Number(m.quantity).toFixed(1)} {material.unit}
                    </span>
                    {machine && <span className="text-slate-400"> · {machine.name}</span>}
                    {m.notes && <span className="text-slate-400"> · {m.notes}</span>}
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-slate-400">{new Date(m.moved_at).toLocaleDateString('pt-BR')}</span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setFormType(null)
                            setEditingMovement(editingMovement?.id === m.id ? null : m)
                          }}
                          className="text-xs text-slate-500 underline hover:text-slate-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteMovement(m)}
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

function MovementForm({
  material,
  machines,
  type,
  initial,
  onSaved,
  onCancel,
}: {
  material: Material
  machines: Machine[]
  type: MaterialMovementType
  initial?: MaterialMovement
  onSaved: () => void
  onCancel?: () => void
}) {
  const { session } = useAuth()
  const [movedAt, setMovedAt] = useState(initial ? toInputValue(initial.moved_at) : nowForInput())
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '')
  const [machineId, setMachineId] = useState(initial?.machine_id ?? '')
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSubmitting(true)
    setError(null)

    const payload = {
      machine_id: type === 'saida' && machineId ? machineId : null,
      type,
      quantity: Number(quantity),
      cost: type === 'entrada' && cost ? Number(cost) : null,
      moved_at: new Date(movedAt).toISOString(),
      notes: notes || null,
    }

    const { error } = initial
      ? await supabase.from('material_movements').update(payload).eq('id', initial.id)
      : await supabase.from('material_movements').insert({
          ...payload,
          material_id: material.id,
          user_id: session.user.id,
        })

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
      className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Data e hora</label>
        <input
          type="datetime-local"
          required
          value={movedAt}
          onChange={(e) => setMovedAt(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Quantidade ({material.unit})</label>
        <input
          type="number"
          step="0.01"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {type === 'saida' ? (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Máquina (opcional)</label>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Custo (R$, opcional)</label>
          <input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}
      <div className="sm:col-span-3">
        <label className="block text-xs font-medium text-slate-700 mb-1">Observação (opcional)</label>
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
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : initial ? 'Salvar alterações' : 'Salvar'}
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
