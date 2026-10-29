import { useMemo, useState } from 'react'
import { useMonth } from '@/hooks/useMonth'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Activity, ArrowUpRight, Clock, Gauge, KeyRound, MapPin, PauseCircle, Route, Truck } from 'lucide-react'
import { useLivePositions, useSummaries, useVehicles } from '@/hooks/useFleet'
import { useAuth } from '@/hooks/useAuth'
import { ago, hours, number } from '@/lib/format'
import { positionTime, STATE_META, vehicleState, type VehicleState } from '@/lib/onelap'
import type { Position, Vehicle } from '@/lib/types'
import { Badge, Button, Card, CardTitle, Empty, ErrorNote, Input, PageHeader, Segmented, Skeleton, Spinner, Stat } from '@/components/ui'
import { DailyHoursChart, DailyKmChart, Legend, SERIES, STOPPED_CHART, TimeDonut, VehicleBreakdown } from '@/components/Charts'
import { FleetMap } from '@/components/FleetMap'
import { LiveIndicator } from '@/components/LiveIndicator'

const ALL = 'all'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { vehicles, loading } = useVehicles()
  const { positions, updatedAt, refresh } = useLivePositions(vehicles)
  const { month, setMonth, range } = useMonth()
  const { summaries, loading: sumLoading, error } = useSummaries(vehicles, range.from, range.to)
  const [selected, setSelected] = useState<string>(ALL)

  const shown = selected === ALL ? vehicles : vehicles.filter((v) => v.id === selected)
  const one = selected === ALL ? null : shown[0] ?? null

  const totals = useMemo(() => {
    const all = shown.map((v) => summaries[v.onelap_device_id]?.total).filter(Boolean) as NonNullable<(typeof summaries)[number]>['total'][]
    return {
      km: all.reduce((a, t) => a + t.km, 0),
      moving: all.reduce((a, t) => a + t.moving_s, 0),
      idle: all.reduce((a, t) => a + t.idle_s, 0),
      stopped: all.reduce((a, t) => a + t.stopped_s, 0),
      maxSpeed: Math.max(0, ...all.map((t) => t.max_speed)),
      ready: all.length === shown.length && all.length > 0,
    }
  }, [shown, summaries])

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
          action={
            <Link to="/vehicles">
              <Button>Go to vehicles</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const monthLabel = format(new Date(`${month}-01T00:00:00`), 'MMMM yyyy')
  const kmHint = totals.ready ? `${number(totals.km / range.days)} km per day on average` : undefined

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${profile?.name ?? 'Owner'}`}
        subtitle={`Velavan Transport · ${monthLabel}`}
        actions={
          <>
            <LiveIndicator updatedAt={updatedAt} onRefresh={refresh} />
            <Input type="month" value={month} max={format(new Date(), 'yyyy-MM')} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
          </>
        }
      />

      <Segmented
        value={selected}
        onChange={setSelected}
        options={[
          { value: ALL, label: <>All vehicles <span className="rounded-md bg-black/20 px-1.5 text-xs">{vehicles.length}</span></> },
          ...vehicles.map((v) => {
            const st = vehicleState(positions[v.onelap_device_id])
            return {
              value: v.id,
              label: (
                <>
                  <span className="size-2 rounded-full" style={{ background: STATE_META[st].color, boxShadow: `0 0 8px ${STATE_META[st].color}` }} />
                  {v.reg_no}
                </>
              ),
            }
          }),
        ]}
      />

      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.ready || !sumLoading ? (
          <>
            <Stat label="Distance" value={number(totals.km)} unit="km" hint={kmHint} icon={<Route />} tone="blue" accent="#38bdf8" />
            <Stat label="Running" value={hours(totals.moving)} hint={`Top speed ${number(totals.maxSpeed)} km/h`} icon={<Activity />} tone="green" accent="#34d399" />
            <Stat label="Idle" value={hours(totals.idle)} hint="Engine on, not moving" icon={<Clock />} tone="amber" accent="#fbbf24" />
            <Stat label="Stopped" value={hours(totals.stopped)} hint="Engine off or no signal" icon={<PauseCircle />} tone="slate" />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px]" />)
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-3 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1 pb-3">
            <h2 className="text-sm font-semibold">{one ? `${one.reg_no} live` : 'Live fleet'}</h2>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(counts) as VehicleState[]).map((s) => (
                <Badge key={s} tone={STATE_META[s].tone} dot={STATE_META[s].color}>
                  {counts[s]} {STATE_META[s].label}
                </Badge>
              ))}
            </div>
          </div>
          <FleetMap
            vehicles={vehicles}
            positions={positions}
            selectedId={one?.id}
            onSelect={(v) => setSelected(v.id)}
            className="h-[340px] sm:h-[400px]"
          />
        </Card>

        <Card className="p-5">
          {one ? (
            <LivePanel vehicle={one} p={positions[one.onelap_device_id]} onOpen={() => navigate(`/vehicles/${one.id}`)} />
          ) : (
            <>
              <CardTitle title="By vehicle" subtitle={`Distance and time, ${monthLabel}`} right={<Legend items={[{ label: 'Run', color: STATE_META.moving.color }, { label: 'Idle', color: STATE_META.idle.color }, { label: 'Stop', color: STOPPED_CHART }]} />} />
              <VehicleBreakdown vehicles={vehicles} summaries={summaries} onSelect={(v) => setSelected(v.id)} />
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <CardTitle
            title="Distance per day"
            subtitle="Kilometres"
            right={shown.length > 1 ? <Legend items={shown.map((v) => ({ label: v.reg_no, color: SERIES[vehicles.indexOf(v) % SERIES.length] }))} /> : undefined}
          />
          {sumLoading && !totals.ready ? <Skeleton className="h-[260px]" /> : <DailyKmChart vehicles={shown} summaries={summaries} />}
        </Card>
        <Card className="p-5">
          <CardTitle title="Time split" subtitle={one ? one.reg_no : 'All vehicles'} />
          {sumLoading && !totals.ready ? <Skeleton className="h-36" /> : <TimeDonut moving={totals.moving} idle={totals.idle} stopped={totals.stopped} />}
        </Card>
      </div>

      <Card className="p-5">
        <CardTitle title="Running and idle hours per day" subtitle={one ? one.reg_no : 'All vehicles combined'} right={<Legend items={[{ label: 'Running', color: STATE_META.moving.color }, { label: 'Idle', color: STATE_META.idle.color }]} />} />
        {sumLoading && !totals.ready ? (
          <Skeleton className="h-[220px]" />
        ) : (
          <DailyHoursChart summaries={shown.map((v) => summaries[v.onelap_device_id]).filter(Boolean)} />
        )}
      </Card>

      {!one && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Vehicles</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((v, i) => (
              <VehicleCard key={v.id} v={v} color={SERIES[i % SERIES.length]} p={positions[v.onelap_device_id]} km={summaries[v.onelap_device_id]?.total.km} onClick={() => setSelected(v.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VehicleCard({ v, p, km, color, onClick }: { v: Vehicle; p: Position | null | undefined; km?: number; color: string; onClick: () => void }) {
  const state = vehicleState(p)
  return (
    <button onClick={onClick} className="text-left">
      <Card className="group p-4 transition hover:ring-brand-400/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl ring-1 ring-white/10" style={{ background: `linear-gradient(135deg, ${color}40, ${color}10)` }}>
              <Truck className="size-5" style={{ color }} />
            </span>
            <div>
              <p className="font-bold tracking-wide text-white">{v.reg_no}</p>
              <p className="text-xs text-slate-500">{p ? `Updated ${ago(positionTime(p))}` : 'No signal yet'}</p>
            </div>
          </div>
          <Badge tone={STATE_META[state].tone} dot={STATE_META[state].color}>
            {STATE_META[state].label}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={<Gauge />} value={number(p?.speedKmh)} label="km/h now" />
          <Metric icon={<Route />} value={km != null ? number(km) : '—'} label="km month" />
          <Metric icon={<KeyRound />} value={p ? (p.ignition ? 'On' : 'Off') : '—'} label="ignition" />
        </div>
      </Card>
    </button>
  )
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2.5 text-center ring-1 ring-white/5">
      <span className="mx-auto flex w-fit text-slate-500 [&>svg]:size-3.5">{icon}</span>
      <p className="mt-1 text-sm font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

function LivePanel({ vehicle, p, onOpen }: { vehicle: Vehicle; p: Position | null | undefined; onOpen: () => void }) {
  const state = vehicleState(p)
  return (
    <div className="flex h-full flex-col">
      <CardTitle title="Right now" subtitle={vehicle.name ?? undefined} right={<Badge tone={STATE_META[state].tone} dot={STATE_META[state].color}>{STATE_META[state].label}</Badge>} />
      <div className="flex items-end gap-2">
        <span className="text-5xl font-bold text-white tabular-nums">{number(p?.speedKmh)}</span>
        <span className="mb-1.5 text-sm text-slate-400">km/h</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Metric icon={<KeyRound />} value={p ? (p.ignition ? 'On' : 'Off') : '—'} label="Ignition" />
        <Metric icon={<Clock />} value={p ? ago(positionTime(p)) : '—'} label="Last update" />
        <Metric icon={<Route />} value={p?.attributes?.totalDistance ? number(p.attributes.totalDistance / 1000) : '—'} label="Odometer km" />
        <Metric icon={<Gauge />} value={p?.attributes?.gsm != null ? `${p.attributes.gsm}/5` : '—'} label="GSM signal" />
      </div>
      {p && (
        <a
          href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-300 ring-1 ring-white/5 hover:bg-white/[0.06]"
        >
          <MapPin className="size-3.5 text-brand-400" />
          <span className="truncate">{p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</span>
        </a>
      )}
      <Button className="mt-4 w-full lg:mt-auto" variant="secondary" onClick={onOpen}>
        Route replay and full report <ArrowUpRight className="size-4" />
      </Button>
    </div>
  )
}
