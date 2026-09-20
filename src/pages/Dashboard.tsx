import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Alerts } from '../components/Alerts'
import type { FuelType } from '../lib/database.types'

type PeriodOption = '7' | '14' | '30' | 'custom'

function daysAgoInput(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

const periodLabels: Record<PeriodOption, string> = {
  '7': 'Últimos 7 dias',
  '14': 'Últimos 14 dias',
  '30': 'Último mês',
  custom: 'Período personalizado',
}

export function Dashboard() {
  const [period, setPeriod] = useState<PeriodOption>('30')
  const [customFrom, setCustomFrom] = useState(daysAgoInput(30))
  const [customTo, setCustomTo] = useState(todayInput())

  const [loading, setLoading] = useState(true)
  const [fuelLiters, setFuelLiters] = useState(0)
  const [dieselStock, setDieselStock] = useState<number | null>(null)
  const [dieselUnit, setDieselUnit] = useState('L')
  const [hasDiesel, setHasDiesel] = useState(true)

  const from = period === 'custom' ? customFrom : daysAgoInput(Number(period))
  const to = period === 'custom' ? customTo : todayInput()
  const periodDays =
    period === 'custom'
      ? Math.max(
          1,
          Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000),
        )
      : Number(period)
  const maintenanceLookaheadDays = Math.min(periodDays, 30)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fromISO = new Date(from + 'T00:00:00').toISOString()
      const toISO = new Date(to + 'T23:59:59').toISOString()

      const [fuelRes, dieselTypeRes] = await Promise.all([
        supabase
          .from('fuel_records')
          .select('liters')
          .gte('recorded_at', fromISO)
          .lte('recorded_at', toISO)
          .returns<Array<{ liters: number }>>(),
        supabase
          .from('fuel_types')
          .select('*')
          .ilike('name', 'diesel%')
          .limit(1)
          .returns<FuelType[]>(),
      ])

      const fuel = fuelRes.data ?? []
      setFuelLiters(fuel.reduce((sum, r) => sum + Number(r.liters ?? 0), 0))

      const diesel = (dieselTypeRes.data ?? [])[0]
      if (!diesel) {
        setHasDiesel(false)
        setDieselStock(null)
      } else {
        setHasDiesel(true)
        setDieselUnit(diesel.unit)
        const since = diesel.initial_date
        const [inRes, outRes] = await Promise.all([
          supabase
            .from('fuel_deliveries')
            .select('liters')
            .eq('fuel_type_id', diesel.id)
            .gte('delivered_at', since)
            .returns<Array<{ liters: number }>>(),
          supabase
            .from('fuel_records')
            .select('liters')
            .eq('fuel_type_id', diesel.id)
            .gte('recorded_at', since)
            .returns<Array<{ liters: number }>>(),
        ])
        const totalIn = (inRes.data ?? []).reduce((s, r) => s + Number(r.liters), 0)
        const totalOut = (outRes.data ?? []).reduce((s, r) => s + Number(r.liters), 0)
        setDieselStock(Number(diesel.initial_liters) + totalIn - totalOut)
      }

      setLoading(false)
    }
    load()
  }, [from, to])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          {(['7', '14', '30', 'custom'] as PeriodOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setPeriod(opt)}
              className={`text-sm px-3 py-1.5 rounded-md border ${
                period === opt
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {opt === 'custom' ? 'Personalizado' : `${opt} dias`}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-lg p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">De</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Até</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            label="Estoque atual de Diesel"
            value={hasDiesel && dieselStock != null ? `${dieselStock.toFixed(0)} ${dieselUnit}` : '—'}
            sub={hasDiesel ? 'Saldo em tempo real' : 'Nenhum combustível "Diesel" cadastrado ainda'}
          />
          <Card
            label="Combustível abastecido"
            value={`${fuelLiters.toFixed(0)} L`}
            sub={periodLabels[period]}
          />
        </div>
      )}

      <Alerts maintenanceLookaheadDays={maintenanceLookaheadDays} />
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
