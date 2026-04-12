import { useMemo } from 'react'
import type { Todo, ArchiveMonth, CategoryConfig } from '@/types'
import { todayISO, addDays, cn, categoryGroup } from '@/lib/utils'

interface HeatmapProps {
  todos: Todo[]
  archive?: ArchiveMonth[]
  customCategories?: CategoryConfig[]
  categoryFilter?: string[]
  days?: number
  mode: 'travail' | 'personnel' | 'combined'
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const DAY_LABELS = ['', 'L', '', 'M', '', 'V', '']

export const Heatmap = ({ todos, archive, customCategories, categoryFilter, days = 182, mode }: HeatmapProps) => {
  const { cells, months } = useMemo(() => {
    const today = todayISO()
    const start = addDays(today, -(days - 1))
    const startDate = new Date(start + 'T12:00:00')
    const dow = startDate.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    startDate.setDate(startDate.getDate() + diff)

    // Build per-day hours from completed todos + archived todos
    const byDate: Record<string, { travail: number; personnel: number }> = {}
    const catSet = categoryFilter?.length ? new Set(categoryFilter) : null
    const addTodo = (t: Todo) => {
      if (!t.completed_at || !t.completed_min) return
      if (catSet && !catSet.has(t.category)) return
      const d = t.completed_at
      if (!byDate[d]) byDate[d] = { travail: 0, personnel: 0 }
      const hours = (t.completed_min ?? 0) / 60
      if (categoryGroup(t.category, customCategories) === 'travail') byDate[d].travail += hours
      else byDate[d].personnel += hours
    }
    todos.filter(t => t.status === 'done' && t.completed_at && t.completed_min).forEach(addTodo)
    archive?.forEach(a => a.todos.forEach(addTodo))

    const cellList: Array<{ date: string; travail: number; personnel: number; future: boolean }> = []
    const monthPositions: Array<{ label: string; col: number }> = []
    let lastMonth = -1

    const cursor = new Date(startDate)
    const todayDate = new Date(today + 'T12:00:00')
    const totalCells = Math.ceil(days / 7) * 7 + 7
    for (let i = 0; i < totalCells; i++) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth()
      const d = String(cursor.getDate()).padStart(2, '0')
      const mStr = String(m + 1).padStart(2, '0')
      const iso = `${y}-${mStr}-${d}`
      const entry = byDate[iso] ?? { travail: 0, personnel: 0 }
      cellList.push({ date: iso, ...entry, future: cursor > todayDate })

      // Track month boundaries (first cell of each new month)
      const col = Math.floor(i / 7)
      if (m !== lastMonth) {
        monthPositions.push({ label: MONTH_LABELS[m], col })
        lastMonth = m
      }

      cursor.setDate(cursor.getDate() + 1)
    }
    return { cells: cellList, months: monthPositions }
  }, [todos, archive, customCategories, categoryFilter, days])

  const color = (cell: typeof cells[number]): string => {
    if (cell.future) return 'bg-zinc-900/30'
    const val = mode === 'travail' ? cell.travail : mode === 'personnel' ? cell.personnel : cell.travail + cell.personnel
    if (val === 0) return 'bg-zinc-800/60'
    if (val >= 4) return 'bg-amber-500'
    const isViolet = mode === 'travail' || (mode === 'combined' && cell.travail >= cell.personnel)
    if (val < 0.5) return isViolet ? 'bg-violet-500/15' : 'bg-cyan-500/15'
    if (val < 1)   return isViolet ? 'bg-violet-500/25' : 'bg-cyan-500/25'
    if (val < 2)   return isViolet ? 'bg-violet-500/40' : 'bg-cyan-500/40'
    if (val < 3)   return isViolet ? 'bg-violet-500/60' : 'bg-cyan-500/60'
    return isViolet ? 'bg-violet-500/80' : 'bg-cyan-500/80'
  }

  const totalCols = Math.ceil(cells.length / 7)

  return (
    <div className="overflow-x-auto scrollbar-thin pb-1">
      <div className="min-w-fit">
        {/* Month labels */}
        <div className="flex mb-1" style={{ paddingLeft: 22 }}>
          {months.map((m, i) => {
            const nextCol = i + 1 < months.length ? months[i + 1].col : totalCols
            const span = nextCol - m.col
            return (
              <span key={`${m.label}-${m.col}`}
                className="text-[9px] text-zinc-500 font-medium"
                style={{ width: span * 15, flexShrink: 0 }}>
                {m.label}
              </span>
            )
          })}
        </div>

        {/* Grid with day labels */}
        <div className="flex">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[3px] mr-1 shrink-0" style={{ width: 18 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-3 flex items-center justify-end">
                <span className="text-[8px] text-zinc-600 leading-none">{label}</span>
              </div>
            ))}
          </div>

          {/* Heatmap cells */}
          <div className="inline-grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column' }}>
            {cells.map((cell, i) => (
              <div key={i} className={cn('w-3 h-3 rounded-[3px] transition-all hover:scale-150 hover:z-10', color(cell))}
                title={`${cell.date.split('-').reverse().join('/')} | T: ${cell.travail.toFixed(1)}h | P: ${cell.personnel.toFixed(1)}h`} />
            ))}
          </div>
        </div>

        {/* Legend */}
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
    </div>
  )
}
