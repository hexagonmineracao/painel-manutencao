import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Machine } from '../lib/database.types'

interface Alert {
  machine: Machine
  remaining: number
}

function startOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [fuelCostMonth, setFuelCostMonth] = useState(0)
  const [fuelLitersMonth, setFuelLitersMonth] = useState(0)
  const [deliveredLitersMonth, setDeliveredLitersMonth] = useState(0)
  const [deliveredCostMonth, setDeliveredCostMonth] = useState(0)
  const [maintenanceCostMonth, setMaintenanceCostMonth] = useState(0)
  const [maintenanceCountMonth, setMaintenanceCountMonth] = useState(0)
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = startOfMonthISO()

      const [fuelRes, deliveriesRes, maintenanceRes, machinesRes, lastMaintenanceRes] = await Promise.all([
        supabase
          .from('fuel_records')
          .select('liters, cost')
          .gte('recorded_at', since)
          .returns<Array<{ liters: number; cost: number | null }>>(),
        supabase
          .from('fuel_deliveries')
          .select('liters, total_cost')
          .gte('delivered_at', since)
          .returns<Array<{ liters: number; total_cost: number }>>(),
        supabase
          .from('maintenance_records')
          .select('cost')
          .gte('performed_at', since)
          .returns<Array<{ cost: number | null }>>(),
        supabase.from('machines').select('*').order('name').returns<Machine[]>(),
        supabase
          .from('maintenance_records')
          .select('machine_id, hourmeter, performed_at')
          .order('performed_at', { ascending: false })
          .returns<Array<{ machine_id: string; hourmeter: number; performed_at: string }>>(),
      ])

      const fuel = fuelRes.data ?? []
      setFuelLitersMonth(fuel.reduce((sum, r) => sum + Number(r.liters ?? 0), 0))
      setFuelCostMonth(fuel.reduce((sum, r) => sum + Number(r.cost ?? 0), 0))

      const deliveries = deliveriesRes.data ?? []
      setDeliveredLitersMonth(deliveries.reduce((sum, r) => sum + Number(r.liters ?? 0), 0))
      setDeliveredCostMonth(deliveries.reduce((sum, r) => sum + Number(r.total_cost ?? 0), 0))

      const maintenance = maintenanceRes.data ?? []
      setMaintenanceCountMonth(maintenance.length)
      setMaintenanceCostMonth(maintenance.reduce((sum, r) => sum + Number(r.cost ?? 0), 0))

      const machines = machinesRes.data ?? []
      const lastServiceByMachine = new Map<string, number>()
      for (const rec of lastMaintenanceRes.data ?? []) {
        if (!lastServiceByMachine.has(rec.machine_id)) {
          lastServiceByMachine.set(rec.machine_id, Number(rec.hourmeter))
        }
      }

      const computedAlerts: Alert[] = []
      for (const machine of machines) {
        if (!machine.maintenance_interval_hours) continue
        const lastService = lastServiceByMachine.get(machine.id) ?? 0
        const remaining =
          lastService + machine.maintenance_interval_hours - machine.current_hourmeter
        if (remaining <= 20) {
          computedAlerts.push({ machine, remaining })
        }
      }
      computedAlerts.sort((a, b) => a.remaining - b.remaining)
      setAlerts(computedAlerts)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <p className="text-slate-500">Carregando...</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card label="Combustível abastecido no mês" value={`${fuelLitersMonth.toFixed(0)} L`} sub={`R$ ${fuelCostMonth.toFixed(2)}`} />
        <Card label="Combustível recebido no mês" value={`${deliveredLitersMonth.toFixed(0)} L`} sub={`R$ ${deliveredCostMonth.toFixed(2)}`} />
        <Card label="Manutenções no mês" value={`${maintenanceCountMonth}`} sub={`R$ ${maintenanceCostMonth.toFixed(2)}`} />
        <Card label="Alertas de manutenção" value={`${alerts.length}`} sub="preventivas próximas/vencidas" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900">
          Manutenção preventiva
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            Nenhum alerta no momento.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map(({ machine, remaining }) => (
              <li key={machine.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <Link to={`/machines/${machine.id}`} className="text-slate-900 hover:underline">
                  {machine.name} ({machine.number})
                </Link>
                <span className={remaining <= 0 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                  {remaining <= 0
                    ? `Vencida há ${Math.abs(remaining).toFixed(0)} h`
                    : `Faltam ${remaining.toFixed(0)} h`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  )
}
