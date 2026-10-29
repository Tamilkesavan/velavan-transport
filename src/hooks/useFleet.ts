import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { onelap } from '@/lib/onelap'
import type { Position, Summary, Vehicle } from '@/lib/types'

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('vehicles').select('id, onelap_device_id, reg_no, name').order('reg_no')
    if (error) setError(error.message)
    setVehicles((data ?? []) as Vehicle[])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { vehicles, loading, error, reload }
}

export const LIVE_INTERVAL_MS = 10000

/** Latest position of each vehicle from OneLap, refreshed every 10 seconds. */
export function useLivePositions(vehicles: Vehicle[], intervalMs = LIVE_INTERVAL_MS) {
  const [positions, setPositions] = useState<Record<number, Position | null>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const key = vehicles.map((v) => v.onelap_device_id).join(',')
  const vehiclesRef = useRef(vehicles)
  vehiclesRef.current = vehicles

  const refresh = useCallback(async () => {
    const list = vehiclesRef.current
    const results = await Promise.allSettled(list.map((v) => onelap.latest(v.onelap_device_id)))
    const pos: Record<number, Position | null> = {}
    const errs: Record<number, string> = {}
    results.forEach((r, i) => {
      const id = list[i].onelap_device_id
      if (r.status === 'fulfilled') pos[id] = r.value
      else {
        pos[id] = null
        errs[id] = r.reason instanceof Error ? r.reason.message : String(r.reason)
      }
    })
    setPositions(pos)
    setErrors(errs)
    setUpdatedAt(new Date())
  }, [])

  useEffect(() => {
    if (!key) return
    refresh()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, intervalMs)
    return () => clearInterval(t)
  }, [key, intervalMs, refresh])

  return { positions, errors, updatedAt, refresh }
}

export function useSummaries(vehicles: Vehicle[], from: string, to: string) {
  const [summaries, setSummaries] = useState<Record<number, Summary>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = vehicles.map((v) => v.onelap_device_id).join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled(vehicles.map((v) => onelap.summary(v.onelap_device_id, from, to))).then((results) => {
      if (cancelled) return
      const out: Record<number, Summary> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') out[vehicles[i].onelap_device_id] = r.value
        else setError(r.reason instanceof Error ? r.reason.message : String(r.reason))
      })
      setSummaries(out)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, from, to])

  return { summaries, loading, error }
}
