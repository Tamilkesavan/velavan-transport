// Owner-only driver account management.
// Drivers sign in with phone + password; their login email is <phone>@drivers.velavan.app.
//
//   POST { action: 'create', name, phone, password, vehicle_id }
//   POST { action: 'update', id, name?, password?, vehicle_id?, active? }
//   POST { action: 'delete', id }

import { admin, getCaller, handle, HttpError, json } from '../_shared/http.ts'

const DRIVER_DOMAIN = 'drivers.velavan.app'

function normalizePhone(raw: unknown) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  const phone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  if (!/^\d{10}$/.test(phone)) throw new HttpError(400, 'Enter a 10-digit mobile number')
  return phone
}

function checkPassword(raw: unknown) {
  const password = String(raw ?? '')
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters')
  return password
}

Deno.serve(
  handle(async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
    const caller = await getCaller(req)
    if (caller.role !== 'owner') throw new HttpError(403, 'Only the owner can manage drivers')
    const body = await req.json()

    async function checkVehicle(vehicleId: unknown) {
      if (vehicleId == null || vehicleId === '') return null
      const { data } = await admin.from('vehicles').select('id').eq('id', vehicleId).eq('owner_id', caller.id).maybeSingle()
      if (!data) throw new HttpError(400, 'Pick one of your vehicles')
      return data.id as string
    }

    async function ownDriver(id: unknown) {
      const { data } = await admin.from('profiles').select('id').eq('id', id).eq('owner_id', caller.id).eq('role', 'driver').maybeSingle()
      if (!data) throw new HttpError(404, 'Driver not found')
      return data.id as string
    }

    if (body.action === 'create') {
      const name = String(body.name ?? '').trim()
      if (!name) throw new HttpError(400, 'Name is required')
      const phone = normalizePhone(body.phone)
      const password = checkPassword(body.password)
      const vehicleId = await checkVehicle(body.vehicle_id)

      const { data, error } = await admin.auth.admin.createUser({
        email: `${phone}@${DRIVER_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'driver' },
      })
      if (error) {
        if (/already/i.test(error.message)) throw new HttpError(409, 'A driver with this mobile number already exists')
        throw error
      }
      const { error: profileError } = await admin.from('profiles').insert({
        id: data.user.id,
        role: 'driver',
        name,
        phone,
        owner_id: caller.id,
        vehicle_id: vehicleId,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id)
        throw profileError
      }
      return json({ id: data.user.id })
    }

    if (body.action === 'update') {
      const id = await ownDriver(body.id)
      const patch: Record<string, unknown> = {}
      if (body.name !== undefined) patch.name = String(body.name).trim()
      if (body.vehicle_id !== undefined) patch.vehicle_id = await checkVehicle(body.vehicle_id)
      if (body.active !== undefined) patch.active = Boolean(body.active)
      if (Object.keys(patch).length) {
        const { error } = await admin.from('profiles').update(patch).eq('id', id)
        if (error) throw error
      }
      const authPatch: Record<string, unknown> = {}
      if (body.password) authPatch.password = checkPassword(body.password)
      // Disabled drivers are also banned in Auth so existing sessions stop refreshing.
      if (body.active !== undefined) authPatch.ban_duration = body.active ? 'none' : '876000h'
      if (Object.keys(authPatch).length) {
        const { error } = await admin.auth.admin.updateUserById(id, authPatch)
        if (error) throw error
      }
      return json({ ok: true })
    }

    if (body.action === 'delete') {
      const id = await ownDriver(body.id)
      const { error } = await admin.auth.admin.deleteUser(id) // profile row cascades
      if (error) throw error
      return json({ ok: true })
    }

    throw new HttpError(400, 'Unknown action')
  }),
)
