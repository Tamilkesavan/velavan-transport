import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X, Loader2 } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-b from-brand-400 to-brand-500 text-ink-950 shadow-[0_0_0_1px_rgb(245_158_11/0.4),0_8px_24px_-8px_rgb(245_158_11/0.6)] hover:from-brand-300 hover:to-brand-400',
  secondary: 'bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10',
  ghost: 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
  danger: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/20',
}

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-2xl bg-ink-850/80 ring-1 ring-white/[0.06] shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset,0_20px_40px_-24px_rgb(0_0_0/0.8)] backdrop-blur', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const toneText: Record<Tone, string> = {
  slate: 'text-slate-300 bg-slate-400/10 ring-slate-400/20',
  green: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/25',
  amber: 'text-amber-300 bg-amber-400/10 ring-amber-400/25',
  red: 'text-red-300 bg-red-400/10 ring-red-400/25',
  blue: 'text-sky-300 bg-sky-400/10 ring-sky-400/25',
  violet: 'text-violet-300 bg-violet-400/10 ring-violet-400/25',
}

export function Stat({ label, value, unit, hint, icon, tone = 'slate', accent }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; icon?: ReactNode; tone?: Tone; accent?: string }) {
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      {accent && <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
        {icon && <span className={cx('rounded-lg p-1.5 ring-1 [&>svg]:size-4', toneText[tone])}>{icon}</span>}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5 text-[22px] leading-none font-bold tracking-tight whitespace-nowrap text-white tabular-nums sm:text-3xl">
        {value}
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}

export function Badge({ tone = 'slate', children, dot }: { tone?: Tone; children: ReactNode; dot?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', toneText[tone])}>
      {dot && <span className="size-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />}
      {children}
    </span>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const control =
  'block rounded-xl border-0 bg-ink-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-60'
// Full width unless the caller sets its own width
const width = (className?: string) => (/(^|\s)w-/.test(className ?? '') ? '' : 'w-full')

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(control, width(className), className)} />
})
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(control, width(className), 'pr-8', className)} />
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-ink-850 ring-1 ring-white/10 shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/5 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-2xl bg-white/5 p-3 text-slate-400 ring-1 ring-white/10 [&>svg]:size-6">{icon}</div>
      <p className="font-semibold text-slate-100">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cx('flex justify-center py-16 text-slate-500', className)}>
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-white/5', className)} />
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/25">{error}</p>
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  )
}

/** Horizontal pill selector, scrolls on small screens. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 transition',
            value === o.value ? 'bg-brand-500 text-ink-950 ring-brand-400 shadow-[0_8px_24px_-10px_rgb(245_158_11/0.8)]' : 'bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.07]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
