import { supabase } from './supabase'
import type { OnelapDevice, Position, Summary } from './types'

async function errorMessage(error: { message: string; context?: unknown }) {
  try {
    const body = await (error.context as Response | undefined)?.json()
    if (body?.error) return body.error as string
  } catch {
    // keep the generic message
  }
  return error.message
}

async function get<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const { data, error } = await supabase.functions.invoke(`onelap?${qs}`, { method: 'GET' })
  if (error) throw new Error(await errorMessage(error))
  return data as T
}

export const onelap = {
  devices: () => get<OnelapDevice[]>({ action: 'devices' }),
  sync: () => get<{ added: number; total: number }>({ action: 'sync' }),
  latest: (deviceId: number) => get<Position>({ action: 'latest', deviceId: String(deviceId) }),
  history: (deviceId: number, from: Date, to: Date) =>
    get<Position[]>({ action: 'history', deviceId: String(deviceId), from: from.toISOString(), to: to.toISOString() }),
  summary: (deviceId: number, from: string, to: string) =>
    get<Summary>({ action: 'summary', deviceId: String(deviceId), from, to }),
}

export async function driversApi(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('drivers', { body })
  if (error) throw new Error(await errorMessage(error))
  return data
}

export const positionTime = (p: Pick<Position, 'fixTime' | 'fixedTime' | 'serverTime'>) =>
  p.fixTime ?? p.fixedTime ?? p.serverTime ?? null

export type VehicleState = 'moving' | 'idle' | 'stopped' | 'offline'

export function vehicleState(p: Position | null | undefined): VehicleState {
  if (!p) return 'offline'
  const t = positionTime(p)
  if (!t || Date.now() - new Date(t).getTime() > 2 * 60 * 60 * 1000) return 'offline'
  if (p.speedKmh >= 5) return 'moving'
  return p.ignition ? 'idle' : 'stopped'
}

export const STATE_META: Record<VehicleState, { label: string; color: string; tone: 'green' | 'amber' | 'red' | 'slate' }> = {
  moving: { label: 'Moving', color: '#34d399', tone: 'green' },
  idle: { label: 'Idle', color: '#fbbf24', tone: 'amber' },
  stopped: { label: 'Stopped', color: '#f87171', tone: 'red' },
  offline: { label: 'Offline', color: '#64748b', tone: 'slate' },
}
