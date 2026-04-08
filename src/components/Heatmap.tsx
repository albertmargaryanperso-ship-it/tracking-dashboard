import { useMemo } from 'react'
import type { VaultSession, RoutineEntry } from '@/types'
import { todayISO, addDays, blocsToHours } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface HeatmapProps {
  sessions: VaultSession[]
  routine: RoutineEntry[]
  days?: number // total days to show (default 182 = 6 months)
  mode: 'vault' | 'routine' | 'combined'
}

export const Heatmap = ({ sessions, routine, days = 182, mode }: HeatmapProps) => {
  const data = useMemo(() => {
    const today = todayISO()
    const start = addDays(today, -(days - 1))

    // Align start to a Monday (beginning of week)
    const startDate = new Date(start + 'T12:00:00')
    const dow = startDate.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    startDate.setDate(startDate.getDate() + diff)

    const byDate: Record<string, { vault: number; routine: number }> = {}
    for (const s of sessions) {
      if (!byDate[s.date]) byDate[s.date] = { vault: 0, routine: 0 }
      byDate[s.date].vault += s.hours
    }
    for (const r of routine) {
      if (!byDate[r.date]) byDate[r.date] = { vault: 0, routine: 0 }
      byDate[r.date].routine += blocsToHours(r.blocs)
    }

    // Build grid: 7 rows (days of week) × N columns (weeks)
    const cells: Array<{ date: string; vault: number; routine: number; future: boolean }> = []
    const cursor = new Date(startDate)
    const todayDate = new Date(today + 'T12:00:00')
    const totalCells = Math.ceil(days / 7) * 7 + 7
    for (let i = 0; i < totalCells; i++) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      const iso = `${y}-${m}-${d}`
      const entry = byDate[iso] ?? { vault: 0, routine: 0 }
      cells.push({ date: iso, ...entry, future: cursor > todayDate })
      cursor.setDate(cursor.getDate() + 1)
    }
    return cells
  }, [sessions, routine, days])

  const color = (cell: typeof data[number]): string => {
    if (cell.future) return 'bg-zinc-900/30'
    const val = mode === 'vault' ? cell.vault : mode === 'routine' ? cell.routine : cell.vault + cell.routine
    if (val === 0) return 'bg-zinc-800/60'
    if (mode === 'vault' || (mode === 'combined' && cell.vault > cell.routine)) {
      if (val < 1)   return 'bg-violet-500/25'
      if (val < 2.5) return 'bg-violet-500/50'
      if (val < 4)   return 'bg-violet-500/75'
      return 'bg-violet-400'
    }
    if (val < 1)   return 'bg-cyan-500/25'
    if (val < 2.5) return 'bg-cyan-500/50'
    if (val < 4)   return 'bg-cyan-500/75'
    return 'bg-cyan-400'
  }

  return (
    <div className="overflow-x-auto scrollbar-thin pb-2">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column' }}>
        {data.map((cell, i) => (
          <div
            key={i}
            className={cn('w-3 h-3 rounded-[3px] transition-all hover:scale-150 hover:z-10 relative cursor-default', color(cell))}
            title={cell.future ? cell.date : `${cell.date} — vault: ${cell.vault.toFixed(1)}h · routine: ${cell.routine.toFixed(1)}h`}
          />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-zinc-500">
        <span>Moins</span>
        <div className="w-2.5 h-2.5 rounded-[3px] bg-zinc-800/60" />
        <div className={cn('w-2.5 h-2.5 rounded-[3px]', mode === 'routine' ? 'bg-cyan-500/25' : 'bg-violet-500/25')} />
        <div className={cn('w-2.5 h-2.5 rounded-[3px]', mode === 'routine' ? 'bg-cyan-500/50' : 'bg-violet-500/50')} />
        <div className={cn('w-2.5 h-2.5 rounded-[3px]', mode === 'routine' ? 'bg-cyan-500/75' : 'bg-violet-500/75')} />
        <div className={cn('w-2.5 h-2.5 rounded-[3px]', mode === 'routine' ? 'bg-cyan-400' : 'bg-violet-400')} />
        <span>Plus</span>
      </div>
    </div>
  )
}
