import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { Layers } from 'lucide-react'
import { STATE_META, vehicleState, type VehicleState } from '@/lib/onelap'
import type { Position, Vehicle } from '@/lib/types'
import { cx } from './ui'

const NAMAKKAL: [number, number] = [11.22, 78.17]

const BASEMAPS = {
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  street: {
    label: 'Street',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri',
  },
} as const
type Basemap = keyof typeof BASEMAPS

/** Top-down truck, nose pointing north; rotated by the GPS course. */
function truckSvg(color: string) {
  return `
    <svg width="20" height="36" viewBox="0 0 24 44" fill="none">
      <rect x="2.5" y="15" width="19" height="27" rx="2.5" fill="${color}" stroke="#0b111d" stroke-width="1.2"/>
      <path d="M6 20h12M6 25h12M6 30h12M6 35h12" stroke="#0b111d" stroke-opacity=".35" stroke-width="1.2"/>
      <rect x="4" y="2" width="16" height="12.5" rx="3.5" fill="${color}" stroke="#0b111d" stroke-width="1.2"/>
      <rect x="6" y="4" width="12" height="4" rx="1.2" fill="#0b111d" fill-opacity=".75"/>
      <rect x="1.2" y="6" width="2.4" height="3.6" rx="1" fill="#0b111d"/>
      <rect x="20.4" y="6" width="2.4" height="3.6" rx="1" fill="#0b111d"/>
    </svg>`
}

function truckIcon({ state, course = 0, label, sub, selected }: { state: VehicleState; course?: number; label?: string; sub?: string; selected?: boolean }) {
  const color = STATE_META[state].color
  const ring = selected ? '#fbbf24' : color
  return L.divIcon({
    className: 'vt-marker',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    html: `
      <div style="position:relative;width:56px;height:56px">
        ${state === 'moving' ? `<div class="vt-pulse" style="position:absolute;inset:4px;border-radius:9999px;background:${color}"></div>` : ''}
        <div style="position:absolute;inset:6px;border-radius:9999px;background:radial-gradient(circle at 50% 35%, #1d2740, #0b111d);border:2px solid ${ring};box-shadow:0 0 0 ${selected ? 4 : 0}px rgb(251 191 36 / .25),0 0 18px ${color}88, 0 6px 14px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center">
          <div style="transform:rotate(${Math.round(course)}deg);display:flex">${truckSvg(color)}</div>
        </div>
        ${
          label
            ? `<div style="position:absolute;top:54px;left:50%;transform:translateX(-50%);white-space:nowrap;display:flex;gap:4px;align-items:center;background:rgba(6,10,19,.88);border:1px solid ${selected ? '#fbbf24' : 'rgba(255,255,255,.12)'};color:#f1f5f9;font:700 10.5px Inter,sans-serif;letter-spacing:.04em;padding:3px 7px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.5)">
                 <span style="width:6px;height:6px;border-radius:9999px;background:${color};box-shadow:0 0 6px ${color}"></span>${label}
                 ${sub ? `<span style="color:#94a3b8;font-weight:600">${sub}</span>` : ''}
               </div>`
            : ''
        }
      </div>`,
  })
}

/**
 * Marker that glides from its previous position to the new one over a second,
 * and only swaps its icon when the icon's content actually changes.
 */
function AnimatedMarker({ at, icon, iconKey, zIndex = 0, onClick }: { at: [number, number]; icon: () => L.DivIcon; iconKey: string; zIndex?: number; onClick?: () => void }) {
  const map = useMap()
  const marker = useRef<L.Marker | null>(null)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    const m = L.marker(at, { icon: icon(), zIndexOffset: zIndex }).addTo(map)
    m.on('click', () => clickRef.current?.())
    marker.current = m
    return () => {
      m.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    marker.current?.setIcon(icon())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconKey])

  useEffect(() => {
    marker.current?.setZIndexOffset(zIndex)
  }, [zIndex])

  const [lat, lng] = at
  useEffect(() => {
    const m = marker.current
    if (!m) return
    const from = m.getLatLng()
    if (from.lat === lat && from.lng === lng) return
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1000)
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      m.setLatLng([from.lat + (lat - from.lat) * e, from.lng + (lng - from.lng) * e])
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [lat, lng])

  return null
}

function FitBounds({ points, focus }: { points: [number, number][]; focus?: [number, number] | null }) {
  const map = useMap()
  const count = points.length
  useEffect(() => {
    if (!count) return
    if (count === 1) map.setView(points[0], Math.max(map.getZoom(), 13))
    else map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 14 })
    // fit once when vehicles first appear, not on every 10 s refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])
  const focusKey = focus?.join()
  useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), 14), { duration: 0.8 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])
  return null
}

