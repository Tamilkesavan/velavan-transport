import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { endOfMonth, format, startOfDay, endOfDay } from 'date-fns'
import { Activity, ArrowLeft, BatteryMedium, Clock, Gauge, KeyRound, MapPin, Pause, PauseCircle, Play, Route, Signal, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLivePositions, useSummaries, useVehicles } from '@/hooks/useFleet'
import { ago, dateTime, hours, number, time, ymd } from '@/lib/format'
import { onelap, positionTime, STATE_META, vehicleState } from '@/lib/onelap'
import type { Position } from '@/lib/types'
import { Badge, Button, Card, Empty, ErrorNote, Input, Spinner, Stat } from '@/components/ui'
import { FleetMap, RouteMap } from '@/components/FleetMap'
import { DailyKmChart, SpeedChart, TimeDonut } from '@/components/Charts'

export default function VehicleView() {
  const { id } = useParams()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const vehicleId = isOwner ? id : profile?.vehicle_id
  const { vehicles, loading } = useVehicles()
  const vehicle = vehicles.find((v) => v.id === vehicleId)
  const list = useMemo(() => (vehicle ? [vehicle] : []), [vehicle])
  const { positions, errors, updatedAt } = useLivePositions(list, 10000)

  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const range = useMemo(() => {
    const start = new Date(`${month}-01T00:00:00`)
    const end = endOfMonth(start)
    return { from: ymd(start), to: ymd(end > new Date() ? new Date() : end) }
  }, [month])
  const { summaries, loading: sumLoading, error: sumError } = useSummaries(list, range.from, range.to)

  if (loading) return <Spinner />
  if (!vehicle) {
    return (
      <Card>
        <Empty
          icon={<Truck />}
          title={isOwner ? 'Vehicle not found' : 'No vehicle assigned'}
          text={isOwner ? undefined : 'Ask the owner to assign a vehicle to your account.'}
        />
      </Card>
    )
  }

  const p = positions[vehicle.onelap_device_id]
  const liveError = errors[vehicle.onelap_device_id]
  const state = vehicleState(p)
  const s = summaries[vehicle.onelap_device_id]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isOwner && (
            <Link to="/" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Back">
              <ArrowLeft className="size-5" />
            </Link>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wide sm:text-2xl">{vehicle.reg_no}</h1>
              <Badge tone={STATE_META[state].tone}>
                <span className="size-1.5 rounded-full" style={{ background: STATE_META[state].color }} />
                {STATE_META[state].label}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {vehicle.name && vehicle.name !== vehicle.reg_no ? `${vehicle.name} · ` : ''}Device {vehicle.onelap_device_id}
              {updatedAt && ` · refreshed ${time(updatedAt)}`}
            </p>
          </div>
        </div>
      </div>

      <ErrorNote error={liveError ?? null} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FleetMap vehicles={list} positions={positions} className="h-[300px] sm:h-[380px]" follow />
        </div>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Right now</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <Live icon={<Gauge />} label="Speed" value={`${number(p?.speedKmh)} km/h`} />
            <Live icon={<KeyRound />} label="Ignition" value={p ? (p.ignition ? 'On' : 'Off') : '—'} />
            <Live icon={<BatteryMedium />} label="Battery" value={p?.attributes?.battery != null ? `${p.attributes.battery}/6` : '—'} />
            <Live icon={<Signal />} label="GSM signal" value={p?.attributes?.gsm != null ? `${p.attributes.gsm}/5` : '—'} />
            <Live icon={<Route />} label="Odometer" value={p?.attributes?.totalDistance ? `${number(p.attributes.totalDistance / 1000)} km` : '—'} />
            <Live icon={<Clock />} label="Last update" value={p ? ago(positionTime(p)) : '—'} />
          </div>
          {p && (
            <a
              href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <MapPin className="size-4 text-brand-600" />
              <span className="truncate">{p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</span>
            </a>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h2 className="text-lg font-semibold">Monthly report</h2>
        <Input type="month" value={month} max={format(new Date(), 'yyyy-MM')} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
      </div>
      <ErrorNote error={sumError} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Distance" value={s ? `${number(s.total.km)} km` : '—'} hint={s ? `Top speed ${number(s.total.max_speed)} km/h` : undefined} icon={<Route />} tone="blue" />
        <Stat label="Running" value={s ? hours(s.total.moving_s) : '—'} icon={<Activity />} tone="green" />
        <Stat label="Idle" value={s ? hours(s.total.idle_s) : '—'} hint="Engine on, not moving" icon={<Clock />} tone="amber" />
        <Stat label="Stopped" value={s ? hours(s.total.stopped_s) : '—'} icon={<PauseCircle />} tone="slate" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-2 font-semibold">Distance per day</h3>
          {sumLoading && !s ? <Spinner /> : <DailyKmChart vehicles={list} summaries={summaries} />}
        </Card>
        <Card className="p-4">
          <h3 className="mb-4 font-semibold">Time split</h3>
          {sumLoading && !s ? <Spinner /> : <TimeDonut moving={s?.total.moving_s ?? 0} idle={s?.total.idle_s ?? 0} stopped={s?.total.stopped_s ?? 0} />}
        </Card>
      </div>

      <RouteReplay deviceId={vehicle.onelap_device_id} />
    </div>
  )
}

function Live({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 [&>svg]:size-3.5">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  )
}

function RouteReplay({ deviceId }: { deviceId: number }) {
  const [day, setDay] = useState(ymd(new Date()))
  const [points, setPoints] = useState<Position[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  async function load() {
    setBusy(true)
    setError(null)
    setPlaying(false)
    try {
      const d = new Date(`${day}T00:00:00`)
      const end = endOfDay(d) > new Date() ? new Date() : endOfDay(d)
      const pts = await onelap.history(deviceId, startOfDay(d), end)
      setPoints(pts)
      setCursor(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!playing || !points?.length) return
    const step = Math.max(1, Math.round(points.length / 300))
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c + step >= points.length - 1) {
          setPlaying(false)
          return points.length - 1
        }
        return c + step
      })
    }, 60)
    return () => clearInterval(timer.current)
  }, [playing, points])

  const stats = useMemo(() => {
    if (!points?.length) return null
    const first = points[0]
    const last = points.at(-1)!
    const odo = (last.attributes?.totalDistance ?? 0) - (first.attributes?.totalDistance ?? 0)
    return {
      km: odo > 0 ? odo / 1000 : null,
      start: positionTime(first),
      end: positionTime(last),
      max: Math.max(...points.map((p) => p.speedKmh)),
    }
  }, [points])

  const at = points?.[cursor]

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Route replay</h2>
          <p className="text-sm text-slate-500">Where the vehicle went on a day</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} className="w-40" />
          <Button onClick={load} loading={busy} className="whitespace-nowrap">Show route</Button>
        </div>
      </div>
      <ErrorNote error={error} />
      {points && !points.length && <Empty icon={<Route />} title="No movement recorded" text="The device sent no positions on this day." />}
      {points && points.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Distance" value={stats?.km != null ? `${number(stats.km)} km` : '—'} />
            <Mini label="First point" value={time(stats?.start)} />
            <Mini label="Last point" value={time(stats?.end)} />
            <Mini label="Top speed" value={`${number(stats?.max)} km/h`} />
          </div>
          <RouteMap points={points} cursor={cursor} className="h-[320px] sm:h-[420px]" />
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <input type="range" min={0} max={points.length - 1} value={cursor} onChange={(e) => setCursor(Number(e.target.value))} className="flex-1 accent-brand-500" />
            <span className="w-36 text-right text-xs text-slate-600">
              {at ? `${dateTime(positionTime(at))} · ${number(at.speedKmh)} km/h` : ''}
            </span>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Speed</h3>
            <SpeedChart points={points} />
          </div>
        </div>
      )}
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-bold">{value}</p>
    </div>
  )
}
