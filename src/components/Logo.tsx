import { useId } from 'react'

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  // Unique id: a gradient defined inside a hidden copy (e.g. the desktop sidebar on phones) would not render.
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id})`} />
      <path d="M14 16h9l9 22 9-22h9L37 48h-10z" fill="#0b1220" />
      <path d="M8 54h48" stroke="#0b1220" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 5" />
    </svg>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <div className={`text-[15px] font-extrabold tracking-[0.12em] ${light ? 'text-white' : 'text-ink-950'}`}>VELAVAN</div>
        <div className={`mt-1 text-[10px] font-semibold tracking-[0.32em] ${light ? 'text-brand-400' : 'text-brand-600'}`}>TRANSPORT</div>
      </div>
    </div>
  )
}
