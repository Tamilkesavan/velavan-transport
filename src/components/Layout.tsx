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

export function Layout() {
  const { profile, signOut } = useAuth()
  const isOwner = profile?.role === 'owner'

  return (
    <div className="flex min-h-full">
      {isOwner && (
        <aside className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col bg-ink-950 px-4 py-5 lg:flex">
          <Logo light />
          <nav className="mt-8 space-y-1">
            {ownerNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <n.icon className="size-4.5" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-lg bg-white/5 p-3">
            <p className="truncate text-sm font-medium text-white">{profile?.name ?? 'Owner'}</p>
            <p className="text-xs text-slate-400">Owner</p>
            <button onClick={signOut} className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </aside>
      )}

      <div className={cx('flex min-w-0 flex-1 flex-col', isOwner && 'lg:pl-60')}>
        <header className="no-print sticky top-0 z-[500] flex items-center justify-between bg-ink-950 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <Logo light />
          <button onClick={signOut} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Sign out">
            <LogOut className="size-5" />
          </button>
        </header>
        {!isOwner && (
          <header className="no-print hidden items-center justify-between bg-ink-950 px-6 py-3 lg:flex">
            <Logo light />
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">{profile?.name} · Driver</span>
              <button onClick={signOut} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </header>
        )}

        <main className={cx('mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:py-8', isOwner && 'pb-24 lg:pb-8')}>
          <Outlet />
        </main>

        {isOwner && (
          <nav className="no-print fixed inset-x-0 bottom-0 z-[500] grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            {ownerNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive ? 'text-brand-600' : 'text-slate-500')
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
