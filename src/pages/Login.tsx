import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Lock, Phone, Radio, ShieldCheck, Truck, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Logo, LogoMark } from '@/components/Logo'
import { Button, ErrorNote, Input, cx } from '@/components/ui'
import { supabaseConfigured } from '@/lib/supabase'
import { DEMO, DEMO_DRIVER_PHONE } from '@/lib/demo'

type Mode = 'owner' | 'driver'

const ROLES = [
  { mode: 'owner' as const, title: 'Owner', text: 'All vehicles, reports, drivers', icon: ShieldCheck },
  { mode: 'driver' as const, title: 'Driver', text: 'Your assigned vehicle', icon: Truck },
]

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
    <div className="relative grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* Hero */}
      <div className="relative hidden overflow-hidden border-r border-white/5 lg:block">
        <HeroMap />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo light />
          <div className="max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300 ring-1 ring-brand-400/30">
              <Radio className="size-3.5" /> Live from OneLap every 10 seconds
            </p>
            <h1 className="text-4xl leading-tight font-bold text-white">
              Every lorry, every kilometre, <span className="text-brand-400">in one place.</span>
            </h1>
            <p className="mt-4 text-slate-400">Live positions, running and idle hours, and day-by-day route replay for the Velavan Transport fleet.</p>
          </div>
          <p className="text-xs text-slate-600">Velavan Transport · Namakkal</p>
        </div>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center px-4 py-10">
        <div className="pointer-events-none absolute top-0 right-0 size-[420px] rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <LogoMark className="size-16" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-[0.14em] text-white">VELAVAN</h1>
            <p className="text-xs font-semibold tracking-[0.4em] text-brand-400">TRANSPORT</p>
          </div>
          <h2 className="hidden text-2xl font-bold text-white lg:block">Sign in</h2>
          <p className="mt-1 hidden text-sm text-slate-400 lg:block">Choose how you are signing in.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {ROLES.map((r) => (
              <button
                key={r.mode}
                type="button"
                onClick={() => {
                  setMode(r.mode)
                  setLogin('')
                  setError(null)
                }}
                className={cx(
                  'rounded-2xl p-4 text-left ring-1 transition',
                  mode === r.mode ? 'bg-brand-500/10 ring-brand-400 shadow-[0_10px_30px_-12px_rgb(245_158_11/0.6)]' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]',
                )}
              >
                <r.icon className={cx('size-6', mode === r.mode ? 'text-brand-400' : 'text-slate-400')} />
                <p className="mt-3 font-semibold text-white">{r.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{r.text}</p>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              {mode === 'owner' ? <UserRound className="absolute top-3 left-3.5 size-4 text-slate-500" /> : <Phone className="absolute top-3 left-3.5 size-4 text-slate-500" />}
              <Input
                className="py-2.5 pl-10"
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
              <Lock className="absolute top-3 left-3.5 size-4 text-slate-500" />
              <Input className="py-2.5 pl-10" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <ErrorNote error={error} />
            {!supabaseConfigured && <ErrorNote error="Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." />}
            <Button type="submit" className="w-full py-3" loading={busy}>
              Sign in as {mode}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            {mode === 'driver' ? 'Your mobile number and password are set by the vehicle owner.' : 'Owner access to every vehicle and driver.'}
          </p>
          {DEMO && (
            <p className="mt-4 rounded-xl bg-brand-500/10 px-3 py-2 text-center text-xs text-brand-200 ring-1 ring-brand-400/30">
              Demo mode with sample data. {mode === 'owner' ? 'Any email and password works.' : `Try ${DEMO_DRIVER_PHONE} with any password.`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Decorative dark "map" with routes and glowing vehicles, drawn in SVG. */
function HeroMap() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.035)" />
        </pattern>
        <radialGradient id="fade" cx="60%" cy="40%" r="70%">
          <stop offset="0" stopColor="#060a13" stopOpacity="0" />
          <stop offset="1" stopColor="#060a13" stopOpacity="0.95" />
        </radialGradient>
      </defs>
      <rect width="800" height="900" fill="url(#grid)" />
      <g fill="none" strokeLinecap="round">
        <path d="M-20 640 C 160 560, 240 420, 420 400 S 700 260, 840 180" stroke="rgba(148,163,184,0.18)" strokeWidth="10" />
        <path d="M-20 640 C 160 560, 240 420, 420 400 S 700 260, 840 180" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="10 10" opacity="0.7" />
        <path d="M120 900 C 200 720, 380 640, 460 520 S 560 300, 520 -20" stroke="rgba(148,163,184,0.14)" strokeWidth="8" />
        <path d="M840 620 C 680 600, 560 540, 460 520" stroke="rgba(148,163,184,0.12)" strokeWidth="6" />
      </g>
      {[
        [420, 400, '#34d399'],
        [610, 290, '#34d399'],
        [650, 560, '#fbbf24'],
        [140, 760, '#f87171'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="22" fill={c as string} opacity="0.15">
            <animate attributeName="r" values="12;30;12" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={x} cy={y} r="9" fill="#0b111d" stroke={c as string} strokeWidth="3" />
        </g>
      ))}
      <rect width="800" height="900" fill="url(#fade)" />
      <g transform="translate(560 640)" opacity="0.9">
        <rect width="190" height="74" rx="16" fill="rgba(15,22,38,0.9)" stroke="rgba(255,255,255,0.08)" />
        <text x="18" y="28" fill="#94a3b8" fontSize="11" fontFamily="Inter">FLEET STATUS</text>
        <text x="18" y="54" fill="#fff" fontSize="20" fontWeight="700" fontFamily="Inter">Live tracking</text>
      </g>
      <g transform="translate(70 180)" opacity="0.9">
        <rect width="170" height="64" rx="16" fill="rgba(15,22,38,0.9)" stroke="rgba(255,255,255,0.08)" />
        <circle cx="26" cy="32" r="6" fill="#34d399" />
        <text x="42" y="28" fill="#fff" fontSize="12" fontWeight="700" fontFamily="Inter">Lorry on route</text>
        <text x="42" y="45" fill="#94a3b8" fontSize="11" fontFamily="Inter">Moving · updated 10 s ago</text>
      </g>
    </svg>
  )
}
