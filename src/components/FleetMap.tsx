import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { positionTime, STATE_META, vehicleState } from '@/lib/onelap'
import { ago, number } from '@/lib/format'
import type { Position, Vehicle } from '@/lib/types'

const INDIA: [number, number] = [11.2, 78.17] // Namakkal

function truckIcon(color: string, course = 0, label?: string) {
  return L.divIcon({
    className: 'vt-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="position:relative;width:40px;height:40px">
        <div style="position:absolute;inset:4px;border-radius:9999px;background:${color};opacity:.25"></div>
        <div style="position:absolute;inset:9px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
          <svg width="12" height="12" viewBox="0 0 24 24" style="transform:rotate(${course}deg)"><path d="M12 2l7 18-7-4-7 4z" fill="#fff"/></svg>
        </div>
        ${label ? `<div style="position:absolute;top:38px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0b1220;color:#fff;font:600 10px Inter,sans-serif;padding:2px 6px;border-radius:4px">${label}</div>` : ''}
      </div>`,
  })
}

function FitBounds({ points, follow }: { points: [number, number][]; follow?: boolean }) {
  const map = useMap()
  const key = follow ? points.map((p) => p.join()).join('|') : String(points.length)
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 14))
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

export function FleetMap({
  vehicles,
  positions,
  onSelect,
  className = 'h-[420px]',
  follow,
}: {
  vehicles: Vehicle[]
  positions: Record<number, Position | null>
  onSelect?: (v: Vehicle) => void
  className?: string
  follow?: boolean
}) {
  const items = vehicles
    .map((v) => ({ v, p: positions[v.onelap_device_id] }))
    .filter((x): x is { v: Vehicle; p: Position } => Boolean(x.p?.latitude))
  const points = items.map(({ p }) => [p.latitude, p.longitude] as [number, number])

  return (
    <div className={`overflow-hidden rounded-xl ring-1 ring-slate-200 ${className}`}>
      <MapContainer center={INDIA} zoom={7} className="size-full" scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} follow={follow} />
        {items.map(({ v, p }) => {
          const state = vehicleState(p)
          return (
            <Marker
              key={v.id}
              position={[p.latitude, p.longitude]}
              icon={truckIcon(STATE_META[state].color, p.course, v.reg_no)}
              eventHandlers={onSelect ? { click: () => onSelect(v) } : undefined}
            >
              {!onSelect && (
                <Popup>
                  <b>{v.reg_no}</b>
                  <br />
                  {STATE_META[state].label} · {number(p.speedKmh)} km/h
                  <br />
                  Updated {ago(positionTime(p))}
                </Popup>
              )}
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export function RouteMap({ points, cursor, className = 'h-[420px]' }: { points: Position[]; cursor?: number; className?: string }) {
  const line = useMemo(() => points.map((p) => [p.latitude, p.longitude] as [number, number]), [points])
  const at = cursor != null ? points[cursor] : undefined
  return (
    <div className={`overflow-hidden rounded-xl ring-1 ring-slate-200 ${className}`}>
      <MapContainer center={line[0] ?? INDIA} zoom={line.length ? 12 : 7} className="size-full" scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={line} />
        {line.length > 1 && (
          <>
            <Polyline positions={line} pathOptions={{ color: '#0b1220', weight: 7, opacity: 0.15 }} />
            <Polyline positions={line} pathOptions={{ color: '#f59e0b', weight: 4 }} />
            <CircleMarker center={line[0]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#10b981', fillOpacity: 1 }} />
            <CircleMarker center={line.at(-1)!} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }} />
          </>
        )}
        {at && <Marker position={[at.latitude, at.longitude]} icon={truckIcon('#0b1220', at.course)} />}
      </MapContainer>
    </div>
  )
}
