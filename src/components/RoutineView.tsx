import { useMemo, useState } from 'react'
import { Minus, Plus, X, CircleDashed, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppState, Stats, HabitStatus } from '@/types'
import { formatHours, isoToFr, habitIcon, intensityLabel, cn, todayISO, addDays, blocsToHours } from '@/lib/utils'

interface RoutineViewProps {
  state: AppState
  stats: Stats
  onToggleHabit: (date: string, habit: string) => void
  onSetBlocs: (date: string, blocs: number) => void
  onAddHabit: (name: string) => void
  onRemoveHabit: (name: string) => void
}

export const RoutineView = ({ state, stats, onToggleHabit, onSetBlocs, onAddHabit, onRemoveHabit }: RoutineViewProps) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [newHabit, setNewHabit] = useState('')

  const selected = state.routine.find(r => r.date === selectedDate)
  const blocs = selected?.blocs ?? 0
  const hours = blocsToHours(blocs)
  const intensity = intensityLabel(hours)

  const last7Days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6 - i))
      const entry = state.routine.find(r => r.date === d)
      return { date: d, blocs: entry?.blocs ?? 0, hours: blocsToHours(entry?.blocs ?? 0), habits: entry?.habitudes ?? {} }
    })
  }, [state.routine])

  const habits = state.meta.habitudes

  return (
    <div className="space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Aujourd'hui" value={formatHours(stats.routine.today_hours)} sub={stats.routine.today_intensity} />
        <StatTile label="Semaine" value={formatHours(stats.routine.week_hours)} />
        <StatTile label="Mois" value={formatHours(stats.routine.month_hours)} />
        <StatTile label="Streak" value={`${stats.routine.streak_days}j`} sub="consécutifs" />
      </div>

      {/* 7 days quick view */}
      <div className="rounded-2xl border border-cyan-500/20 bg-zinc-900/50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300 mb-3">7 derniers jours</p>
        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((d) => {
            const dObj = new Date(d.date + 'T12:00:00')
            const isSelected = d.date === selectedDate
            const isToday = d.date === todayISO()
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={cn(
                  'p-2 rounded-xl border text-center transition-all',
                  isSelected ? 'border-cyan-400 bg-cyan-500/15' :
                  isToday ? 'border-cyan-500/30 bg-cyan-500/5' :
                  'border-zinc-800 bg-zinc-900/50 hover:border-cyan-500/30'
                )}
              >
                <p className="text-[9px] text-zinc-500 uppercase font-semibold">
                  {dObj.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-300">{dObj.getDate()}</p>
                <p className={cn('text-[10px] font-mono mt-1', d.hours > 0 ? 'text-cyan-300' : 'text-zinc-600')}>
                  {d.hours > 0 ? formatHours(d.hours) : '—'}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day editor */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Édition</p>
            <p className="text-sm font-bold text-zinc-200 mt-0.5">{isoToFr(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setSelectedDate(todayISO())}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              disabled={selectedDate >= todayISO()}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Blocs de temps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Blocs de temps (30 min)</p>
            <p className={cn('text-xs font-semibold', intensity.className)}>{intensity.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSetBlocs(selectedDate, Math.max(0, blocs - 1))}
              className="p-2 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-4xl font-extrabold bg-gradient-to-br from-cyan-300 to-cyan-100 bg-clip-text text-transparent font-mono">
                {blocs}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{formatHours(hours)}</p>
            </div>
            <button
              onClick={() => onSetBlocs(selectedDate, blocs + 1)}
              className="p-2 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          {/* Quick bloc buttons */}
          <div className="grid grid-cols-6 gap-1.5 mt-3">
            {[0, 2, 4, 6, 8, 12].map(n => (
              <button
                key={n}
                onClick={() => onSetBlocs(selectedDate, n)}
                className={cn(
                  'py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                  blocs === n ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Habitudes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Habitudes</p>
            <div className="flex items-center gap-1.5">
              <input
                value={newHabit}
                onChange={e => setNewHabit(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newHabit.trim()) {
                    onAddHabit(newHabit.trim())
                    setNewHabit('')
                  }
                }}
                placeholder="+ nouvelle habitude"
                className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] w-32 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {habits.map(h => {
              const status: HabitStatus = selected?.habitudes?.[h] ?? '—'
              return (
                <div key={h} className="group relative">
                  <button
                    onClick={() => onToggleHabit(selectedDate, h)}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all',
                      status === 'Oui' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' :
                      status === 'Non' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' :
                      'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-cyan-500/30'
                    )}
                  >
                    <span className="text-base">{habitIcon(h)}</span>
                    <span className="flex-1 text-left truncate">{h}</span>
                    <span className="text-sm shrink-0">
                      {status === 'Oui' ? '✓' : status === 'Non' ? '✗' : <CircleDashed size={12} />}
                    </span>
                  </button>
                  <button
                    onClick={() => onRemoveHabit(h)}
                    className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                  >
                    <X size={9} />
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">Clic : ✗ → — → ✓</p>
        </div>
      </div>
    </div>
  )
}

const StatTile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-cyan-500/20 bg-zinc-900/50 p-3">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
    <p className="text-xl font-extrabold text-cyan-300 mt-0.5">{value}</p>
    {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
  </div>
)
