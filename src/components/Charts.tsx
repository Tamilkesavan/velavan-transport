import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'
import { hours, number } from '@/lib/format'
import { STATE_META } from '@/lib/onelap'
import type { Position, Summary, Vehicle } from '@/lib/types'

export const SERIES = ['#6366f1', '#0ea5e9', '#a855f7', '#14b8a6', '#ec4899', '#84cc16']
const axis = { fontSize: 11, fill: '#64748b' }
const tooltipStyle = { borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(15,23,42,.08)' }

/** Daily km, one stacked bar segment per vehicle. */
export function DailyKmChart({ vehicles, summaries, height = 260 }: { vehicles: Vehicle[]; summaries: Record<number, Summary>; height?: number }) {
  const days = summaries[vehicles[0]?.onelap_device_id]?.days.map((d) => d.day) ?? Object.values(summaries)[0]?.days.map((d) => d.day) ?? []
  const data = days.map((day) => {
    const row: Record<string, string | number> = { day: format(new Date(day), 'd MMM') }
    for (const v of vehicles) row[v.reg_no] = summaries[v.onelap_device_id]?.days.find((d) => d.day === day)?.km ?? 0
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit=" km" width={64} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${number(Number(v))} km`} cursor={{ fill: '#f8fafc' }} />
        {vehicles.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {vehicles.map((v, i) => (
          <Bar key={v.id} dataKey={v.reg_no} stackId="km" fill={SERIES[i % SERIES.length]} radius={i === vehicles.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Moving / idle / stopped hours per vehicle as horizontal stacked bars. */
export function TimeSplitChart({ vehicles, summaries }: { vehicles: Vehicle[]; summaries: Record<number, Summary> }) {
  const data = vehicles.map((v) => {
    const t = summaries[v.onelap_device_id]?.total
    return {
      name: v.reg_no,
      Moving: t ? t.moving_s / 3600 : 0,
      Idle: t ? t.idle_s / 3600 : 0,
      Stopped: t ? t.stopped_s / 3600 : 0,
    }
  })
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, vehicles.length * 52 + 50)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} unit="h" />
        <YAxis type="category" dataKey="name" tick={{ ...axis, fontWeight: 600, fill: '#334155' }} tickLine={false} axisLine={false} width={112} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => hours(Number(v) * 3600)} cursor={{ fill: '#f8fafc' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Moving" stackId="t" fill={STATE_META.moving.color} maxBarSize={22} />
        <Bar dataKey="Idle" stackId="t" fill={STATE_META.idle.color} maxBarSize={22} />
        <Bar dataKey="Stopped" stackId="t" fill={STATE_META.stopped.color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TimeDonut({ moving, idle, stopped }: { moving: number; idle: number; stopped: number }) {
  const total = moving + idle + stopped
  const data = [
    { name: 'Moving', value: moving, color: STATE_META.moving.color },
    { name: 'Idle', value: idle, color: STATE_META.idle.color },
    { name: 'Stopped', value: stopped, color: STATE_META.stopped.color },
  ]
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-32 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="70%" outerRadius="100%" strokeWidth={2} startAngle={90} endAngle={-270}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold">{total ? Math.round((moving / total) * 100) : 0}%</span>
          <span className="text-[11px] text-slate-500">moving</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: d.color }} />
            <span className="w-14 text-slate-500">{d.name}</span>
            <span className="font-semibold whitespace-nowrap">{hours(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SpeedChart({ points, height = 180 }: { points: Position[]; height?: number }) {
  const data = points.map((p) => ({ t: new Date(p.fixTime ?? p.fixedTime ?? p.serverTime ?? 0).getTime(), speed: p.speedKmh }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="spd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f59e0b" stopOpacity={0.35} />
            <stop offset="1" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => format(t, 'h:mm a')} tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit=" km/h" width={72} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => format(Number(t), 'h:mm a')} formatter={(v) => [`${number(Number(v))} km/h`, 'Speed']} />
        <Area type="monotone" dataKey="speed" stroke="#f59e0b" strokeWidth={2} fill="url(#spd)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
