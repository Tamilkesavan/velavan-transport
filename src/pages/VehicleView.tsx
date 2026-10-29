import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { endOfDay, format, startOfDay } from 'date-fns'
import { Activity, ArrowLeft, BatteryMedium, Clock, KeyRound, MapPin, Pause, PauseCircle, Play, Route, Signal, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLivePositions, useSummaries, useVehicles } from '@/hooks/useFleet'
import { useMonth } from '@/hooks/useMonth'
import { ago, dateTime, hours, number, time, ymd } from '@/lib/format'
import { onelap, positionTime, STATE_META, vehicleState } from '@/lib/onelap'
import type { Position } from '@/lib/types'
import { Badge, Button, Card, CardTitle, Empty, ErrorNote, Input, PageHeader, Skeleton, Spinner, Stat } from '@/components/ui'
import { FleetMap, RouteMap } from '@/components/FleetMap'
import { DailyHoursChart, DailyKmChart, Legend, SpeedChart, TimeDonut } from '@/components/Charts'
import { LiveIndicator } from '@/components/LiveIndicator'

export default function VehicleView() {
  const { id } = useParams()
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const vehicleId = isOwner ? id : profile?.vehicle_id
  const { vehicles, loading } = useVehicles()
  const vehicle = vehicles.find((v) => v.id === vehicleId)
  const list = useMemo(() => (vehicle ? [vehicle] : []), [vehicle])
  const { positions, errors, updatedAt, refresh } = useLivePositions(list)
  const { month, setMonth, range } = useMonth()
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
  const state = vehicleState(p)
  const s = summaries[vehicle.onelap_device_id]

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {isOwner && (
              <Link to="/" className="rounded-xl p-1.5 text-slate-400 ring-1 ring-white/10 hover:bg-white/5" aria-label="Back">
                <ArrowLeft className="size-5" />
              </Link>
            )}
            <span className="tracking-wide">{vehicle.reg_no}</span>
            <Badge tone={STATE_META[state].tone} dot={STATE_META[state].color}>
              {STATE_META[state].label}
            </Badge>
          </span>
        }
        subtitle={`${vehicle.name && vehicle.name !== vehicle.reg_no ? `${vehicle.name} · ` : ''}OneLap device ${vehicle.onelap_device_id}${!isOwner && profile?.name ? ` · Driver ${profile.name}` : ''}`}
        actions={<LiveIndicator updatedAt={updatedAt} onRefresh={refresh} />}
      />

      <ErrorNote error={errors[vehicle.onelap_device_id] ?? null} />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-3 xl:col-span-2">
          <FleetMap vehicles={list} positions={positions} selectedId={vehicle.id} className="h-[300px] sm:h-[420px]" follow />
        </Card>
        <Card className="flex flex-col p-5">
          <CardTitle title="Right now" subtitle={p ? `Updated ${ago(positionTime(p))}` : 'Waiting for the device'} />
          <SpeedGauge kmh={p?.speedKmh ?? 0} color={STATE_META[state].color} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Live icon={<KeyRound />} label="Ignition" value={p ? (p.ignition ? 'On' : 'Off') : '—'} />
            <Live icon={<Route />} label="Odometer" value={p?.attributes?.totalDistance ? `${number(p.attributes.totalDistance / 1000)} km` : '—'} />
            <Live icon={<BatteryMedium />} label="Battery" value={p?.attributes?.battery != null ? `${p.attributes.battery}/6` : '—'} />
            <Live icon={<Signal />} label="GSM signal" value={p?.attributes?.gsm != null ? `${p.attributes.gsm}/5` : '—'} />
          </div>
          {p && (
            <a
              href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-xs text-slate-300 ring-1 ring-white/5 hover:bg-white/[0.06]"
            >
              <MapPin className="size-4 shrink-0 text-brand-400" />
              <span className="truncate">{p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`} · open in Google Maps</span>
            </a>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Monthly report</h2>
          <p className="text-xs text-slate-500">From OneLap position history, days in IST</p>
        </div>
        <Input type="month" value={month} max={format(new Date(), 'yyyy-MM')} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
      </div>
      <ErrorNote error={sumError} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {s || !sumLoading ? (
          <>
            <Stat label="Distance" value={s ? number(s.total.km) : '—'} unit="km" hint={s ? `${number(s.total.km / range.days)} km per day` : undefined} icon={<Route />} tone="blue" accent="#38bdf8" />
            <Stat label="Running" value={s ? hours(s.total.moving_s) : '—'} hint={s ? `Top speed ${number(s.total.max_speed)} km/h` : undefined} icon={<Activity />} tone="green" accent="#34d399" />
            <Stat label="Idle" value={s ? hours(s.total.idle_s) : '—'} hint="Engine on, not moving" icon={<Clock />} tone="amber" accent="#fbbf24" />
            <Stat label="Stopped" value={s ? hours(s.total.stopped_s) : '—'} hint="Engine off or no signal" icon={<PauseCircle />} tone="slate" />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px]" />)
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <CardTitle title="Distance per day" subtitle="Kilometres" />
          {sumLoading && !s ? <Skeleton className="h-[260px]" /> : <DailyKmChart vehicles={list} summaries={summaries} />}
        </Card>
        <Card className="p-5">
          <CardTitle title="Time split" subtitle={format(new Date(`${month}-01T00:00:00`), 'MMMM yyyy')} />
          {sumLoading && !s ? <Skeleton className="h-36" /> : <TimeDonut moving={s?.total.moving_s ?? 0} idle={s?.total.idle_s ?? 0} stopped={s?.total.stopped_s ?? 0} />}
        </Card>
      </div>
      <Card className="p-5">
        <CardTitle title="Running and idle hours per day" right={<Legend items={[{ label: 'Running', color: STATE_META.moving.color }, { label: 'Idle', color: STATE_META.idle.color }]} />} />
        {sumLoading && !s ? <Skeleton className="h-[220px]" /> : <DailyHoursChart summaries={s ? [s] : []} />}
      </Card>

      <RouteReplay deviceId={vehicle.onelap_device_id} />
    </div>
  )
}

/** Half-circle speedometer, 0–100 km/h. */
function SpeedGauge({ kmh, color }: { kmh: number; color: string }) {
  const max = 100
  const k = Math.min(1, kmh / max)
  const r = 80
  const arc = Math.PI * r
  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <svg viewBox="0 0 200 116" className="w-full">
        <defs>
          <linearGradient id="gauge" x1="0" x2="1">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="0.6" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#f87171" />
          </linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gauge)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - k)}
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
        {[0, 20, 40, 60, 80, 100].map((t) => {
          const a = Math.PI * (1 - t / max)
          return (
            <text key={t} x={100 + Math.cos(a) * 58} y={100 - Math.sin(a) * 58 + 3} textAnchor="middle" fontSize="8" fill="#64748b">
              {t}
            </text>
          )
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <span className="text-4xl font-bold text-white tabular-nums">{Math.round(kmh)}</span>
        <span className="ml-1 text-xs text-slate-400">km/h</span>
      </div>
    </div>
  )
}

function Live({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 [&>svg]:size-3.5">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-white tabular-nums">{value}</p>
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
      setPoints(await onelap.history(deviceId, startOfDay(d), end))
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
    let moving = 0
    for (let i = 1; i < points.length; i++) {
      const dt = (new Date(positionTime(points[i])!).getTime() - new Date(positionTime(points[i - 1])!).getTime()) / 1000
      if (dt > 0 && dt < 1200 && points[i - 1].speedKmh >= 5) moving += dt
    }
    return { km: odo > 0 ? odo / 1000 : null, start: positionTime(first), end: positionTime(last), max: Math.max(...points.map((p) => p.speedKmh)), moving }
  }, [points])

  const at = points?.[cursor]

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Route replay</h2>
          <p className="text-xs text-slate-500">Where the vehicle went on a day</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} className="w-40" />
          <Button onClick={load} loading={busy}>
            Show route
          </Button>
        </div>
      </div>
      <ErrorNote error={error} />
      {!points && !busy && <Empty icon={<Route />} title="Pick a day" text="Choose a date and press Show route to replay the trip on the map." />}
      {points && !points.length && <Empty icon={<Route />} title="No movement recorded" text="The device sent no positions on this day." />}
      {points && points.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Live icon={<Route />} label="Distance" value={stats?.km != null ? `${number(stats.km)} km` : '—'} />
            <Live icon={<Activity />} label="Running" value={hours(stats?.moving ?? 0)} />
            <Live icon={<Clock />} label="First point" value={time(stats?.start)} />
            <Live icon={<Clock />} label="Last point" value={time(stats?.end)} />
            <Live icon={<Activity />} label="Top speed" value={`${number(stats?.max)} km/h`} />
          </div>
          <RouteMap points={points} cursor={cursor} className="h-[320px] sm:h-[460px]" />
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5">
            <Button onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Play'} className="size-10 rounded-full p-0">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <input type="range" min={0} max={points.length - 1} value={cursor} onChange={(e) => setCursor(Number(e.target.value))} className="flex-1 accent-brand-500" />
            <span className="hidden w-44 text-right text-xs text-slate-400 tabular-nums sm:block">{at ? `${dateTime(positionTime(at))} · ${number(at.speedKmh)} km/h` : ''}</span>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-300">Speed through the day</h3>
            <SpeedChart points={points} />
          </div>
        </div>
      )}
    </Card>
  )
}
