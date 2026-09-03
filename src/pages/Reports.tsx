import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { exportToCsv } from '../lib/csv'
import type { FuelDelivery, FuelRecord, Machine, MaintenanceRecord } from '../lib/database.types'

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
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fromISO = new Date(from + 'T00:00:00').toISOString()
      const toISO = new Date(to + 'T23:59:59').toISOString()

      const [machinesRes, fuelRes, maintenanceRes, deliveriesRes] = await Promise.all([
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
        supabase
          .from('fuel_deliveries')
          .select('*')
          .gte('delivered_at', fromISO)
          .lte('delivered_at', toISO)
          .order('delivered_at', { ascending: false })
          .returns<FuelDelivery[]>(),
      ])

      const machines = machinesRes.data ?? []
      const fuel = fuelRes.data ?? []
      const maintenance = maintenanceRes.data ?? []
      setDeliveries(deliveriesRes.data ?? [])

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

  const totalDeliveredLiters = deliveries.reduce((s, d) => s + Number(d.liters), 0)
  const totalDeliveredCost = deliveries.reduce((s, d) => s + Number(d.total_cost), 0)
  const avgPricePerLiter = totalDeliveredLiters > 0 ? totalDeliveredCost / totalDeliveredLiters : null
  const balance = totalDeliveredLiters - totalLiters

  function exportDeliveries() {
    exportToCsv(
      `entradas_combustivel_${from}_a_${to}`,
      ['Data', 'Litros', 'Valor', 'R$/L', 'Fornecedor'],
      deliveries.map((d) => [
        new Date(d.delivered_at).toLocaleDateString('pt-BR'),
        Number(d.liters).toFixed(1),
        Number(d.total_cost).toFixed(2),
        (Number(d.total_cost) / Number(d.liters)).toFixed(3),
        d.supplier ?? '',
      ]),
    )
  }

  function exportFuelByMachine() {
    exportToCsv(
      `combustivel_por_maquina_${from}_a_${to}`,
      ['Máquina', 'Litros', 'Custo', 'L/h'],
      fuelRows.map((r) => [
        r.machine.name,
        r.liters.toFixed(1),
        r.cost.toFixed(2),
        r.litersPerHour != null ? r.litersPerHour.toFixed(2) : '',
      ]),
    )
  }

  function exportMaintenanceByMachine() {
    exportToCsv(
      `manutencoes_por_maquina_${from}_a_${to}`,
      ['Máquina', 'Quantidade', 'Custo'],
      maintenanceRows.map((r) => [r.machine.name, r.count, r.cost.toFixed(2)]),
    )
  }

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
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Entrada de combustível (tanque principal)</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-normal">
                  Total: {totalDeliveredLiters.toFixed(0)} L · R$ {totalDeliveredCost.toFixed(2)}
                  {avgPricePerLiter != null && ` · média R$ ${avgPricePerLiter.toFixed(3)}/L`}
                </span>
                <button onClick={exportDeliveries} className="text-xs text-slate-500 underline hover:text-slate-900">
                  Exportar CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Litros</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">R$/L</th>
                  <th className="px-4 py-2 font-medium">Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-slate-500">
                      Sem entradas no período.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-900">
                        {new Date(d.delivered_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-2">{Number(d.liters).toFixed(1)} L</td>
                      <td className="px-4 py-2">R$ {Number(d.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-2">R$ {(Number(d.total_cost) / Number(d.liters)).toFixed(3)}</td>
                      <td className="px-4 py-2 text-slate-500">{d.supplier ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="font-medium text-slate-900 mb-2">Balanço do período</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Entrada</p>
                <p className="text-slate-900 font-medium">{totalDeliveredLiters.toFixed(0)} L</p>
              </div>
              <div>
                <p className="text-slate-500">Saída (abastecido nas máquinas)</p>
                <p className="text-slate-900 font-medium">{totalLiters.toFixed(0)} L</p>
              </div>
              <div>
                <p className="text-slate-500">Diferença</p>
                <p className={balance < 0 ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                  {balance.toFixed(0)} L
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              A diferença reflete o saldo do tanque no período (ou quebra de medição entre entrada e
              saída) — não considera o estoque inicial do tanque.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Combustível por máquina</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-normal">
                  Total: {totalLiters.toFixed(0)} L · R$ {totalFuelCost.toFixed(2)}
                </span>
                <button onClick={exportFuelByMachine} className="text-xs text-slate-500 underline hover:text-slate-900">
                  Exportar CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
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
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Manutenções por máquina</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-normal">
                  Total: {totalMaintenanceCount} · R$ {totalMaintenanceCost.toFixed(2)}
                </span>
                <button
                  onClick={exportMaintenanceByMachine}
                  className="text-xs text-slate-500 underline hover:text-slate-900"
                >
                  Exportar CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
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
            </div>
          </section>
        </>
      )}
    </div>
  )
}
