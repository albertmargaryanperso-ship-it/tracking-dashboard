import { useMemo } from 'react'
import type { Todo } from '@/types'
import { todayISO, addDays, cn, categoryGroup } from '@/lib/utils'

interface HeatmapProps {
  todos: Todo[]
  days?: number
  mode: 'travail' | 'personnel' | 'combined'
}

export const Heatmap = ({ todos, days = 182, mode }: HeatmapProps) => {
  const data = useMemo(() => {
    const today = todayISO()
    const start = addDays(today, -(days - 1))
    const startDate = new Date(start + 'T12:00:00')
    const dow = startDate.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    startDate.setDate(startDate.getDate() + diff)

    // Build per-day hours from completed todos
    const byDate: Record<string, { travail: number; personnel: number }> = {}
    const doneTodos = todos.filter(t => t.status === 'done' && t.completed_at && t.completed_min)
    for (const t of doneTodos) {
      const d = t.completed_at!
      if (!byDate[d]) byDate[d] = { travail: 0, personnel: 0 }
      const hours = (t.completed_min ?? 0) / 60
      if (categoryGroup(t.category) === 'travail') byDate[d].travail += hours
      else byDate[d].personnel += hours
    }

    const cells: Array<{ date: string; travail: number; personnel: number; future: boolean }> = []
    const cursor = new Date(startDate)
    const todayDate = new Date(today + 'T12:00:00')
    const totalCells = Math.ceil(days / 7) * 7 + 7
    for (let i = 0; i < totalCells; i++) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      const iso = `${y}-${m}-${d}`
      const entry = byDate[iso] ?? { travail: 0, personnel: 0 }
      cells.push({ date: iso, ...entry, future: cursor > todayDate })
      cursor.setDate(cursor.getDate() + 1)
    }
    return cells
  }, [todos, days])

  // 6-level color scale based on cumulative hours
  const color = (cell: typeof data[number]): string => {
    if (cell.future) return 'bg-zinc-900/30'
    const val = mode === 'travail' ? cell.travail : mode === 'personnel' ? cell.personnel : cell.travail + cell.personnel
    if (val === 0) return 'bg-zinc-800/60'

    // 8h+ = orange doré
    if (val >= 8) return 'bg-amber-500'

    // Violet for travail, cyan for personnel
    const isViolet = mode === 'travail' || (mode === 'combined' && cell.travail >= cell.personnel)

    if (val < 1)   return isViolet ? 'bg-violet-500/20' : 'bg-cyan-500/20'
    if (val < 2)   return isViolet ? 'bg-violet-500/40' : 'bg-cyan-500/40'
    if (val < 4)   return isViolet ? 'bg-violet-500/60' : 'bg-cyan-500/60'
    return isViolet ? 'bg-violet-500/80' : 'bg-cyan-500/80'
  }

  return (
    <div className="overflow-x-auto scrollbar-thin pb-2">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column' }}>
        {data.map((cell, i) => (
          <div key={i} className={cn('w-3 h-3 rounded-[3px] transition-all hover:scale-150 hover:z-10', color(cell))}
            title={`${cell.date} | T: ${cell.travail.toFixed(1)}h | P: ${cell.personnel.toFixed(1)}h`} />
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[9px] text-zinc-500">Moins</span>
        <div className="w-3 h-3 rounded-[2px] bg-zinc-800/60" />
        <div className={cn('w-3 h-3 rounded-[2px]', mode === 'personnel' ? 'bg-cyan-500/20' : 'bg-violet-500/20')} />
        <div className={cn('w-3 h-3 rounded-[2px]', mode === 'personnel' ? 'bg-cyan-500/40' : 'bg-violet-500/40')} />
        <div className={cn('w-3 h-3 rounded-[2px]', mode === 'personnel' ? 'bg-cyan-500/60' : 'bg-violet-500/60')} />
        <div className={cn('w-3 h-3 rounded-[2px]', mode === 'personnel' ? 'bg-cyan-500/80' : 'bg-violet-500/80')} />
        <div className="w-3 h-3 rounded-[2px] bg-amber-500" />
        <span className="text-[9px] text-zinc-500">Plus</span>
      </div>
    </div>
  )
}
