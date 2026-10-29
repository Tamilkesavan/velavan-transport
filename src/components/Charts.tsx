import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'
import { hours, number } from '@/lib/format'
import { STATE_META } from '@/lib/onelap'
import type { Position, Summary, Vehicle } from '@/lib/types'

export const SERIES = ['#818cf8', '#38bdf8', '#e879f9', '#2dd4bf', '#fb7185', '#a3e635']
const axis = { fontSize: 11, fill: '#64748b' }
const grid = 'rgba(255,255,255,0.06)'
const tooltipStyle = {
  background: 'rgba(11,17,29,0.96)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 12,
  color: '#e2e8f0',
  boxShadow: '0 12px 30px rgba(0,0,0,.5)',
}
const cursor = { fill: 'rgba(255,255,255,0.04)' }
// Parked time is the normal state of a lorry, so charts show it muted rather than red.
export const STOPPED_CHART = '#475569'

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Daily km, one stacked segment per vehicle. */
export function DailyKmChart({ vehicles, summaries, height = 260 }: { vehicles: Vehicle[]; summaries: Record<number, Summary>; height?: number }) {
  const days = Object.values(summaries)[0]?.days.map((d) => d.day) ?? []
  const colorOf = (v: Vehicle) => SERIES[vehicles.indexOf(v) % SERIES.length]
  const data = days.map((day) => {
    const row: Record<string, string | number> = { day: format(new Date(day), 'd MMM') }
    for (const v of vehicles) row[v.reg_no] = summaries[v.onelap_device_id]?.days.find((d) => d.day === day)?.km ?? 0
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          {vehicles.map((v) => (
            <linearGradient key={v.id} id={`km-${v.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={colorOf(v)} stopOpacity={1} />
              <stop offset="1" stopColor={colorOf(v)} stopOpacity={0.55} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} width={40} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${number(Number(v))} km`} cursor={cursor} />
        {vehicles.map((v, i) => (
          <Bar key={v.id} dataKey={v.reg_no} stackId="km" fill={`url(#km-${v.id})`} radius={i === vehicles.length - 1 ? [5, 5, 0, 0] : 0} maxBarSize={26} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Running and idle hours per day for one vehicle (or the fleet, summed). */
export function DailyHoursChart({ summaries, height = 220 }: { summaries: Summary[]; height?: number }) {
  const days = summaries[0]?.days ?? []
  const data = days.map((d, i) => ({
    day: format(new Date(d.day), 'd MMM'),
    Running: summaries.reduce((a, s) => a + (s.days[i]?.moving_s ?? 0), 0) / 3600,
    Idle: summaries.reduce((a, s) => a + (s.days[i]?.idle_s ?? 0), 0) / 3600,
  }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}h`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => hours(Number(v) * 3600)} cursor={cursor} />
        <Bar dataKey="Running" stackId="h" fill={STATE_META.moving.color} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="Idle" stackId="h" fill={STATE_META.idle.color} radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TimeDonut({ moving, idle, stopped }: { moving: number; idle: number; stopped: number }) {
  const total = moving + idle + stopped
  const data = [
    { name: 'Running', value: moving, color: STATE_META.moving.color },
    { name: 'Idle', value: idle, color: STATE_META.idle.color },
    { name: 'Stopped', value: stopped, color: STOPPED_CHART },
  ]
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-36 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="74%" outerRadius="100%" stroke="#0f1626" strokeWidth={3} startAngle={90} endAngle={-270} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums">{pct(moving)}%</span>
          <span className="text-[11px] text-slate-500">running</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-3 text-sm">
        {data.map((d) => (
          <li key={d.name}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="font-semibold whitespace-nowrap text-white tabular-nums">{hours(d.value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full" style={{ width: `${pct(d.value)}%`, background: d.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One row per vehicle: distance bar plus running/idle/stopped split. */
export function VehicleBreakdown({ vehicles, summaries, onSelect }: { vehicles: Vehicle[]; summaries: Record<number, Summary>; onSelect?: (v: Vehicle) => void }) {
  const max = Math.max(1, ...vehicles.map((v) => summaries[v.onelap_device_id]?.total.km ?? 0))
  return (
    <ul className="space-y-4">
      {vehicles.map((v, i) => {
        const t = summaries[v.onelap_device_id]?.total
        const all = t ? t.moving_s + t.idle_s + t.stopped_s || 1 : 1
        return (
          <li key={v.id}>
            <button className="w-full text-left" onClick={() => onSelect?.(v)}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold tracking-wide text-slate-100">
                  <span className="size-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
                  {v.reg_no}
                </span>
                <span className="font-bold text-white tabular-nums">
                  {t ? number(t.km) : '—'} <span className="text-xs font-medium text-slate-500">km</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${((t?.km ?? 0) / max) * 100}%`, background: `linear-gradient(90deg, ${SERIES[i % SERIES.length]}88, ${SERIES[i % SERIES.length]})` }} />
              </div>
              {t && (
                <div className="mt-1.5 flex h-1 overflow-hidden rounded-full">
                  <div style={{ width: `${(t.moving_s / all) * 100}%`, background: STATE_META.moving.color }} />
                  <div style={{ width: `${(t.idle_s / all) * 100}%`, background: STATE_META.idle.color }} />
                  <div style={{ width: `${(t.stopped_s / all) * 100}%`, background: STOPPED_CHART }} />
                </div>
              )}
              {t && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {hours(t.moving_s)} running · {hours(t.idle_s)} idle · top {number(t.max_speed)} km/h
                </p>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function SpeedChart({ points, height = 180 }: { points: Position[]; height?: number }) {
  const data = points.map((p) => ({ t: new Date(p.fixTime ?? p.fixedTime ?? p.serverTime ?? 0).getTime(), speed: p.speedKmh }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="spd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbbf24" stopOpacity={0.45} />
            <stop offset="1" stopColor="#fbbf24" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => format(t, 'h:mm a')} tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => format(Number(t), 'h:mm a')} formatter={(v) => [`${number(Number(v))} km/h`, 'Speed']} />
        <Area type="monotone" dataKey="speed" stroke="#fbbf24" strokeWidth={2} fill="url(#spd)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
