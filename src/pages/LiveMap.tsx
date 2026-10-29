import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useLivePositions, useVehicles } from '@/hooks/useFleet'
import { ago, number, time } from '@/lib/format'
import { positionTime, STATE_META, vehicleState } from '@/lib/onelap'
import { Badge, Button, Card, PageHeader, Spinner } from '@/components/ui'
import { FleetMap } from '@/components/FleetMap'

export default function LiveMap() {
  const navigate = useNavigate()
  const { vehicles, loading } = useVehicles()
  const { positions, updatedAt, refresh } = useLivePositions(vehicles, 10000)
  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Live map"
        subtitle={updatedAt ? `Auto-refresh every 10 s · last ${time(updatedAt)}` : 'Loading positions…'}
        actions={
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <FleetMap vehicles={vehicles} positions={positions} onSelect={(v) => navigate(`/vehicles/${v.id}`)} className="h-[55vh] lg:h-[calc(100vh-11rem)]" />
        <div className="space-y-2">
          {vehicles.map((v) => {
            const p = positions[v.onelap_device_id]
            const state = vehicleState(p)
            return (
              <Card key={v.id} className="cursor-pointer p-3 hover:ring-brand-400">
                <button className="w-full text-left" onClick={() => navigate(`/vehicles/${v.id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold tracking-wide">{v.reg_no}</span>
                    <Badge tone={STATE_META[state].tone}>{STATE_META[state].label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {number(p?.speedKmh)} km/h · ignition {p?.ignition ? 'on' : 'off'} · {p ? ago(positionTime(p)) : 'no data'}
                  </p>
                </button>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
