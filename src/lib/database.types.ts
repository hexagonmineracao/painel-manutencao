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
  created_at: string
}

export interface FuelRecord {
  id: string
  machine_id: string
  user_id: string
  recorded_at: string
  hourmeter: number
  liters: number
  cost: number | null
  created_at: string
}

export interface FuelDelivery {
  id: string
  user_id: string
  delivered_at: string
  liters: number
  total_cost: number
  supplier: string | null
  notes: string | null
  created_at: string
}
