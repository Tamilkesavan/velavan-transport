import { createClient } from '@supabase/supabase-js'
import { DEMO, demoFetch } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseConfigured = DEMO || Boolean(url && anonKey)

export const supabase = createClient(url || 'https://demo.supabase.co', anonKey || 'demo', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: DEMO ? 'velavan-demo-auth' : undefined },
  global: DEMO ? { fetch: demoFetch } : undefined,
})
