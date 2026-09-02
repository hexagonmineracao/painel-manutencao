import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { exportToCsv } from '../lib/csv'
import type { FuelRecord, Machine, MaintenanceRecord } from '../lib/database.types'

function daysAgoInput(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

interface MetricRow {
  machine: Machine
  hours: number | null
  liters: number
  fuelCost: number
  maintenanceCost: number
  totalCost: number
  costPerHour: number | null
}

export function Metrics() {
  const [from, setFrom] = useState(daysAgoInput(30))
  const [to, setTo] = useState(todayInput())
  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null) // null = todas
  const [rows, setRows] = useState<MetricRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fromISO = new Date(from + 'T00:00:00').toISOString()
      const toISO = new Date(to + 'T23:59:59').toISOString()

      const [machinesRes, fuelRes, maintenanceRes] = await Promise.all([
        supabase.from('machines').select('*').order('name').returns<Machine[]>(),
        supabase
          .from('fuel_records')
          .select('*')
          .gte('recorded_at', fromISO)
          .lte('recorded_at', toISO)
          .returns<FuelRecord[]>(),
        supabase
          .from('maintenance_records')
          .select('*')
          .gte('performed_at', fromISO)
          .lte('performed_at', toISO)
          .returns<MaintenanceRecord[]>(),
      ])

      const allMachines = machinesRes.data ?? []
      setMachines(allMachines)
      const fuel = fuelRes.data ?? []
      const maintenance = maintenanceRes.data ?? []

      const computed: MetricRow[] = allMachines.map((machine) => {
        const fuelRecords = fuel.filter((r) => r.machine_id === machine.id)
        const maintenanceRecords = maintenance.filter((r) => r.machine_id === machine.id)

        const hourmeters = [
          ...fuelRecords.map((r) => Number(r.hourmeter)),
          ...maintenanceRecords.map((r) => Number(r.hourmeter)),
        ]
        const hours = hourmeters.length >= 2 ? Math.max(...hourmeters) - Math.min(...hourmeters) : null

        const liters = fuelRecords.reduce((s, r) => s + Number(r.liters), 0)
        const fuelCost = fuelRecords.reduce((s, r) => s + Number(r.cost ?? 0), 0)
        const maintenanceCost = maintenanceRecords.reduce((s, r) => s + Number(r.cost ?? 0), 0)
        const totalCost = fuelCost + maintenanceCost

        return {
          machine,
          hours,
          liters,
          fuelCost,
          maintenanceCost,
          totalCost,
          costPerHour: hours && hours > 0 ? totalCost / hours : null,
        }
      })

      setRows(computed)
      setLoading(false)
    }
    load()
  }, [from, to])

  const visibleRows = rows.filter((r) => selectedIds == null || selectedIds.has(r.machine.id))

  function toggleMachine(id: string) {
    setSelectedIds((prev) => {
      const base = prev ?? new Set(machines.map((m) => m.id))
      const next = new Set(base)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleExport() {
    exportToCsv(
      `metricas_${from}_a_${to}`,
      ['Máquina', 'Horas trabalhadas', 'Litros', 'Custo combustível', 'Custo manutenção', 'Custo total', 'Custo/hora'],
      visibleRows.map((r) => [
        r.machine.name,
        r.hours != null ? r.hours.toFixed(0) : '',
        r.liters.toFixed(1),
        r.fuelCost.toFixed(2),
        r.maintenanceCost.toFixed(2),
        r.totalCost.toFixed(2),
        r.costPerHour != null ? r.costPerHour.toFixed(2) : '',
      ]),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Métricas gerais</h1>
        <button
          onClick={handleExport}
          className="bg-slate-900 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-800"
        >
          Exportar CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-700 mb-2">Máquinas</p>
          <div className="flex flex-wrap gap-3">
            {machines.map((m) => {
              const checked = selectedIds == null || selectedIds.has(m.id)
              return (
                <label key={m.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={checked} onChange={() => toggleMachine(m.id)} />
                  {m.name}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Máquina</th>
                <th className="px-4 py-2 font-medium">Horas trabalhadas</th>
                <th className="px-4 py-2 font-medium">Litros</th>
                <th className="px-4 py-2 font-medium">Custo combustível</th>
                <th className="px-4 py-2 font-medium">Custo manutenção</th>
                <th className="px-4 py-2 font-medium">Custo total</th>
                <th className="px-4 py-2 font-medium">Custo/hora</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-slate-500">
                    Sem dados no período.
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => (
                  <tr key={r.machine.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-slate-900">{r.machine.name}</td>
                    <td className="px-4 py-2">{r.hours != null ? `${r.hours.toFixed(0)} h` : '—'}</td>
                    <td className="px-4 py-2">{r.liters.toFixed(1)} L</td>
                    <td className="px-4 py-2">R$ {r.fuelCost.toFixed(2)}</td>
                    <td className="px-4 py-2">R$ {r.maintenanceCost.toFixed(2)}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">R$ {r.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-2">{r.costPerHour != null ? `R$ ${r.costPerHour.toFixed(2)}/h` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
