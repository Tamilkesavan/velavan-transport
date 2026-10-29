import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export type Caller = {
  id: string
  role: 'owner' | 'driver'
  ownerId: string // the fleet owner's id (self for owners)
  vehicleId: string | null
}

/** Service-role client: bypasses RLS, so every query below filters by the caller explicitly. */
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

export async function getCaller(req: Request): Promise<Caller> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Not signed in')
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, owner_id, vehicle_id, active')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!profile || !profile.active) throw new HttpError(403, 'This account is disabled')
  return {
    id: profile.id,
    role: profile.role,
    ownerId: profile.role === 'owner' ? profile.id : profile.owner_id,
    vehicleId: profile.vehicle_id,
  }
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  }
}
