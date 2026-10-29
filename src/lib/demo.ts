// Demo mode (npm run demo): answers every Supabase / OneLap call in the browser with sample
// data, so the app can be tried on localhost before any backend is set up.

import type { DayStat, Position, Profile, Vehicle } from './types'

export const DEMO = import.meta.env.VITE_DEMO === 'true'
export const DEMO_DRIVER_PHONE = '9876543210'

const DRIVER_DOMAIN = 'drivers.velavan.app'
const OWNER: Profile = { id: 'owner-1', role: 'owner', name: 'Tamil', phone: null, owner_id: null, vehicle_id: null, active: true, created_at: '' }

const vehicles: Vehicle[] = [
  { id: 'veh-4950', onelap_device_id: 4950, reg_no: 'TN 28 AX 4950', name: 'Tata 1612' },
  { id: 'veh-7681', onelap_device_id: 7681, reg_no: 'TN 28 BK 7681', name: 'Ashok Leyland' },
  { id: 'veh-3565', onelap_device_id: 3565, reg_no: 'TN 28 AZ 3565', name: 'Eicher Pro' },
]

const profiles: Profile[] = [
  OWNER,
  { id: 'drv-1', role: 'driver', name: 'Murugan', phone: DEMO_DRIVER_PHONE, owner_id: OWNER.id, vehicle_id: 'veh-4950', active: true, created_at: '' },
  { id: 'drv-2', role: 'driver', name: 'Selvam', phone: '9123456780', owner_id: OWNER.id, vehicle_id: 'veh-7681', active: true, created_at: '' },
]

// Each lorry runs its own loop out of Namakkal. Coordinates are real towns on those roads.
const ROUTES: Record<number, [number, number][]> = {
  4950: [[11.219, 78.167], [11.33, 78.12], [11.45, 78.13], [11.664, 78.146], [11.6, 77.95], [11.45, 77.8], [11.34, 77.717], [11.28, 77.9], [11.219, 78.167]], // Salem, Erode
  7681: [[11.219, 78.167], [11.1, 78.0], [11.06, 77.75], [11.017, 76.956], [11.06, 77.35], [11.15, 77.9], [11.219, 78.167]], // Tiruppur, Coimbatore
  3565: [[11.219, 78.167], [11.08, 78.35], [10.95, 78.55], [10.79, 78.704], [10.95, 78.45], [11.219, 78.167]], // Tiruchirappalli
}
const ODO_START: Record<number, number> = { 4950: 182_340, 7681: 241_115, 3565: 96_870 }

/** Deterministic pseudo-random number from a string, so figures are stable across reloads. */
function rand(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function km(a: [number, number], b: [number, number]) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Point at fraction f of the route's length (by distance, so speed stays even across legs). */
function pointOnRoute(route: [number, number][], f: number) {
  const legs = route.slice(1).map((pt, i) => km(route[i], pt))
  let target = legs.reduce((a, b) => a + b, 0) * Math.min(0.9999, Math.max(0, f))
  let i = 0
  while (i < legs.length - 1 && target > legs[i]) target -= legs[i++]
  const t = legs[i] ? target / legs[i] : 0
  const [a, b] = [route[i], route[i + 1]]
  const course = ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 360) % 360
  return { lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, course }
}

const dayCache = new Map<string, Position[]>()

/**
 * One simulated working day for a lorry: leaves 5–7 am, a tea stop and a lunch stop with the
 * engine idling, an unloading stop with the engine off. Points every 2 minutes, like a OneLap
 * mini-route, and the reported speed always matches the distance between points.
 * Monthly figures and route replay are both computed from these same points.
 */
function dayPoints(deviceId: number, day: string): Position[] {
  const key = `${deviceId}:${day}`
  const hit = dayCache.get(key)
  if (hit) return hit
  const r = rand(key)
  const out: Position[] = []
  if (r >= 0.1) {
    const route = ROUTES[deviceId] ?? ROUTES[4950]
    const loopKm = route.slice(1).reduce((a, pt, i) => a + km(route[i], pt), 0)
    const reach = 1.1 + rand(`reach${key}`) * 0.9 // loops covered that day (1.1–2)
    const avgKmh = 38 + rand(`v${key}`) * 10
    const driveMin = Math.round(((loopKm * reach) / avgKmh) * 60)
    const stops = [
      { at: 0.25, min: 20, ignition: true }, // tea, engine idling
      { at: 0.55, min: 45, ignition: true }, // lunch, engine idling
      { at: 0.8, min: 16, ignition: false }, // unloading, engine off
    ]
    const startMin = (deviceId === 7681 ? 600 : 300) + Math.round(r * 120) // leaves 5–7 am (7681: 10 am–noon)
    const base = new Date(`${day}T00:00:00`).getTime()
    let odo = (ODO_START[deviceId] ?? 100_000) * 1000 + (new Date(day).getTime() / 86400000 - 20_000) * 165_000
    let driven = 0 // minutes of driving done
    let clock = 0 // minutes since leaving
    let prev = pointOnRoute(route, 0)
    let stopIdx = 0
    let stopLeft = 0
    while (driven < driveMin) {
      let kmh = 0
      let ignition = true
      if (stopLeft > 0) {
        stopLeft -= 2
        ignition = stops[stopIdx - 1].ignition
      } else if (stopIdx < stops.length && driven / driveMin >= stops[stopIdx].at) {
        stopLeft = stops[stopIdx].min - 2
        ignition = stops[stopIdx].ignition
        stopIdx++
      } else {
        driven += 2
        const p = pointOnRoute(route, ((driven / driveMin) * reach) % 1)
        const stepKm = km([prev.lat, prev.lng], [p.lat, p.lng])
        odo += stepKm * 1000
        kmh = stepKm * 30 * (0.9 + rand(`${key}${clock}`) * 0.2) // speed matches distance covered
        prev = p
      }
      clock += 2
      out.push({
        id: base + clock,
        deviceId,
        latitude: prev.lat,
        longitude: prev.lng,
        speed: kmh / 1.852,
        speedKmh: Math.round(kmh),
        ignition,
        course: prev.course,
        fixTime: new Date(base + (startMin + clock) * 60000).toISOString(),
        attributes: { totalDistance: odo, battery: 5, gsm: 4 },
      })
    }
  }
  dayCache.set(key, out)
  return out
}