/** Keeps a single followed vehicle in view as it moves. */
function Follow({ at }: { at: [number, number] | null }) {
  const map = useMap()
  const key = at?.join()
  useEffect(() => {
    if (at && !map.getBounds().pad(-0.2).contains(at)) map.panTo(at, { animate: true, duration: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

function BasemapSwitch({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  return (
    <div className="absolute top-3 right-3 z-[400] flex items-center gap-1 rounded-xl bg-ink-950/85 p-1 ring-1 ring-white/10 backdrop-blur">
      <Layers className="mx-1 size-3.5 text-slate-400" />
      {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={cx('rounded-lg px-2 py-1 text-[11px] font-semibold', value === b ? 'bg-brand-500 text-ink-950' : 'text-slate-300 hover:bg-white/10')}
        >
          {BASEMAPS[b].label}
        </button>
      ))}
    </div>
  )
}

function useBasemap() {
  const [basemap, setBasemap] = useState<Basemap>(() => {
    try {
      return (localStorage.getItem('vt-basemap') as Basemap) || 'dark'
    } catch {
      return 'dark'
    }
  })
  const set = (b: Basemap) => {
    setBasemap(b)
    try {
      localStorage.setItem('vt-basemap', b)
    } catch {
      // ignore
    }
  }
  return [basemap, set] as const
}

export function FleetMap({
  vehicles,
  positions,
  selectedId,
  onSelect,
  className = 'h-[420px]',
  follow,
  children,
}: {
  vehicles: Vehicle[]
  positions: Record<number, Position | null>
  selectedId?: string | null
  onSelect?: (v: Vehicle) => void
  className?: string
  follow?: boolean
  children?: React.ReactNode
}) {
  const [basemap, setBasemap] = useBasemap()
  const items = vehicles
    .map((v) => ({ v, p: positions[v.onelap_device_id] }))
    .filter((x): x is { v: Vehicle; p: Position } => Boolean(x.p?.latitude))
  const points = items.map(({ p }) => [p.latitude, p.longitude] as [number, number])
  const selected = items.find((x) => x.v.id === selectedId)
  const focus = selected ? ([selected.p.latitude, selected.p.longitude] as [number, number]) : null

  return (
    <div className={cx('relative isolate overflow-hidden rounded-2xl ring-1 ring-white/10', className)}>
      <MapContainer center={NAMAKKAL} zoom={8} className="size-full" scrollWheelZoom zoomControl={false} attributionControl>
        <TileLayer key={basemap} attribution={BASEMAPS[basemap].attribution} url={BASEMAPS[basemap].url} />
        <FitBounds points={points} focus={follow ? null : focus} />
        {follow && <Follow at={points[0] ?? null} />}
        {items.map(({ v, p }) => {
          const state = vehicleState(p)
          const opts = {
            state,
            course: Math.round((p.course ?? 0) / 5) * 5,
            label: v.reg_no,
            sub: state === 'moving' ? `${Math.round(p.speedKmh)} km/h` : undefined,
            selected: v.id === selectedId,
          }
          return (
            <AnimatedMarker
              key={v.id}
              at={[p.latitude, p.longitude]}
              icon={() => truckIcon(opts)}
              iconKey={JSON.stringify(opts)}
              zIndex={v.id === selectedId ? 1000 : 0}
              onClick={onSelect ? () => onSelect(v) : undefined}
            />
          )
        })}
      </MapContainer>
      <BasemapSwitch value={basemap} onChange={setBasemap} />
      {children}
    </div>
  )
}

export function RouteMap({ points, cursor, className = 'h-[420px]' }: { points: Position[]; cursor?: number; className?: string }) {
  const [basemap, setBasemap] = useBasemap()
  const line = useMemo(() => points.map((p) => [p.latitude, p.longitude] as [number, number]), [points])
  const at = cursor != null ? points[cursor] : undefined
  const travelled = cursor != null ? line.slice(0, cursor + 1) : []
  return (
    <div className={cx('relative isolate overflow-hidden rounded-2xl ring-1 ring-white/10', className)}>
      <MapContainer center={line[0] ?? NAMAKKAL} zoom={line.length ? 12 : 8} className="size-full" scrollWheelZoom zoomControl={false}>
        <TileLayer key={basemap} attribution={BASEMAPS[basemap].attribution} url={BASEMAPS[basemap].url} />
        <FitBounds points={line} />
        {line.length > 1 && (
          <>
            <Polyline positions={line} pathOptions={{ color: '#f59e0b', weight: 10, opacity: 0.12 }} />
            <Polyline positions={line} pathOptions={{ color: '#64748b', weight: 4, opacity: 0.9 }} />
            {travelled.length > 1 && <Polyline positions={travelled} pathOptions={{ color: '#fbbf24', weight: 4.5 }} />}
            <CircleMarker center={line[0]} radius={7} pathOptions={{ color: '#0b111d', weight: 3, fillColor: '#10b981', fillOpacity: 1 }} />
            <CircleMarker center={line.at(-1)!} radius={7} pathOptions={{ color: '#0b111d', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }} />
          </>
        )}
        {at && (
          <Marker
            position={[at.latitude, at.longitude]}
            icon={truckIcon({ state: at.speedKmh >= 5 ? 'moving' : at.ignition ? 'idle' : 'stopped', course: at.course })}
          />
        )}
      </MapContainer>
      <BasemapSwitch value={basemap} onChange={setBasemap} />
    </div>
  )
}
