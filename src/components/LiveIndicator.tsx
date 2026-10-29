import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { LIVE_INTERVAL_MS } from '@/hooks/useFleet'

/** "Live · 7s" pill that counts down to the next 10-second OneLap refresh. */
export function LiveIndicator({ updatedAt, onRefresh }: { updatedAt: Date | null; onRefresh?: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const left = updatedAt ? Math.max(0, Math.ceil((updatedAt.getTime() + LIVE_INTERVAL_MS - now) / 1000)) : null
  const pct = updatedAt ? Math.min(1, (now - updatedAt.getTime()) / LIVE_INTERVAL_MS) : 0

  return (
    <button
      onClick={onRefresh}
      className="group flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-400/15"
      title="Refresh now"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      LIVE
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-emerald-400/20">
        <span className="absolute inset-y-0 left-0 rounded-full bg-emerald-400" style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="w-5 text-right tabular-nums">{left == null ? '…' : `${left}s`}</span>
      <RefreshCw className="size-3 opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}
