import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { AlertSeverity, Machine } from '../lib/database.types'

interface AlertItem {
  key: string
  machine: Machine
  severity: AlertSeverity
  title: string
  detail: string
}

const severityStyles: Record<AlertSeverity, string> = {
  atencao: 'border-amber-200 bg-amber-50 text-amber-800',
  alerta: 'border-orange-200 bg-orange-50 text-orange-800',
  critica: 'border-red-300 bg-red-50 text-red-800',
}

const severityLabel: Record<AlertSeverity, string> = {
  atencao: 'Atenção',
  alerta: 'Alerta',
  critica: 'Crítico',
}

export function Alerts({ maintenanceLookaheadDays = 30 }: { maintenanceLookaheadDays?: number }) {
  const { session } = useAuth()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    const [machinesRes, maintenanceRes, fuelRes, dismissalsRes] = await Promise.all([
      supabase.from('machines').select('*').order('name').returns<Machine[]>(),
      supabase
        .from('maintenance_records')
        .select('id, machine_id, hourmeter, performed_at, next_due_hourmeter')
        .order('performed_at', { ascending: false })
        .returns<
          Array<{
            id: string
            machine_id: string
            hourmeter: number
            performed_at: string
            next_due_hourmeter: number | null
          }>
        >(),
      supabase
        .from('fuel_records')
        .select('id, machine_id, hourmeter, liters, recorded_at')
        .order('hourmeter', { ascending: true })
        .returns<
          Array<{ id: string; machine_id: string; hourmeter: number; liters: number; recorded_at: string }>
        >(),
      supabase
        .from('alert_dismissals')
        .select('alert_key, remind_at, dismissed_at')
        .order('dismissed_at', { ascending: false })
        .returns<Array<{ alert_key: string; remind_at: string | null; dismissed_at: string }>>(),
    ])

    const machines = machinesRes.data ?? []
    const maintenance = maintenanceRes.data ?? []
    const fuel = fuelRes.data ?? []
    const dismissals = dismissalsRes.data ?? []

    const activeDismissal = new Map<string, { remind_at: string | null }>()
    for (const d of dismissals) {
      if (!activeDismissal.has(d.alert_key)) activeDismissal.set(d.alert_key, d)
    }
    const now = Date.now()
    function isDismissed(key: string) {
      const d = activeDismissal.get(key)
      if (!d) return false
      if (d.remind_at == null) return true
      return new Date(d.remind_at).getTime() > now
    }

    const lastMaintenanceByMachine = new Map<
      string,
      { id: string; hourmeter: number; nextDueHourmeter: number | null }
    >()
    for (const rec of maintenance) {
      if (!lastMaintenanceByMachine.has(rec.machine_id)) {
        lastMaintenanceByMachine.set(rec.machine_id, {
          id: rec.id,
          hourmeter: Number(rec.hourmeter),
          nextDueHourmeter: rec.next_due_hourmeter != null ? Number(rec.next_due_hourmeter) : null,
        })
      }
    }

    const fuelByMachine = new Map<string, typeof fuel>()
    for (const rec of fuel) {
      const list = fuelByMachine.get(rec.machine_id) ?? []
      list.push(rec)
      fuelByMachine.set(rec.machine_id, list)
    }

    // Uso médio (h/dia) por máquina, a partir de todo o histórico de horímetro
    // (combustível + manutenção), pra estimar em quantos dias uma manutenção
    // "a vencer" (ainda não vencida) deve realmente chegar no prazo.
    function estimateHoursPerDay(machineId: string): number | null {
      const points: Array<{ hourmeter: number; date: number }> = []
      for (const r of fuelByMachine.get(machineId) ?? []) {
        points.push({ hourmeter: Number(r.hourmeter), date: new Date(r.recorded_at).getTime() })
      }
      for (const r of maintenance) {
        if (r.machine_id === machineId) {
          points.push({ hourmeter: Number(r.hourmeter), date: new Date(r.performed_at).getTime() })
        }
      }
      if (points.length < 2) return null
      const minHour = Math.min(...points.map((p) => p.hourmeter))
      const maxHour = Math.max(...points.map((p) => p.hourmeter))
      const minDate = Math.min(...points.map((p) => p.date))
      const maxDate = Math.max(...points.map((p) => p.date))
      const days = (maxDate - minDate) / 86400000
      if (days < 3) return null
      const rate = (maxHour - minHour) / days
      return rate > 0 ? rate : null
    }

    const computed: AlertItem[] = []

    for (const machine of machines) {
      const last = lastMaintenanceByMachine.get(machine.id)
      // O horímetro previsto informado no próprio registro de manutenção
      // manda; se não foi informado, cai no intervalo padrão da máquina.
      const dueHourmeter =
        last?.nextDueHourmeter ??
        (machine.maintenance_interval_hours
          ? (last?.hourmeter ?? 0) + machine.maintenance_interval_hours
          : null)
      const intervalForSeverity =
        last?.nextDueHourmeter != null
          ? last.nextDueHourmeter - (last?.hourmeter ?? 0)
          : machine.maintenance_interval_hours

      if (dueHourmeter != null && intervalForSeverity) {
        const remaining = dueHourmeter - machine.current_hourmeter
        if (remaining <= 20) {
          // Já vencida (remaining <= 0): sempre mostra. Ainda não vencida:
          // só mostra se a estimativa de dias até vencer cabe na janela do
          // filtro do dashboard (máx. configurado por maintenanceLookaheadDays).
          let showUpcoming = true
          if (remaining > 0) {
            const rate = estimateHoursPerDay(machine.id)
            if (rate != null) {
              const estimatedDays = remaining / rate
              showUpcoming = estimatedDays <= maintenanceLookaheadDays
            }
          }
          if (showUpcoming) {
            const overdueRatio = remaining < 0 ? -remaining / intervalForSeverity : 0
            const severity: AlertSeverity =
              remaining > 0 ? 'atencao' : overdueRatio < 0.15 ? 'alerta' : 'critica'
            const key = `maint-${machine.id}-${last?.id ?? 'none'}`
            if (!isDismissed(key)) {
              computed.push({
                key,
                machine,
                severity,
                title: `${machine.name} — manutenção preventiva`,
                detail:
                  remaining <= 0
                    ? `Vencida há ${Math.abs(remaining).toFixed(0)} h`
                    : `Faltam ${remaining.toFixed(0)} h`,
              })
            }
          }
        }
      }

      const records = fuelByMachine.get(machine.id) ?? []
      if (records.length >= 4) {
        const intervals: number[] = []
        for (let i = 1; i < records.length; i++) {
          const hourDelta = Number(records[i].hourmeter) - Number(records[i - 1].hourmeter)
          if (hourDelta >= 1) {
            intervals.push(Number(records[i].liters) / hourDelta)
          }
        }
        if (intervals.length >= 4) {
          const latest = intervals[intervals.length - 1]
          const baseline = intervals.slice(0, -1)
          const avg = baseline.reduce((s, v) => s + v, 0) / baseline.length
          const ratio = avg > 0 ? latest / avg : 0
          if (ratio >= 1.15) {
            const severity: AlertSeverity = ratio >= 1.7 ? 'critica' : ratio >= 1.3 ? 'alerta' : 'atencao'
            const lastFuelId = records[records.length - 1].id
            const key = `fuel-${machine.id}-${lastFuelId}`
            if (!isDismissed(key)) {
              computed.push({
                key,
                machine,
                severity,
                title: `${machine.name} — consumo acima do normal`,
                detail: `${latest.toFixed(2)} L/h no último abastecimento vs. média de ${avg.toFixed(2)} L/h (${Math.round((ratio - 1) * 100)}% acima)`,
              })
            }
          }
        }
      }
    }

    const order: Record<AlertSeverity, number> = { critica: 0, alerta: 1, atencao: 2 }
    computed.sort((a, b) => order[a.severity] - order[b.severity])

    setAlerts(computed)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenanceLookaheadDays])

  async function dismiss(key: string, remindInDays: number | null) {
    if (!session) return
    await supabase.from('alert_dismissals').insert({
      alert_key: key,
      dismissed_by: session.user.id,
      remind_at: remindInDays ? new Date(Date.now() + remindInDays * 86400000).toISOString() : null,
    })
    load()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900">Alertas</div>
      {loading ? (
        <p className="px-4 py-4 text-sm text-slate-500">Carregando...</p>
      ) : alerts.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">Nenhum alerta no momento.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => (
            <li key={a.key} className={`px-4 py-3 border-l-4 ${severityStyles[a.severity]}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {severityLabel[a.severity]}
                  </p>
                  <Link to={`/machines/${a.machine.id}`} className="font-medium hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-sm">{a.detail}</p>
                </div>
                <div className="flex items-center gap-2 text-xs whitespace-nowrap">
                  <button onClick={() => dismiss(a.key, 7)} className="underline hover:no-underline">
                    Lembrar em 7 dias
                  </button>
                  <button
                    onClick={() => dismiss(a.key, null)}
                    className="px-2 py-1 rounded bg-white border border-current"
                  >
                    Resolvido
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