function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function latest(deviceId: number): Position {
  const now = Date.now()
  const today = dayPoints(deviceId, localDay(new Date()))
  const done = today.filter((p) => new Date(p.fixTime!).getTime() <= now)
  if (done.length && done.length < today.length) {
    // On the road: interpolate between the 2-minute points so the marker glides every 10 s.
    const a = done.at(-1)!
    const b = today[done.length]
    const k = (now - new Date(a.fixTime!).getTime()) / 120000
    return { ...a, latitude: a.latitude + (b.latitude - a.latitude) * k, longitude: a.longitude + (b.longitude - a.longitude) * k, fixTime: new Date(now - 4000).toISOString() }
  }
  const last = done.at(-1) ?? dayPoints(deviceId, localDay(new Date(now - 86400000))).at(-1)
  const home = ROUTES[deviceId]?.[0] ?? [11.219, 78.167]
  return {
    id: now,
    deviceId,
    latitude: last?.latitude ?? home[0],
    longitude: last?.longitude ?? home[1],
    speed: 0,
    speedKmh: 0,
    ignition: false,
    course: last?.course ?? 0,
    // parked devices still send a heartbeat every few minutes
    fixTime: new Date(now - 3 * 60000).toISOString(),
    attributes: { totalDistance: last?.attributes?.totalDistance, battery: 5, gsm: 3 },
  }
}

function history(deviceId: number, from: Date, to: Date): Position[] {
  const out: Position[] = []
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) out.push(...dayPoints(deviceId, localDay(d)))
  return out.filter((p) => {
    const t = new Date(p.fixTime!).getTime()
    return t >= from.getTime() && t <= to.getTime()
  })
}

/** Same rules as the onelap edge function: odometer km, moving >= 5 km/h, idle = ignition on. */
function computeDay(points: Position[], windowS: number): Omit<DayStat, 'day'> {
  let moving = 0
  let idle = 0
  let maxSpeed = 0
  for (let i = 0; i < points.length; i++) {
    maxSpeed = Math.max(maxSpeed, points[i].speedKmh)
    if (!i) continue
    const dt = (new Date(points[i].fixTime!).getTime() - new Date(points[i - 1].fixTime!).getTime()) / 1000
    if (dt <= 0 || dt > 1200) continue
    if (points[i - 1].speedKmh >= 5) moving += dt
    else if (points[i - 1].ignition) idle += dt
  }
  const odo = points.length ? (points.at(-1)!.attributes!.totalDistance! - points[0].attributes!.totalDistance!) / 1000 : 0
  return { km: Math.round(odo * 10) / 10, moving_s: Math.round(moving), idle_s: Math.round(idle), stopped_s: Math.max(0, Math.round(windowS - moving - idle)), max_speed: Math.round(maxSpeed) }
}

function summary(deviceId: number, from: string, to: string) {
  const days: DayStat[] = []
  const today = localDay(new Date())
  for (let d = new Date(`${from}T00:00:00`); localDay(d) <= (to > today ? today : to); d.setDate(d.getDate() + 1)) {
    const day = localDay(d)
    const start = new Date(`${day}T00:00:00`)
    const until = day === today ? new Date() : new Date(start.getTime() + 86400000)
    days.push({ day, ...computeDay(history(deviceId, start, until), (until.getTime() - start.getTime()) / 1000) })
  }
  const total = days.reduce(
    (t, r) => ({ km: t.km + r.km, moving_s: t.moving_s + r.moving_s, idle_s: t.idle_s + r.idle_s, stopped_s: t.stopped_s + r.stopped_s, max_speed: Math.max(t.max_speed, r.max_speed) }),
    { km: 0, moving_s: 0, idle_s: 0, stopped_s: 0, max_speed: 0 },
  )
  total.km = Math.round(total.km * 10) / 10
  return { deviceId, from, to, days, total }
}

