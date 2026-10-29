import { format, formatDistanceToNowStrict, startOfMonth } from 'date-fns'

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

export const number = (n: number | null | undefined) => num.format(Number(n ?? 0))
export const dateTime = (d: string | Date | null | undefined) => (d ? format(new Date(d), 'dd MMM, h:mm a') : '—')
export const time = (d: string | Date | null | undefined) => (d ? format(new Date(d), 'h:mm a') : '—')
export const ago = (d: string | Date | null | undefined) => (d ? `${formatDistanceToNowStrict(new Date(d))} ago` : 'never')
export const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
export const monthRange = (d = new Date()) => ({ from: ymd(startOfMonth(d)), to: ymd(d) })

/** Seconds -> "12h 30m" */
export function hours(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}
