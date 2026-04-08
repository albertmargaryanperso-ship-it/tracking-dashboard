import { useMemo, useState } from 'react'
import { Minus, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppState, Stats } from '@/types'
import {
  formatHours,
  isoToFr,
  habitIcon,
  habitColor,
  intensityLabel,
  cn,
  todayISO,
  addDays,
  parseHoursInput,
} from '@/lib/utils'

interface RoutineViewProps {
  state: AppState
  stats: Stats
  onSetRoutineHours: (date: string, hours: number) => void
  onSetHabitHours: (date: string, habit: string, hours: number) => void
  onSetRoutineNotes: (date: string, notes: string) => void
  onAddHabit: (name: string) => void
  onRemoveHabit: (name: string) => void
}

const QUICK_HOURS = [0, 0.5, 1, 1.5, 2, 3, 4]

export const RoutineView = ({
  state,
  stats,
  onSetRoutineHours,
  onSetHabitHours,
  onSetRoutineNotes,
  onAddHabit,
  onRemoveHabit,
}: RoutineViewProps) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [newHabit, setNewHabit] = useState('')

  const selected = state.routine.find(r => r.date === selectedDate)
  const totalHours = selected?.hours ?? 0
  const intensity = intensityLabel(totalHours)

  const last7Days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6 - i))
      const entry = state.routine.find(r => r.date === d)
      return {
        date: d,
        hours: entry?.hours ?? 0,
      }
    })
  }, [state.routine])

  const habits = state.meta.habitudes

  const adjustTotal = (delta: number) => {
    const next = Math.max(0, Math.round((totalHours + delta) * 100) / 100)
    onSetRoutineHours(selectedDate, next)
  }

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

      {/* Quick add form */}
      <QuickRoutineAdd onSetHours={onSetRoutineHours} onSetHabitHours={onSetHabitHours} habits={habits} />

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

        {/* Total heures */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Total du jour</p>
            <p className={cn('text-xs font-semibold', intensity.className)}>{intensity.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustTotal(-0.5)}
              className="p-2 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-4xl font-extrabold bg-gradient-to-br from-cyan-300 to-cyan-100 bg-clip-text text-transparent font-mono">
                {formatHours(totalHours)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{totalHours.toFixed(2)}h décimales</p>
            </div>
            <button
              onClick={() => adjustTotal(0.5)}
              className="p-2 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          {/* Quick hours buttons */}
          <div className="grid grid-cols-7 gap-1.5 mt-3">
            {QUICK_HOURS.map(n => (
              <button
                key={n}
                onClick={() => onSetRoutineHours(selectedDate, n)}
                className={cn(
                  'py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                  totalHours === n ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {n === 0 ? '0' : `${n}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Habitudes — heures par habitude */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Habitudes (heures)</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {habits.map(h => {
              const value = selected?.habit_hours?.[h] ?? 0
              return (
                <HabitRow
                  key={h}
                  name={h}
                  value={value}
                  onChange={(v) => onSetHabitHours(selectedDate, h, v)}
                  onRemove={() => onRemoveHabit(h)}
                />
              )
            })}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">
            Astuce : entre une durée comme « 1h30 » ou « 45min ». Le total se met à jour automatiquement.
          </p>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 mb-2">Notes</p>
          <textarea
            value={selected?.notes ?? ''}
            onChange={e => onSetRoutineNotes(selectedDate, e.target.value)}
            rows={2}
            placeholder="Comment s'est passée la journée…"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-cyan-500 resize-none"
          />
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

// ─── Habit row with stepper + free input ───────────────────────────────────
const HabitRow = ({
  name,
  value,
  onChange,
  onRemove,
}: {
  name: string
  value: number
  onChange: (hours: number) => void
  onRemove: () => void
}) => {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? (value > 0 ? formatHours(value) : '')
  const color = habitColor(name)

  const commit = () => {
    if (draft === null) return
    if (draft.trim() === '') {
      onChange(0)
    } else {
      const parsed = parseHoursInput(draft)
      if (parsed !== null && parsed >= 0) onChange(Math.round(parsed * 100) / 100)
    }
    setDraft(null)
  }

  const step = (delta: number) => {
    const next = Math.max(0, Math.round((value + delta) * 100) / 100)
    onChange(next)
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
        value > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30',
      )}
      style={{
        borderColor: value > 0 ? color + '60' : '#27272a',
      }}
    >
      <span className="text-base shrink-0">{habitIcon(name)}</span>
      <span className="flex-1 text-xs font-medium text-zinc-200 truncate">{name}</span>
      <button
        onClick={() => step(-0.25)}
        className="w-6 h-6 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center"
      >
        <Minus size={11} />
      </button>
      <input
        value={display}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setDraft(value > 0 ? formatHours(value) : '')}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setDraft(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="—"
        className="w-16 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] text-center font-mono focus:outline-none focus:border-cyan-500"
        style={{ color: value > 0 ? color : undefined }}
      />
      <button
        onClick={() => step(0.25)}
        className="w-6 h-6 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center"
      >
        <Plus size={11} />
      </button>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
      >
        <X size={9} />
      </button>
    </div>
  )
}

// ─── Quick add: log routine entry for a chosen date inline ─────────────────
const QuickRoutineAdd = ({
  habits,
  onSetHours,
  onSetHabitHours,
}: {
  habits: string[]
  onSetHours: (date: string, hours: number) => void
  onSetHabitHours: (date: string, habit: string, hours: number) => void
}) => {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [habit, setHabit] = useState(habits[0] ?? '')
  const [hoursStr, setHoursStr] = useState('1h')

  const submit = () => {
    const parsed = parseHoursInput(hoursStr)
    if (parsed === null || parsed <= 0) return
    if (habit) {
      onSetHabitHours(date, habit, Math.round(parsed * 100) / 100)
    } else {
      onSetHours(date, Math.round(parsed * 100) / 100)
    }
    setHoursStr('1h')
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="flex items-center justify-end">
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-1"
        >
          <Plus size={11} /> Logger une activité routine
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full sm:w-36 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-cyan-500"
        />
        <select
          value={habit}
          onChange={e => setHabit(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-cyan-500"
        >
          {habits.map(h => (
            <option key={h} value={h}>{habitIcon(h)} {h}</option>
          ))}
        </select>
        <input
          value={hoursStr}
          onChange={e => setHoursStr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="1h30 / 45min / 1.5"
          className="w-full sm:w-32 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-cyan-500 font-mono text-center"
        />
        <div className="flex gap-1">
          <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[11px] font-semibold">OK</button>
          <button onClick={() => setOpen(false)} className="px-2 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 text-[11px]">×</button>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500">
        L'habitude sélectionnée passe à cette durée. Le total du jour est automatiquement réajusté.
      </p>
    </div>
  )
}