let currentUserId: string | null = null

function userIdFromRequest(headers: Headers) {
  const token = (headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  return token.startsWith('demo-') ? token.slice(5) : currentUserId
}

function session(p: Profile, email: string) {
  currentUserId = p.id
  return {
    access_token: `demo-${p.id}`,
    refresh_token: `demo-refresh-${p.id}`,
    token_type: 'bearer',
    expires_in: 86400 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
    user: { id: p.id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '' },
  }
}

const reply = (body: unknown, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Pull `col=eq.value` filters out of a PostgREST query string. */
function eqFilters(url: URL) {
  const f: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    if (v.startsWith('eq.')) f[k] = v.slice(3)
  })
  return f
}

export const demoFetch: typeof fetch = async (input, init) => {
  const req = new Request(input, init)
  const url = new URL(req.url)
  const path = url.pathname
  await new Promise((r) => setTimeout(r, 150))

  // --- Auth ---------------------------------------------------------------
  if (path.endsWith('/auth/v1/token')) {
    const body = await req.json().catch(() => ({}))
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(body.refresh_token ?? '').replace('demo-refresh-', '')
      const p = profiles.find((x) => x.id === id) ?? OWNER
      return reply(session(p, p.phone ? `${p.phone}@${DRIVER_DOMAIN}` : 'owner@demo'))
    }
    const email = String(body.email ?? '')
    if (email.endsWith(`@${DRIVER_DOMAIN}`)) {
      const p = profiles.find((x) => x.role === 'driver' && x.phone === email.split('@')[0])
      if (!p) return reply({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }, 400)
      return reply(session(p, email))
    }
    return reply(session(OWNER, email))
  }
  if (path.endsWith('/auth/v1/logout')) {
    currentUserId = null
    return reply(null, 204)
  }
  if (path.endsWith('/auth/v1/user')) {
    const p = profiles.find((x) => x.id === userIdFromRequest(req.headers)) ?? OWNER
    return reply(session(p, 'demo').user)
  }

  // --- Tables -------------------------------------------------------------
  const me = profiles.find((x) => x.id === userIdFromRequest(req.headers)) ?? OWNER
  const single = (req.headers.get('Accept') ?? '').includes('vnd.pgrst.object')
  const answer = (rows: unknown[]) => reply(single ? (rows[0] ?? null) : rows)

  if (path.endsWith('/rest/v1/profiles')) {
    const f = eqFilters(url)
    return answer(profiles.filter((p) => Object.entries(f).every(([k, v]) => String(p[k as keyof Profile]) === v)))
  }
  if (path.endsWith('/rest/v1/vehicles')) {
    if (req.method === 'PATCH') {
      const v = vehicles.find((x) => x.id === eqFilters(url).id)
      if (v) Object.assign(v, await req.json())
      return reply(null, 204)
    }
    return answer(me.role === 'owner' ? vehicles : vehicles.filter((v) => v.id === me.vehicle_id))
  }

  // --- Edge functions -----------------------------------------------------
  if (path.endsWith('/functions/v1/onelap')) {
    const action = url.searchParams.get('action')
    const id = Number(url.searchParams.get('deviceId'))
    if (action === 'sync') return reply({ added: 0, total: vehicles.length })
    if (action === 'devices') return reply([])
    if (me.role === 'driver' && vehicles.find((v) => v.id === me.vehicle_id)?.onelap_device_id !== id) {
      return reply({ error: 'You do not have access to this vehicle' }, 403)
    }
    if (action === 'latest') return reply(latest(id))
    if (action === 'history') return reply(history(id, new Date(url.searchParams.get('from')!), new Date(url.searchParams.get('to')!)))
    if (action === 'summary') return reply(summary(id, url.searchParams.get('from')!, url.searchParams.get('to')!))
  }
  if (path.endsWith('/functions/v1/drivers')) {
    const b = await req.json()
    if (b.action === 'create') {
      const phone = String(b.phone ?? '').replace(/\D/g, '').slice(-10)
      if (phone.length !== 10) return reply({ error: 'Enter a 10-digit mobile number' }, 400)
      if (profiles.some((p) => p.phone === phone)) return reply({ error: 'A driver with this mobile number already exists' }, 409)
      profiles.push({ id: `drv-${Date.now()}`, role: 'driver', name: b.name, phone, owner_id: OWNER.id, vehicle_id: b.vehicle_id || null, active: true, created_at: '' })
    } else if (b.action === 'update') {
      const p = profiles.find((x) => x.id === b.id)
      if (p) Object.assign(p, { name: b.name ?? p.name, vehicle_id: b.vehicle_id === undefined ? p.vehicle_id : b.vehicle_id, active: b.active ?? p.active })
    } else if (b.action === 'delete') {
      profiles.splice(profiles.findIndex((x) => x.id === b.id), 1)
    }
    return reply({ ok: true })
  }

  return reply({ error: `Demo mode has no answer for ${path}` }, 404)
}
