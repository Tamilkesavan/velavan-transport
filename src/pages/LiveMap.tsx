import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Gauge, KeyRound, Search } from 'lucide-react'
import { useLivePositions, useVehicles } from '@/hooks/useFleet'
import { ago, number } from '@/lib/format'
import { positionTime, STATE_META, vehicleState } from '@/lib/onelap'
import { Badge, Input, Spinner, cx } from '@/components/ui'
import { FleetMap } from '@/components/FleetMap'
import { LiveIndicator } from '@/components/LiveIndicator'

export default function LiveMap() {
  const navigate = useNavigate()
  const { vehicles, loading } = useVehicles()
  const { positions, updatedAt, refresh } = useLivePositions(vehicles)
  const [selected, setSelected] = useState<string | null>(null)
  const [q, setQ] = useState('')
  if (loading) return <Spinner />

  const list = vehicles.filter((v) => v.reg_no.toLowerCase().includes(q.toLowerCase()) || (v.name ?? '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="-mx-4 -mt-5 sm:-mx-6 lg:-mx-8 lg:-mt-8">
      <FleetMap
        vehicles={vehicles}
        positions={positions}
        selectedId={selected}
        onSelect={(v) => setSelected(v.id)}
        className="h-[calc(100dvh-9.5rem)] rounded-none ring-0 lg:h-dvh"
      >
        <div className="absolute top-3 left-3 z-[400]">
          <LiveIndicator updatedAt={updatedAt} onRefresh={refresh} />
        </div>
        <div className="absolute inset-x-3 bottom-3 z-[400] lg:top-16 lg:right-auto lg:bottom-auto lg:w-80">
          <div className="rounded-2xl bg-ink-950/85 p-2 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl">
            <div className="relative hidden p-1 lg:block">
              <Search className="absolute top-3.5 left-4 size-4 text-slate-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vehicle" className="pl-9" />
            </div>
            <ul className="scrollbar-thin flex gap-2 overflow-x-auto p-1 lg:max-h-[calc(100dvh-12rem)] lg:flex-col lg:overflow-y-auto">
              {list.map((v) => {
                const p = positions[v.onelap_device_id]
                const state = vehicleState(p)
                const active = v.id === selected
                return (
                  <li key={v.id} className="w-64 shrink-0 lg:w-auto">
                    <div
                      onClick={() => setSelected(v.id)}
                      className={cx(
                        'cursor-pointer rounded-xl p-3 ring-1 transition',
                        active ? 'bg-brand-500/10 ring-brand-400/60' : 'bg-white/[0.03] ring-white/5 hover:bg-white/[0.06]',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold tracking-wide text-white">{v.reg_no}</span>
                        <Badge tone={STATE_META[state].tone} dot={STATE_META[state].color}>
                          {STATE_META[state].label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Gauge className="size-3.5" /> {number(p?.speedKmh)} km/h
                        </span>
                        <span className="flex items-center gap-1">
                          <KeyRound className="size-3.5" /> {p?.ignition ? 'On' : 'Off'}
                        </span>
                        <span className="ml-auto">{p ? ago(positionTime(p)) : 'no data'}</span>
                      </div>
                      {active && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/vehicles/${v.id}`)
                          }}
                          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg bg-brand-500 py-1.5 text-xs font-bold text-ink-950"
                        >
                          Open details <ArrowUpRight className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </FleetMap>
    </div>
  )
}
