import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const LiveMap = lazy(() => import('@/pages/LiveMap'))
const Vehicles = lazy(() => import('@/pages/Vehicles'))
const VehicleView = lazy(() => import('@/pages/VehicleView'))
const Drivers = lazy(() => import('@/pages/Drivers'))

export default function App() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <div className="flex min-h-full items-center justify-center bg-ink-950"><Spinner /></div>
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  if (!profile || !profile.active) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold">This account is not set up or has been disabled.</p>
        <button className="text-sm font-semibold text-brand-600" onClick={signOut}>Sign out</button>
      </div>
    )
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          {profile.role === 'owner' ? (
            <>
              <Route index element={<Dashboard />} />
              <Route path="map" element={<LiveMap />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="vehicles/:id" element={<VehicleView />} />
              <Route path="drivers" element={<Drivers />} />
            </>
          ) : (
            <Route index element={<VehicleView />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
