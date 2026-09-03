import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { MachineForm } from '../components/MachineForm'
import type { FuelRecord, Machine, MaintenanceRecord } from '../lib/database.types'

type HistoryItem =
  | ({ kind: 'maintenance' } & MaintenanceRecord)
  | ({ kind: 'fuel' } & FuelRecord)

export function MachineDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
                {item.kind === 'maintenance' ? (
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
                    {item.cost != null && (
                      <span className="text-slate-500 whitespace-nowrap">
                        R$ {Number(item.cost).toFixed(2)}
                      </span>
                    )}
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
                    {item.cost != null && (
                      <span className="text-slate-500 whitespace-nowrap">
                        R$ {Number(item.cost).toFixed(2)}
                      </span>
                    )}
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
