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

// Namakkal -> Salem -> Erode loop for the moving truck
const ROUTE: [number, number][] = [
  [11.219, 78.167], [11.33, 78.12], [11.45, 78.13], [11.56, 78.14], [11.664, 78.146],
  [11.6, 77.95], [11.45, 77.8], [11.34, 77.717], [11.28, 77.9], [11.219, 78.167],
]
const PARKED: Record<number, { at: [number, number]; ignition: boolean; ageMin: number }> = {
  7681: { at: [11.664, 78.146], ignition: true, ageMin: 1 },
  3565: { at: [10.79, 78.704], ignition: false, ageMin: 25 },
}

/** Deterministic pseudo-random number from a string, so charts don't jump on reload. */
function rand(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function alongRoute(f: number) {
  const seg = (ROUTE.length - 1) * (f % 1)
  const i = Math.floor(seg)
  const t = seg - i
  const [a, b] = [ROUTE[i], ROUTE[i + 1]]
  const course = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  return { lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, course }
}

function latest(deviceId: number): Position {
  const now = Date.now()
  const base = { id: now, deviceId, attributes: { battery: 5, gsm: 4, totalDistance: (182345 + deviceId) * 1000 } }
  const parked = PARKED[deviceId]
  if (parked) {
    return { ...base, latitude: parked.at[0], longitude: parked.at[1], speed: 0, speedKmh: 0, ignition: parked.ignition, course: 0, fixTime: new Date(now - parked.ageMin * 60000).toISOString() }
  }
  const p = alongRoute(now / (40 * 60 * 1000)) // one loop every 40 minutes
  const kmh = 48 + Math.round(Math.sin(now / 20000) * 8)
  return { ...base, latitude: p.lat, longitude: p.lng, speed: kmh / 1.852, speedKmh: kmh, ignition: true, course: p.course, fixTime: new Date(now - 20000).toISOString() }
}

function history(deviceId: number, from: Date, to: Date): Position[] {
  const start = Math.max(from.getTime(), new Date(from).setHours(6, 0, 0, 0))
  const end = Math.min(to.getTime(), new Date(from).setHours(19, 0, 0, 0))
  const out: Position[] = []
  for (let t = start, i = 0; t <= end; t += 2 * 60000, i++) {
    const f = (t - start) / (end - start || 1)
    const p = alongRoute(f * 0.999)
    const lunch = f > 0.45 && f < 0.52
    const kmh = lunch ? 0 : Math.max(0, 45 + Math.sin(i / 3) * 18 + (rand(`${deviceId}${i}`) - 0.5) * 10)
    out.push({ id: i, deviceId, latitude: p.lat, longitude: p.lng, speed: kmh / 1.852, speedKmh: Math.round(kmh), ignition: true, course: p.course, fixTime: new Date(t).toISOString(), attributes: { totalDistance: (180000 + f * 260) * 1000 } })
  }
  return out
}

function summary(deviceId: number, from: string, to: string) {
  const days: DayStat[] = []
  const today = new Date().toISOString().slice(0, 10)
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${(to > today ? today : to)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10)
    const r = rand(`${deviceId}-${day}`)
    const restDay = r < 0.12
    const km = restDay ? 0 : Math.round(140 + r * 260 - (deviceId === 3565 ? 60 : 0))
    const moving = Math.round((km / 42) * 3600)
    const idle = restDay ? 0 : Math.round((0.6 + rand(`i${deviceId}${day}`) * 2.2) * 3600)
    days.push({ day, km, moving_s: moving, idle_s: idle, stopped_s: 86400 - moving - idle, max_speed: restDay ? 0 : 62 + Math.round(r * 18) })
  }
  const total = days.reduce(
    (t, r) => ({ km: t.km + r.km, moving_s: t.moving_s + r.moving_s, idle_s: t.idle_s + r.idle_s, stopped_s: t.stopped_s + r.stopped_s, max_speed: Math.max(t.max_speed, r.max_speed) }),
    { km: 0, moving_s: 0, idle_s: 0, stopped_s: 0, max_speed: 0 },
  )
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
