// OneLap telematics proxy.
// The browser never sees the OneLap login: this function adds the Authorization header from
// the ONELAP_PHONE / ONELAP_PASSWORD secrets. Owners can query every vehicle in their fleet;
// drivers can query only the vehicle assigned to them.
//
//   GET ?action=devices                                   live status of the caller's vehicles
//   GET ?action=sync                                      (owner) import OneLap devices as vehicles
//   GET ?action=latest&deviceId=123                       latest position
//   GET ?action=history&deviceId=123&from=ISO&to=ISO      route points (max 3 days)
//   GET ?action=summary&deviceId=123&from=YYYY-MM-DD&to=YYYY-MM-DD
//                                                         per-day km / moving / idle / stopped

import { admin, getCaller, handle, HttpError, json, type Caller } from '../_shared/http.ts'

const ONELAP_BASE = Deno.env.get('ONELAP_BASE_URL') ?? 'https://web.onelap.in/api'
// OneLap runs on Traccar, which reports speed in knots.
const SPEED_TO_KMH = Number(Deno.env.get('ONELAP_SPEED_FACTOR') ?? 1.852)
const MOVING_KMH = 5
const GAP_S = 20 * 60 // a gap longer than this between points is not counted as driving or idling
const IST_OFFSET_MS = 330 * 60 * 1000

type Position = {
  id: number
  deviceId?: number
  latitude: number
  longitude: number
  speed?: number
  course?: number
  fixTime?: string
  fixedTime?: string
  serverTime?: string
  ignitionOn?: boolean
  attributes?: { ignition?: boolean; totalDistance?: number; [k: string]: unknown }
  [k: string]: unknown
}

function onelapAuth() {
  const phone = Deno.env.get('ONELAP_PHONE')
  const password = Deno.env.get('ONELAP_PASSWORD')
  if (!phone || !password) throw new HttpError(500, 'ONELAP_PHONE / ONELAP_PASSWORD secrets are not set')
  return btoa(`${phone}:${password}`)
}

async function onelap<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(ONELAP_BASE + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: onelapAuth(), Accept: 'application/json' } })
  const text = await res.text()
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(502, 'OneLap rejected the login. Check ONELAP_PHONE / ONELAP_PASSWORD.')
    throw new HttpError(res.status === 404 ? 404 : 502, `OneLap ${path} failed (${res.status}): ${text.slice(0, 200)}`)
  }
  return text ? JSON.parse(text) : (null as T)
}

const kmh = (speed?: number) => (speed ?? 0) * SPEED_TO_KMH
const ignition = (p: Position) => Boolean(p.ignitionOn ?? p.attributes?.ignition)
const fixTime = (p: Position) => new Date(p.fixTime ?? p.fixedTime ?? p.serverTime ?? 0).getTime()

function withKmh(p: Position) {
  return { ...p, speedKmh: Math.round(kmh(p.speed) * 10) / 10, ignition: ignition(p) }
}

async function allowedDeviceIds(caller: Caller): Promise<number[]> {
  let q = admin.from('vehicles').select('id, onelap_device_id').eq('owner_id', caller.ownerId)
  if (caller.role === 'driver') {
    if (!caller.vehicleId) return []
    q = q.eq('id', caller.vehicleId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((v) => Number(v.onelap_device_id))
}

async function requireDevice(caller: Caller, raw: string | null) {
  if (!raw || !/^\d+$/.test(raw)) throw new HttpError(400, 'deviceId is required')
  const id = Number(raw)
  if (!(await allowedDeviceIds(caller)).includes(id)) throw new HttpError(403, 'You do not have access to this vehicle')
  return id
}

async function history(deviceId: number, from: Date, to: Date): Promise<Position[]> {
  const params = { deviceId: String(deviceId), from: from.toISOString(), to: to.toISOString() }
  let points: Position[]
  try {
    points = await onelap<Position[]>('/reports/mini-route', params)
  } catch (e) {
    // The Postman collection uses an older path; fall back to it.
    if (e instanceof HttpError && e.status === 404) points = await onelap<Position[]>('/positions/mini', params)
    else throw e
  }
  return (points ?? []).filter((p) => p.latitude && p.longitude).sort((a, b) => fixTime(a) - fixTime(b))
}

function haversineKm(a: Position, b: Position) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Totals for one IST day. Stopped = time in the window that was neither moving nor idling. */
function computeDay(points: Position[], windowS: number) {
  let moving = 0
  let idle = 0
  let km = 0
  let maxSpeed = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    maxSpeed = Math.max(maxSpeed, kmh(p.speed))
    if (i === 0) continue
    const prev = points[i - 1]
    const dt = (fixTime(p) - fixTime(prev)) / 1000
    const step = haversineKm(prev, p)
    // ignore GPS jumps faster than 150 km/h
    if (dt > 0 && step / (dt / 3600) < 150) km += step
    if (dt <= 0 || dt > GAP_S) continue
    if (kmh(prev.speed) >= MOVING_KMH) moving += dt
    else if (ignition(prev)) idle += dt
  }
  // Prefer the device's own distance over GPS geometry: first the odometer delta
  // (totalDistance, metres), then the sum of per-point distances, else the haversine sum above.
  const first = points[0]?.attributes?.totalDistance
  const last = points.at(-1)?.attributes?.totalDistance
  const perPoint = points.slice(1).reduce((a, p) => a + (typeof p.attributes?.distance === 'number' ? (p.attributes.distance as number) : 0), 0) / 1000
  const odoKm = typeof first === 'number' && typeof last === 'number' ? (last - first) / 1000 : NaN
  if (odoKm > 0 && odoKm < 1500) km = odoKm
  else if (perPoint > 0 && perPoint < 1500) km = perPoint
  moving = Math.min(moving, windowS)
  idle = Math.min(idle, windowS - moving)
  return {
    km: Math.round(km * 10) / 10,
    moving_s: Math.round(moving),
    idle_s: Math.round(idle),
    stopped_s: Math.max(0, Math.round(windowS - moving - idle)),
    max_speed: Math.round(maxSpeed),
    points: points.length,
  }
}

/** IST calendar day -> [start, end) in UTC. */
function istDay(day: string) {
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - IST_OFFSET_MS)
  return { start, end: new Date(start.getTime() + 86400_000) }
}

