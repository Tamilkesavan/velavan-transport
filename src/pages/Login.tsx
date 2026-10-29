import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Lock, Phone, ShieldCheck, Truck, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { LogoMark } from '@/components/Logo'
import { Button, ErrorNote, Input, cx } from '@/components/ui'
import { supabaseConfigured } from '@/lib/supabase'
import { DEMO, DEMO_DRIVER_PHONE } from '@/lib/demo'

type Mode = 'owner' | 'driver'

export default function Login() {
  const { session, signInOwner, signInDriver } = useAuth()
  const [mode, setMode] = useState<Mode>('owner')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'owner') await signInOwner(login, password)
      else await signInDriver(login, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-ink-950 px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 size-[420px] rounded-full bg-sky-500/10 blur-3xl" />
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-30" preserveAspectRatio="none" viewBox="0 0 400 100">
        <path d="M0 80 Q100 40 200 70 T400 50" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeDasharray="8 6" />
      </svg>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-16" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-[0.14em] text-white">VELAVAN</h1>
          <p className="text-xs font-semibold tracking-[0.4em] text-brand-400">TRANSPORT</p>
          <p className="mt-3 text-sm text-slate-400">Fleet tracking</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['owner', 'Owner', ShieldCheck],
                ['driver', 'Driver', Truck],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setLogin('')
                  setError(null)
                }}
                className={cx(
                  'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition',
                  mode === m ? 'bg-white text-ink-950 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              {mode === 'owner' ? (
                <UserRound className="absolute top-2.5 left-3 size-4 text-slate-400" />
              ) : (
                <Phone className="absolute top-2.5 left-3 size-4 text-slate-400" />
              )}
              <Input
                className="pl-9"
                type={mode === 'owner' ? 'email' : 'tel'}
                inputMode={mode === 'owner' ? 'email' : 'numeric'}
                autoComplete="username"
                placeholder={mode === 'owner' ? 'Owner email' : 'Mobile number'}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute top-2.5 left-3 size-4 text-slate-400" />
              <Input
                className="pl-9"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <ErrorNote error={error} />
            {!supabaseConfigured && <ErrorNote error="Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." />}
            <Button type="submit" className="w-full py-2.5" loading={busy}>
              Sign in as {mode === 'owner' ? 'owner' : 'driver'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-400">
            {mode === 'driver' ? 'Your login is set up by the vehicle owner.' : 'Owner access to all vehicles.'}
          </p>
          {DEMO && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-center text-xs text-brand-700 ring-1 ring-brand-100">
              Demo mode with sample data. {mode === 'owner' ? 'Any email and password works.' : `Try ${DEMO_DRIVER_PHONE} with any password.`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
