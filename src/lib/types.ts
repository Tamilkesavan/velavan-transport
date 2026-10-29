export type Role = 'owner' | 'driver'

export type Profile = {
  id: string
  role: Role
  name: string | null
  phone: string | null
  owner_id: string | null
  vehicle_id: string | null
  active: boolean
  created_at: string
}

export type Vehicle = {
  id: string
  onelap_device_id: number
  reg_no: string
  name: string | null
}

/** OneLap position, plus speedKmh / ignition added by the proxy. */
export type Position = {
  id: number
  deviceId?: number
  latitude: number
  longitude: number
  speed: number
  speedKmh: number
  ignition: boolean
  course?: number
  fixTime?: string
  fixedTime?: string
  serverTime?: string
  address?: string | null
  attributes?: {
    battery?: number
    gsm?: number
    sat?: number
    totalDistance?: number
    charge?: boolean
    [k: string]: unknown
  }
}

export type OnelapDevice = {
  id: number
  name: string
  status: string
  lastUpdate: string | null
  validity?: string
  latitude?: number
  longitude?: number
  [k: string]: unknown
}

export type DayStat = { day: string; km: number; moving_s: number; idle_s: number; stopped_s: number; max_speed: number }

export type Summary = {
  deviceId: number
  from: string
  to: string
  days: DayStat[]
  total: Omit<DayStat, 'day'>
}
