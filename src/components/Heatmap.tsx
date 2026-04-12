import { useMemo } from 'react'
import type { Todo, ArchiveMonth, CategoryConfig } from '@/types'
import { todayISO, addDays, cn, categoryGroup } from '@/lib/utils'

interface HeatmapProps {
  todos: Todo[]
  archive?: ArchiveMonth[]
  customCategories?: CategoryConfig[]
  categoryFilter?: string[]
  colorHex?: string
  days?: number
  mode: 'travail' | 'personnel' | 'combined'
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const DAY_LABELS = ['', 'L', '', 'M', '', 'V', '']

export const Heatmap = ({ todos, archive, customCategories, categoryFilter, colorHex = '#8b5cf6', days = 182, mode }: HeatmapProps) => {
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

  // Returns inline style with opacity-based coloring using colorHex
  const cellStyle = (cell: typeof cells[number]): React.CSSProperties => {
    if (cell.future) return { backgroundColor: '#18181b30' }
    const val = cell.travail + cell.personnel
    if (val === 0) return { backgroundColor: '#27272a60' }
    if (val >= 4) return { backgroundColor: '#f59e0b' } // amber for high
    const opacity = val < 0.5 ? 0.2 : val < 1 ? 0.35 : val < 2 ? 0.5 : val < 3 ? 0.7 : 0.9
    return { backgroundColor: colorHex, opacity }
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
              <div key={i} className="w-3 h-3 rounded-[3px] transition-all hover:scale-150 hover:z-10"
                style={cellStyle(cell)}
                title={`${cell.date.split('-').reverse().join('/')} | ${(cell.travail + cell.personnel).toFixed(1)}h`} />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 justify-end">
          <span className="text-[9px] text-zinc-500">Moins</span>
          <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: '#27272a60' }} />
          <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: colorHex, opacity: 0.2 }} />
          <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: colorHex, opacity: 0.4 }} />
          <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: colorHex, opacity: 0.65 }} />
          <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: colorHex, opacity: 0.9 }} />
          <div className="w-3 h-3 rounded-[2px] bg-amber-500" />
          <span className="text-[9px] text-zinc-500">Plus</span>
        </div>
      </div>
    </div>
  )
}
