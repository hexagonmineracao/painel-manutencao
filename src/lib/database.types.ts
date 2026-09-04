export type Role = 'admin' | 'colaborador'
export type MaintenanceType = 'preventiva' | 'corretiva' | 'outro'

export interface Profile {
  id: string
  full_name: string
  username: string
  role: Role
  created_at: string
}

export interface Machine {
  id: string
  model: string
  name: string
  number: string
  current_hourmeter: number
  maintenance_interval_hours: number | null
  status: string
  created_at: string
}

export interface MaintenanceRecord {
  id: string
  machine_id: string
  user_id: string
  performed_at: string
  hourmeter: number
  type: MaintenanceType
  description: string
  cost: number | null
  next_due_hourmeter: number | null
  created_at: string
}

export interface FuelType {
  id: string
  name: string
  unit: string
  min_stock: number | null
  initial_liters: number
  initial_date: string
  created_at: string
}

export interface FuelRecord {
  id: string
  machine_id: string
  user_id: string
  fuel_type_id: string
  recorded_at: string
  hourmeter: number
  liters: number
  cost: number | null
  created_at: string
}

export interface FuelDelivery {
  id: string
  user_id: string
  fuel_type_id: string
  delivered_at: string
  liters: number
  total_cost: number
  supplier: string | null
  notes: string | null
  created_at: string
}

export type AlertSeverity = 'atencao' | 'alerta' | 'critica'

export interface AlertDismissal {
  id: string
  alert_key: string
  dismissed_by: string
  dismissed_at: string
  remind_at: string | null
}

export interface Material {
  id: string
  name: string
  unit: string
  min_stock: number | null
  created_at: string
}

export type MaterialMovementType = 'entrada' | 'saida'

export interface MaterialMovement {
  id: string
  material_id: string
  machine_id: string | null
  user_id: string
  type: MaterialMovementType
  quantity: number
  cost: number | null
  moved_at: string
  notes: string | null
  created_at: string
}