function istToday() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  const out: string[] = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

async function summary(deviceId: number, from: string, to: string) {
  const today = istToday()
  const days = daysBetween(from, to > today ? today : to)
  if (days.length > 62) throw new HttpError(400, 'Pick a range of at most 62 days')

  const { data: cached } = await admin
    .from('daily_stats')
    .select('*')
    .eq('device_id', deviceId)
    .gte('day', from)
    .lte('day', to)
  const byDay = new Map((cached ?? []).map((r) => [r.day as string, r]))

  const missing = days.filter((d) => d === today || !byDay.has(d))
  const fresh = await mapLimit(missing, 4, async (day) => {
    const { start, end } = istDay(day)
    const until = day === today ? new Date() : end
    const pts = await history(deviceId, start, until)
    return { device_id: deviceId, day, ...computeDay(pts, (until.getTime() - start.getTime()) / 1000) }
  })
  const finished = fresh.filter((r) => r.day !== today)
  if (finished.length) await admin.from('daily_stats').upsert(finished)
  for (const r of fresh) byDay.set(r.day, r)

  const rows = days.map((day) => {
    const r = byDay.get(day)
    return { day, km: r?.km ?? 0, moving_s: r?.moving_s ?? 0, idle_s: r?.idle_s ?? 0, stopped_s: r?.stopped_s ?? 0, max_speed: r?.max_speed ?? 0 }
  })
  const total = rows.reduce(
    (t, r) => ({
      km: t.km + r.km,
      moving_s: t.moving_s + r.moving_s,
      idle_s: t.idle_s + r.idle_s,
      stopped_s: t.stopped_s + r.stopped_s,
      max_speed: Math.max(t.max_speed, r.max_speed),
    }),
    { km: 0, moving_s: 0, idle_s: 0, stopped_s: 0, max_speed: 0 },
  )
  total.km = Math.round(total.km * 10) / 10
  return { deviceId, from, to, days: rows, total }
}

Deno.serve(
  handle(async (req) => {
    const caller = await getCaller(req)
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'devices') {
      const ids = await allowedDeviceIds(caller)
      if (!ids.length) return json([])
      const devices = await onelap<Record<string, unknown>[]>('/devices/v2')
      return json((devices ?? []).filter((d) => ids.includes(Number(d.id))))
    }

    if (action === 'sync') {
      if (caller.role !== 'owner') throw new HttpError(403, 'Only the owner can import vehicles')
      const devices = await onelap<{ id: number; name?: string; attributes?: { vehicleNumber?: string } }[]>('/devices/v2')
      const { data: existing } = await admin.from('vehicles').select('onelap_device_id').eq('owner_id', caller.id)
      const known = new Set((existing ?? []).map((v) => Number(v.onelap_device_id)))
      const rows = (devices ?? [])
        .filter((d) => !known.has(Number(d.id)))
        .map((d) => ({
          owner_id: caller.id,
          onelap_device_id: d.id,
          reg_no: d.attributes?.vehicleNumber || d.name || String(d.id),
          name: d.name ?? null,
        }))
      if (rows.length) {
        const { error } = await admin.from('vehicles').insert(rows)
        if (error) throw error
      }
      return json({ added: rows.length, total: devices?.length ?? 0 })
    }

    const deviceId = await requireDevice(caller, url.searchParams.get('deviceId'))

    if (action === 'latest') {
      return json(withKmh(await onelap<Position>('/positions/latest', { deviceId: String(deviceId) })))
    }

    if (action === 'history') {
      const from = new Date(url.searchParams.get('from') ?? '')
      const to = new Date(url.searchParams.get('to') ?? '')
      if (isNaN(+from) || isNaN(+to) || to <= from) throw new HttpError(400, 'Valid from and to are required')
      if (+to - +from > 3 * 86400_000) throw new HttpError(400, 'Route replay is limited to 3 days')
      return json((await history(deviceId, from, to)).map(withKmh))
    }

    if (action === 'summary') {
      const from = url.searchParams.get('from') ?? ''
      const to = url.searchParams.get('to') ?? ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw new HttpError(400, 'from and to must be YYYY-MM-DD')
      }
      return json(await summary(deviceId, from, to))
    }

    throw new HttpError(400, 'Unknown action')
  }),
)
