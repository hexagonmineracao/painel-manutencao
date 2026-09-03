import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { MachineForm } from '../components/MachineForm'
import type { Machine } from '../lib/database.types'

export function Machines() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('machines').select('*').order('name').returns<Machine[]>()
    setMachines(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Máquinas</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-brand text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-brand-dark"
        >
          {showForm ? 'Cancelar' : 'Nova máquina'}
        </button>
      </div>

      {showForm && (
        <MachineForm
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : machines.length === 0 ? (
        <p className="text-slate-500">Nenhuma máquina cadastrada.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {machines.map((m) => (
            <Link
              key={m.id}
              to={`/machines/${m.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-sm text-slate-500">
                  {m.model} · nº {m.number}
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
