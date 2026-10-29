import { useMemo, useState } from 'react'
import { endOfMonth, format } from 'date-fns'
import { ymd } from '@/lib/format'

/** Selected month (yyyy-MM) and its date range, clipped to today. */
export function useMonth() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const range = useMemo(() => {
    const start = new Date(`${month}-01T00:00:00`)
    const end = endOfMonth(start)
    return { from: ymd(start), to: ymd(end > new Date() ? new Date() : end), days: Math.max(1, (end > new Date() ? new Date() : end).getDate()) }
  }, [month])
  return { month, setMonth, range }
}
