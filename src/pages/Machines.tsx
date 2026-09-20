import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { MachineForm } from '../components/MachineForm'
import { matchesSearch } from '../lib/search'
import type { Machine, MachineGroup } from '../lib/database.types'

export function Machines() {
  const { profile } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [groups, setGroups] = useState<MachineGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')

  async function load() {
    setLoading(true)
    const [machinesRes, groupsRes] = await Promise.all([
      supabase.from('machines').select('*').order('name').returns<Machine[]>(),
      supabase.from('machine_groups').select('*').order('name').returns<MachineGroup[]>(),
    ])
    setMachines(machinesRes.data ?? [])
    setGroups(groupsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function groupName(id: string | null) {
    if (!id) return null
    return groups.find((g) => g.id === id)?.name ?? null
  }

  const filtered = machines
    .filter((m) => matchesSearch(search, m.name, m.model, m.number))
    .filter((m) => !groupFilter || m.group_id === groupFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-900">Máquinas</h1>
        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <button
              onClick={() => setShowGroups((v) => !v)}
              className="bg-white border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-50"
            >
              {showGroups ? 'Fechar grupos' : 'Gerenciar grupos'}
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-brand-dark"
          >
            {showForm ? 'Cancelar' : 'Nova máquina'}
          </button>
        </div>
      </div>

      {showGroups && (
        <GroupManager
          groups={groups}
          onChanged={load}
        />
      )}

      {showForm && (
        <MachineForm
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, modelo ou número..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-56"
        >
          <option value="">Todos os grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : machines.length === 0 ? (
        <p className="text-slate-500">Nenhuma máquina cadastrada.</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500">Nenhuma máquina encontrada.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {filtered.map((m) => (
            <Link
              key={m.id}
              to={`/machines/${m.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-sm text-slate-500">
                  {m.model} · nº {m.number}
                  {groupName(m.group_id) && ` · ${groupName(m.group_id)}`}
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

function GroupManager({ groups, onChanged }: { groups: MachineGroup[]; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('machine_groups').insert({ name })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    onChanged()
  }

  async function handleRename(id: string) {
    const { error } = await supabase.from('machine_groups').update({ name: editingName }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setEditingId(null)
    onChanged()
  }

  async function handleDelete(group: MachineGroup) {
    const confirmed = window.confirm(
      `Excluir o grupo "${group.name}"? As máquinas desse grupo ficam sem grupo — nenhum histórico é apagado.`,
    )
    if (!confirmed) return
    const { error } = await supabase.from('machine_groups').delete().eq('id', group.id)
    if (error) {
      alert(error.message)
      return
    }
    onChanged()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-slate-900">Grupos (empresas)</p>
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum grupo cadastrado ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-2 text-sm">
              {editingId === g.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => handleRename(g.id)}
                    className="text-xs text-slate-500 underline hover:text-slate-900"
                  >
                    Salvar
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-slate-700">{g.name}</span>
                  <button
                    onClick={() => {
                      setEditingId(g.id)
                      setEditingName(g.name)
                    }}
                    className="text-xs text-slate-500 underline hover:text-slate-900"
                  >
                    Renomear
                  </button>
                  <button
                    onClick={() => handleDelete(g)}
                    className="text-xs text-red-600 underline hover:text-red-800"
                  >
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleCreate} className="flex items-end gap-2 pt-2 border-t border-slate-100">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-700 mb-1">Novo grupo</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Hexagon, Terceirizada ABC"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Criar'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
