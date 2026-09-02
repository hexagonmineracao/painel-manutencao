import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { FuelRecord, Machine, MaintenanceRecord } from '../lib/database.types'

function daysAgoInput(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

interface FuelRow {
  machine: Machine
  liters: number
  cost: number
  hours: number
  litersPerHour: number | null
}

interface MaintenanceRow {
  machine: Machine
  count: number
  cost: number
}

export function Reports() {
  const [from, setFrom] = useState(daysAgoInput(30))
  const [to, setTo] = useState(todayInput())
  const [loading, setLoading] = useState(true)
  const [fuelRows, setFuelRows] = useState<FuelRow[]>([])
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceRow[]>([])

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

      const machines = machinesRes.data ?? []
      const fuel = fuelRes.data ?? []
      const maintenance = maintenanceRes.data ?? []

      const fuelByMachine = new Map<string, FuelRecord[]>()
      for (const rec of fuel) {
        const list = fuelByMachine.get(rec.machine_id) ?? []
        list.push(rec)
        fuelByMachine.set(rec.machine_id, list)
      }

      const computedFuelRows: FuelRow[] = machines
        .map((machine) => {
          const records = fuelByMachine.get(machine.id) ?? []
          if (records.length === 0) return null
          const liters = records.reduce((sum, r) => sum + Number(r.liters), 0)
          const cost = records.reduce((sum, r) => sum + Number(r.cost ?? 0), 0)
          const hourmeters = records.map((r) => Number(r.hourmeter))
          const hours = Math.max(...hourmeters) - Math.min(...hourmeters)
          return {
            machine,
            liters,
            cost,
            hours,
            litersPerHour: hours > 0 ? liters / hours : null,
          }
        })
        .filter((r): r is FuelRow => r !== null)

      const maintenanceByMachine = new Map<string, MaintenanceRecord[]>()
      for (const rec of maintenance) {
        const list = maintenanceByMachine.get(rec.machine_id) ?? []
        list.push(rec)
        maintenanceByMachine.set(rec.machine_id, list)
      }

      const computedMaintenanceRows: MaintenanceRow[] = machines
        .map((machine) => {
          const records = maintenanceByMachine.get(machine.id) ?? []
          if (records.length === 0) return null
          return {
            machine,
            count: records.length,
            cost: records.reduce((sum, r) => sum + Number(r.cost ?? 0), 0),
          }
        })
        .filter((r): r is MaintenanceRow => r !== null)

      setFuelRows(computedFuelRows)
      setMaintenanceRows(computedMaintenanceRows)
      setLoading(false)
    }
    load()
  }, [from, to])

  const totalLiters = fuelRows.reduce((s, r) => s + r.liters, 0)
  const totalFuelCost = fuelRows.reduce((s, r) => s + r.cost, 0)
  const totalMaintenanceCost = maintenanceRows.reduce((s, r) => s + r.cost, 0)
  const totalMaintenanceCount = maintenanceRows.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Relatórios</h1>

      <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-lg p-4">
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

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <>
          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between">
              <span>Combustível por máquina</span>
              <span className="text-sm text-slate-500 font-normal">
                Total: {totalLiters.toFixed(0)} L · R$ {totalFuelCost.toFixed(2)}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Máquina</th>
                  <th className="px-4 py-2 font-medium">Litros</th>
                  <th className="px-4 py-2 font-medium">Custo</th>
                  <th className="px-4 py-2 font-medium">L/h</th>
                </tr>
              </thead>
              <tbody>
                {fuelRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-slate-500">
                      Sem registros no período.
                    </td>
                  </tr>
                ) : (
                  fuelRows.map((row) => (
                    <tr key={row.machine.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-900">{row.machine.name}</td>
                      <td className="px-4 py-2">{row.liters.toFixed(1)} L</td>
                      <td className="px-4 py-2">R$ {row.cost.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        {row.litersPerHour != null ? `${row.litersPerHour.toFixed(2)} L/h` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between">
              <span>Manutenções por máquina</span>
              <span className="text-sm text-slate-500 font-normal">
                Total: {totalMaintenanceCount} · R$ {totalMaintenanceCost.toFixed(2)}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Máquina</th>
                  <th className="px-4 py-2 font-medium">Quantidade</th>
                  <th className="px-4 py-2 font-medium">Custo</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-slate-500">
                      Sem registros no período.
                    </td>
                  </tr>
                ) : (
                  maintenanceRows.map((row) => (
                    <tr key={row.machine.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-900">{row.machine.name}</td>
                      <td className="px-4 py-2">{row.count}</td>
                      <td className="px-4 py-2">R$ {row.cost.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
