import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Activity, ChevronRight, Clock, Gauge, PauseCircle, Route, Truck } from 'lucide-react'
import { useLivePositions, useSummaries, useVehicles } from '@/hooks/useFleet'
import { useAuth } from '@/hooks/useAuth'
import { ago, hours, monthRange, number } from '@/lib/format'
import { positionTime, STATE_META, vehicleState, type VehicleState } from '@/lib/onelap'
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Stat } from '@/components/ui'
import { DailyKmChart, SERIES, TimeDonut, TimeSplitChart } from '@/components/Charts'
import { FleetMap } from '@/components/FleetMap'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { vehicles, loading } = useVehicles()
  const { positions } = useLivePositions(vehicles)
  const range = useMemo(() => monthRange(), [])
  const { summaries, loading: sumLoading, error } = useSummaries(vehicles, range.from, range.to)

  const totals = useMemo(() => {
    const all = Object.values(summaries).map((s) => s.total)
    return {
      km: all.reduce((a, t) => a + t.km, 0),
      moving: all.reduce((a, t) => a + t.moving_s, 0),
      idle: all.reduce((a, t) => a + t.idle_s, 0),
      stopped: all.reduce((a, t) => a + t.stopped_s, 0),
      maxSpeed: Math.max(0, ...all.map((t) => t.max_speed)),
    }
  }, [summaries])

  const counts = useMemo(() => {
    const c: Record<VehicleState, number> = { moving: 0, idle: 0, stopped: 0, offline: 0 }
    for (const v of vehicles) c[vehicleState(positions[v.onelap_device_id])]++
    return c
  }, [vehicles, positions])

  if (loading) return <Spinner />
  if (!vehicles.length) {
    return (
      <Card>
        <Empty
          icon={<Truck />}
          title="No vehicles yet"
          text="Import your vehicles from OneLap to start tracking."
          action={<Link to="/vehicles"><Button>Go to vehicles</Button></Link>}
        />
      </Card>
    )
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      <PageHeader title={`${greeting}, ${profile?.name ?? 'Owner'}`} subtitle={`Fleet overview for ${format(new Date(), 'MMMM yyyy')}`} />
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Distance this month" value={`${number(totals.km)} km`} hint={`${vehicles.length} vehicles`} icon={<Route />} tone="blue" />
        <Stat label="Running hours" value={hours(totals.moving)} hint={`Top speed ${number(totals.maxSpeed)} km/h`} icon={<Activity />} tone="green" />
        <Stat label="Idle hours" value={hours(totals.idle)} hint="Engine on, not moving" icon={<Clock />} tone="amber" />
        <Stat label="Stopped hours" value={hours(totals.stopped)} hint="Engine off or no signal" icon={<PauseCircle />} tone="slate" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Live fleet</h2>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(counts) as VehicleState[]).map((s) => (
                <Badge key={s} tone={STATE_META[s].tone}>
                  {counts[s]} {STATE_META[s].label}
                </Badge>
              ))}
            </div>
          </div>
          <FleetMap vehicles={vehicles} positions={positions} onSelect={(v) => navigate(`/vehicles/${v.id}`)} className="h-[340px]" />
        </Card>
        <Card className="p-4">
          <h2 className="mb-4 font-semibold">Fleet time this month</h2>
          {sumLoading && !Object.keys(summaries).length ? <Spinner /> : <TimeDonut moving={totals.moving} idle={totals.idle} stopped={totals.stopped} />}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <TimeSplitChart vehicles={vehicles} summaries={summaries} />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Distance per day</h2>
          <span className="text-xs text-slate-500">km, by vehicle</span>
        </div>
        {sumLoading && !Object.keys(summaries).length ? <Spinner /> : <DailyKmChart vehicles={vehicles} summaries={summaries} />}
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">Vehicles</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, i) => {
            const p = positions[v.onelap_device_id]
            const state = vehicleState(p)
            const s = summaries[v.onelap_device_id]?.total
            return (
              <Link key={v.id} to={`/vehicles/${v.id}`}>
                <Card className="group p-4 transition hover:ring-brand-400">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg text-white" style={{ background: SERIES[i % SERIES.length] }}>
                        <Truck className="size-5" />
                      </span>
                      <div>
                        <p className="font-bold tracking-wide">{v.reg_no}</p>
                        <p className="text-xs text-slate-500">Updated {p ? ago(positionTime(p)) : '—'}</p>
                      </div>
                    </div>
                    <Badge tone={STATE_META[state].tone}>{STATE_META[state].label}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 py-2">
                      <Gauge className="mx-auto size-4 text-slate-400" />
                      <p className="mt-1 text-sm font-bold">{number(p?.speedKmh)}</p>
                      <p className="text-[10px] text-slate-500">km/h now</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 py-2">
                      <Route className="mx-auto size-4 text-slate-400" />
                      <p className="mt-1 text-sm font-bold">{s ? number(s.km) : '—'}</p>
                      <p className="text-[10px] text-slate-500">km month</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 py-2">
                      <Activity className="mx-auto size-4 text-slate-400" />
                      <p className="mt-1 text-sm font-bold">{s ? hours(s.moving_s) : '—'}</p>
                      <p className="text-[10px] text-slate-500">running</p>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center justify-end text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
                    Details <ChevronRight className="size-3.5" />
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
