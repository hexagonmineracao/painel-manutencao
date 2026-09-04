import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { exportToCsv } from '../lib/csv'
import type {
  FuelDelivery,
  FuelRecord,
  FuelType,
  Machine,
  MaintenanceRecord,
  Material,
  MaterialMovement,
  Profile,
} from '../lib/database.types'

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

interface MaterialRow {
  material: Material
  entradaQty: number
  entradaCost: number
  saidaQty: number
}

interface FuelTypeRow {
  fuelType: FuelType
  entradaQty: number
  entradaCost: number
  saidaQty: number
}

export function Reports() {
  const [from, setFrom] = useState(daysAgoInput(30))
  const [to, setTo] = useState(todayInput())
  const [loading, setLoading] = useState(true)
  const [fuelRows, setFuelRows] = useState<FuelRow[]>([])
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceRow[]>([])
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [fuelTypeRows, setFuelTypeRows] = useState<FuelTypeRow[]>([])
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([])
  const [materialMovements, setMaterialMovements] = useState<MaterialMovement[]>([])
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [machinesList, setMachinesList] = useState<Machine[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const fromISO = new Date(from + 'T00:00:00').toISOString()
      const toISO = new Date(to + 'T23:59:59').toISOString()

      const [
        machinesRes,
        fuelRes,
        maintenanceRes,
        deliveriesRes,
        materialsRes,
        movementsRes,
        fuelTypesRes,
        profilesRes,
      ] = await Promise.all([
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
          supabase.from('materials').select('*').order('name').returns<Material[]>(),
          supabase
            .from('material_movements')
            .select('*')
            .gte('moved_at', fromISO)
            .lte('moved_at', toISO)
            .returns<MaterialMovement[]>(),
          supabase.from('fuel_types').select('*').order('name').returns<FuelType[]>(),
          supabase.from('profiles').select('*').returns<Profile[]>(),
        ])

      const machines = machinesRes.data ?? []
      setMachinesList(machines)
      const fuel = fuelRes.data ?? []
      setFuelRecords(fuel)
      const maintenance = maintenanceRes.data ?? []
      setMaintenanceRecords(maintenance)
      const deliveries = deliveriesRes.data ?? []
      setDeliveries(deliveries)
      setProfiles(profilesRes.data ?? [])

      const types = fuelTypesRes.data ?? []
      setFuelTypes(types)
      const computedFuelTypeRows: FuelTypeRow[] = types
        .map((fuelType) => {
          const entradas = deliveries.filter((d) => d.fuel_type_id === fuelType.id)
          const saidas = fuel.filter((r) => r.fuel_type_id === fuelType.id)
          if (entradas.length === 0 && saidas.length === 0) return null
          return {
            fuelType,
            entradaQty: entradas.reduce((s, d) => s + Number(d.liters), 0),
            entradaCost: entradas.reduce((s, d) => s + Number(d.total_cost), 0),
            saidaQty: saidas.reduce((s, r) => s + Number(r.liters), 0),
          }
        })
        .filter((r): r is FuelTypeRow => r !== null)
      setFuelTypeRows(computedFuelTypeRows)

      const materials = materialsRes.data ?? []
      setMaterials(materials)
      const movements = movementsRes.data ?? []
      setMaterialMovements(movements)
      const movementsByMaterial = new Map<string, MaterialMovement[]>()
      for (const mv of movements) {
        const list = movementsByMaterial.get(mv.material_id) ?? []
        list.push(mv)
        movementsByMaterial.set(mv.material_id, list)
      }
      const computedMaterialRows: MaterialRow[] = materials
        .map((material) => {
          const recs = movementsByMaterial.get(material.id) ?? []
          if (recs.length === 0) return null
          const entradas = recs.filter((r) => r.type === 'entrada')
          const saidas = recs.filter((r) => r.type === 'saida')
          return {
            material,
            entradaQty: entradas.reduce((s, r) => s + Number(r.quantity), 0),
            entradaCost: entradas.reduce((s, r) => s + Number(r.cost ?? 0), 0),
            saidaQty: saidas.reduce((s, r) => s + Number(r.quantity), 0),
          }
        })
        .filter((r): r is MaterialRow => r !== null)
      setMaterialRows(computedMaterialRows)

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

  function fuelTypeName(id: string) {
    return fuelTypes.find((t) => t.id === id)?.name ?? '—'
  }

  function userName(id: string) {
    return profiles.find((p) => p.id === id)?.full_name ?? '—'
  }

  function machineName(id: string | null) {
    if (!id) return '—'
    return machinesList.find((m) => m.id === id)?.name ?? '—'
  }

  function materialName(id: string) {
    return materials.find((m) => m.id === id)?.name ?? '—'
  }

  function exportDeliveries() {
    exportToCsv(
      `entradas_combustivel_${from}_a_${to}`,
      ['Tipo', 'Data/hora', 'Litros', 'Valor', 'R$/L', 'Fornecedor', 'Usuário'],
      deliveries.map((d) => [
        fuelTypeName(d.fuel_type_id),
        new Date(d.delivered_at).toLocaleString('pt-BR'),
        Number(d.liters).toFixed(1),
        Number(d.total_cost).toFixed(2),
        (Number(d.total_cost) / Number(d.liters)).toFixed(3),
        d.supplier ?? '',
        userName(d.user_id),
      ]),
    )
  }

  function exportFuelRecords() {
    exportToCsv(
      `abastecimentos_${from}_a_${to}`,
      ['Máquina', 'Combustível', 'Data/hora', 'Horímetro', 'Litros', 'Custo', 'Usuário'],
      fuelRecords.map((r) => [
        machineName(r.machine_id),
        fuelTypeName(r.fuel_type_id),
        new Date(r.recorded_at).toLocaleString('pt-BR'),
        r.hourmeter,
        Number(r.liters).toFixed(1),
        r.cost != null ? Number(r.cost).toFixed(2) : '',
        userName(r.user_id),
      ]),
    )
  }

  function exportMaterialMovements() {
    exportToCsv(
      `movimentacoes_estoque_${from}_a_${to}`,
      ['Material', 'Tipo', 'Data/hora', 'Quantidade', 'Máquina', 'Usuário'],
      materialMovements.map((m) => [
        materialName(m.material_id),
        m.type === 'entrada' ? 'Entrada' : 'Saída',
        new Date(m.moved_at).toLocaleString('pt-BR'),
        Number(m.quantity).toFixed(1),
        machineName(m.machine_id),
        userName(m.user_id),
      ]),
    )
  }

  function exportMaintenanceRecords() {
    exportToCsv(
      `manutencoes_${from}_a_${to}`,
      ['Máquina', 'Tipo', 'Descrição', 'Data/hora', 'Horímetro', 'Custo', 'Usuário'],
      maintenanceRecords.map((r) => [
        machineName(r.machine_id),
        r.type,
        r.description,
        new Date(r.performed_at).toLocaleString('pt-BR'),
        r.hourmeter,
        r.cost != null ? Number(r.cost).toFixed(2) : '',
        userName(r.user_id),
      ]),
    )
  }

  function exportFuelTypes() {
    exportToCsv(
      `combustivel_por_tipo_${from}_a_${to}`,
      ['Combustível', 'Entradas', 'Custo entradas', 'Saídas'],
      fuelTypeRows.map((r) => [
        r.fuelType.name,
        `${r.entradaQty.toFixed(1)} ${r.fuelType.unit}`,
        r.entradaCost.toFixed(2),
        `${r.saidaQty.toFixed(1)} ${r.fuelType.unit}`,
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

  function exportMaterials() {
    exportToCsv(
      `materiais_${from}_a_${to}`,
      ['Material', 'Entradas', 'Custo entradas', 'Saídas'],
      materialRows.map((r) => [
        r.material.name,
        `${r.entradaQty.toFixed(1)} ${r.material.unit}`,
        r.entradaCost.toFixed(2),
        `${r.saidaQty.toFixed(1)} ${r.material.unit}`,
      ]),
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
              <span>Combustível por tipo</span>
              <button onClick={exportFuelTypes} className="text-xs text-slate-500 underline hover:text-slate-900">
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Combustível</th>
                    <th className="px-4 py-2 font-medium">Entradas</th>
                    <th className="px-4 py-2 font-medium">Custo entradas</th>
                    <th className="px-4 py-2 font-medium">Saídas</th>
                    <th className="px-4 py-2 font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelTypeRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-slate-500">
                        Sem movimentações no período.
                      </td>
                    </tr>
                  ) : (
                    fuelTypeRows.map((row) => {
                      const diff = row.entradaQty - row.saidaQty
                      return (
                        <tr key={row.fuelType.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 text-slate-900">{row.fuelType.name}</td>
                          <td className="px-4 py-2">
                            {row.entradaQty.toFixed(0)} {row.fuelType.unit}
                          </td>
                          <td className="px-4 py-2">R$ {row.entradaCost.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            {row.saidaQty.toFixed(0)} {row.fuelType.unit}
                          </td>
                          <td className={diff < 0 ? 'px-4 py-2 text-red-600 font-medium' : 'px-4 py-2'}>
                            {diff.toFixed(0)} {row.fuelType.unit}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Entrada de combustível</span>
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
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Litros</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">R$/L</th>
                  <th className="px-4 py-2 font-medium">Fornecedor</th>
                  <th className="px-4 py-2 font-medium">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-slate-500">
                      Sem entradas no período.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-900">{fuelTypeName(d.fuel_type_id)}</td>
                      <td className="px-4 py-2 text-slate-900">
                        {new Date(d.delivered_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2">{Number(d.liters).toFixed(1)} L</td>
                      <td className="px-4 py-2">R$ {Number(d.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-2">R$ {(Number(d.total_cost) / Number(d.liters)).toFixed(3)}</td>
                      <td className="px-4 py-2 text-slate-500">{d.supplier ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{userName(d.user_id)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Abastecimentos (saída de combustível)</span>
              <button onClick={exportFuelRecords} className="text-xs text-slate-500 underline hover:text-slate-900">
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Máquina</th>
                    <th className="px-4 py-2 font-medium">Combustível</th>
                    <th className="px-4 py-2 font-medium">Data/hora</th>
                    <th className="px-4 py-2 font-medium">Horímetro</th>
                    <th className="px-4 py-2 font-medium">Litros</th>
                    <th className="px-4 py-2 font-medium">Custo</th>
                    <th className="px-4 py-2 font-medium">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-slate-500">
                        Sem abastecimentos no período.
                      </td>
                    </tr>
                  ) : (
                    fuelRecords
                      .slice()
                      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
                      .map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 text-slate-900">{machineName(r.machine_id)}</td>
                          <td className="px-4 py-2">{fuelTypeName(r.fuel_type_id)}</td>
                          <td className="px-4 py-2">{new Date(r.recorded_at).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-2">{r.hourmeter} h</td>
                          <td className="px-4 py-2">{Number(r.liters).toFixed(1)} L</td>
                          <td className="px-4 py-2">{r.cost != null ? `R$ ${Number(r.cost).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{userName(r.user_id)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
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

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Manutenções</span>
              <button
                onClick={exportMaintenanceRecords}
                className="text-xs text-slate-500 underline hover:text-slate-900"
              >
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Máquina</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Descrição</th>
                    <th className="px-4 py-2 font-medium">Data/hora</th>
                    <th className="px-4 py-2 font-medium">Custo</th>
                    <th className="px-4 py-2 font-medium">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        Sem manutenções no período.
                      </td>
                    </tr>
                  ) : (
                    maintenanceRecords
                      .slice()
                      .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
                      .map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 text-slate-900">{machineName(r.machine_id)}</td>
                          <td className="px-4 py-2 capitalize">{r.type}</td>
                          <td className="px-4 py-2 text-slate-500">{r.description}</td>
                          <td className="px-4 py-2">{new Date(r.performed_at).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-2">{r.cost != null ? `R$ ${Number(r.cost).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{userName(r.user_id)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-900 flex items-center justify-between gap-3">
              <span>Materiais (estoque)</span>
              <button onClick={exportMaterials} className="text-xs text-slate-500 underline hover:text-slate-900">
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Material</th>
                    <th className="px-4 py-2 font-medium">Entradas</th>
                    <th className="px-4 py-2 font-medium">Custo entradas</th>
                    <th className="px-4 py-2 font-medium">Saídas</th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-slate-500">
                        Sem movimentações no período.
                      </td>
                    </tr>
                  ) : (
                    materialRows.map((row) => (
                      <tr key={row.material.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 text-slate-900">{row.material.name}</td>
                        <td className="px-4 py-2">
                          {row.entradaQty.toFixed(1)} {row.material.unit}
                        </td>
                        <td className="px-4 py-2">R$ {row.entradaCost.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          {row.saidaQty.toFixed(1)} {row.material.unit}
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
              <span>Movimentações de estoque</span>
              <button
                onClick={exportMaterialMovements}
                className="text-xs text-slate-500 underline hover:text-slate-900"
              >
                Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-2 font-medium">Material</th>
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Data/hora</th>
                    <th className="px-4 py-2 font-medium">Quantidade</th>
                    <th className="px-4 py-2 font-medium">Máquina</th>
                    <th className="px-4 py-2 font-medium">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {materialMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-slate-500">
                        Sem movimentações no período.
                      </td>
                    </tr>
                  ) : (
                    materialMovements
                      .slice()
                      .sort((a, b) => new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime())
                      .map((m) => (
                        <tr key={m.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 text-slate-900">{materialName(m.material_id)}</td>
                          <td className={m.type === 'entrada' ? 'px-4 py-2 text-green-700' : 'px-4 py-2'}>
                            {m.type === 'entrada' ? 'Entrada' : 'Saída'}
                          </td>
                          <td className="px-4 py-2">{new Date(m.moved_at).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-2">{Number(m.quantity).toFixed(1)}</td>
                          <td className="px-4 py-2 text-slate-500">{machineName(m.machine_id)}</td>
                          <td className="px-4 py-2 text-slate-500">{userName(m.user_id)}</td>
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
