import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, LogOut, Map, Truck, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from './Logo'
import { cx } from './ui'

const ownerNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Live map', icon: Map },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/drivers', label: 'Drivers', icon: Users },
]

function initials(name?: string | null) {
  return (name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export function Layout() {
  const { profile, signOut } = useAuth()
  const isOwner = profile?.role === 'owner'

  return (
    <div className="flex min-h-full">
      {isOwner && (
        <aside className="no-print fixed inset-y-0 left-0 z-[600] hidden w-64 flex-col border-r border-white/5 bg-ink-950/80 px-4 py-6 backdrop-blur-xl lg:flex">
          <div className="px-2">
            <Logo light />
          </div>
          <p className="mt-8 px-3 text-[10px] font-semibold tracking-[0.2em] text-slate-600 uppercase">Fleet</p>
          <nav className="mt-2 space-y-1">
            {ownerNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    isActive ? 'bg-gradient-to-r from-brand-500/20 to-transparent text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-400 shadow-[0_0_12px_rgb(251_191_36)]" />}
                    <n.icon className={cx('size-[18px]', isActive && 'text-brand-400')} />
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-ink-950">{initials(profile?.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{profile?.name ?? 'Owner'}</p>
              <p className="text-xs text-slate-500">Owner</p>
            </div>
            <button onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>
      )}

      <div className={cx('flex min-w-0 flex-1 flex-col', isOwner && 'lg:pl-64')}>
        <header
          className={cx(
            'no-print sticky top-0 z-[500] flex items-center justify-between border-b border-white/5 bg-ink-950/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl',
            isOwner && 'lg:hidden',
          )}
        >
          <Logo light />
          <div className="flex items-center gap-3">
            {!isOwner && <span className="hidden text-sm text-slate-400 sm:block">{profile?.name} · Driver</span>}
            <button onClick={signOut} className="rounded-xl p-2 text-slate-300 ring-1 ring-white/10 hover:bg-white/10" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        <main className={cx('mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8', isOwner && 'pb-28 lg:pb-8')}>
          <Outlet />
        </main>

        {isOwner && (
          <nav className="no-print fixed inset-x-3 bottom-3 z-[500] grid grid-cols-4 rounded-2xl bg-ink-850/90 p-1.5 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl mb-[env(safe-area-inset-bottom)] lg:hidden">
            {ownerNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-semibold transition', isActive ? 'bg-brand-500 text-ink-950' : 'text-slate-400')
                }
              >
                <n.icon className="size-5" />
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
