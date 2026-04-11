import { useState } from 'react'
import { X, Plus, Clock, Activity, CheckSquare } from 'lucide-react'
import type { Todo, TodoCategory, TodoPriority } from '@/types'
import { todayISO, cn, CATEGORY_CONFIG, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES, parseHoursInput, formatHours, habitIcon } from '@/lib/utils'

type QuickMode = 'session' | 'routine' | 'todo'

interface QuickAddModalProps {
  open: boolean
  onClose: () => void
  habits: string[]
  onSetCategoryHours: (date: string, category: string, hours: number) => void
  onSetRoutineHours: (date: string, hours: number) => void
  onSetHabitHours: (date: string, habit: string, hours: number) => void
  onAddTodo: (t: Omit<Todo, 'id' | 'created'>) => void
  todayTravailHours: number
  todayRoutineHours: number
}

export const QuickAddModal = ({
  open, onClose, habits,
  onSetCategoryHours, onSetRoutineHours, onSetHabitHours, onAddTodo, todayTravailHours, todayRoutineHours,
}: QuickAddModalProps) => {
  const [mode, setMode] = useState<QuickMode>('session')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-100">Ajouter rapidement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
            <X size={14} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl mb-4">
          {([
            ['session', 'Travail', Clock, 'violet'],
            ['routine', 'Personnel', Activity, 'cyan'],
            ['todo', 'Tâche', CheckSquare, 'emerald'],
          ] as const).map(([id, label, Icon, color]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn(
                'flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all',
                mode === id
                  ? color === 'violet' ? 'bg-violet-500/15 text-violet-300' :
                    color === 'cyan' ? 'bg-cyan-500/15 text-cyan-300' :
                    'bg-emerald-500/15 text-emerald-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {mode === 'session' && (
          <TravailForm todayHours={todayTravailHours} onSetCategoryHours={onSetCategoryHours} onClose={onClose} />
        )}
        {mode === 'routine' && (
          <RoutineForm
            habits={habits}
            todayHours={todayRoutineHours}
            onSetRoutineHours={onSetRoutineHours}
            onSetHabitHours={onSetHabitHours}
            onClose={onClose}
          />
        )}
        {mode === 'todo' && <TodoForm onAdd={onAddTodo} onClose={onClose} />}
      </div>
    </div>
  )
}

// ─── Travail form (category-based) ──────────────────────────────────────────
const TravailForm = ({
  todayHours, onSetCategoryHours, onClose,
}: {
  todayHours: number
  onSetCategoryHours: (date: string, category: string, hours: number) => void
  onClose: () => void
}) => {
  const [category, setCategory] = useState<string>(TRAVAIL_CATEGORIES[0])
  const [hoursStr, setHoursStr] = useState('1h')
  const [date, setDate] = useState(todayISO())

  const submit = () => {
    const h = parseHoursInput(hoursStr)
    if (h === null || h < 0) return
    onSetCategoryHours(date, category, Math.round(h * 100) / 100)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-5xl font-extrabold bg-gradient-to-br from-violet-300 to-violet-100 bg-clip-text text-transparent font-mono">
          {formatHours(todayHours)}
        </p>
        <p className="text-[10px] text-zinc-500 mt-1">aujourd'hui</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Durée</label>
          <input value={hoursStr} onChange={e => setHoursStr(e.target.value)} placeholder="1h30 / 45min"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 font-mono text-center" />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Catégorie</label>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {TRAVAIL_CATEGORIES.map(c => {
            const cfg = CATEGORY_CONFIG[c]
            return (
              <button key={c} onClick={() => setCategory(c)}
                className={cn('px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all',
                  category === c ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700')}>
                <span className="text-base">{cfg.emoji}</span>
                <span className="truncate">{cfg.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-xs font-bold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Logger
      </button>
    </div>
  )
}

// ─── Routine form (replaces Blocs form) ──────────────────────────────────────
const RoutineForm = ({
  habits, todayHours, onSetRoutineHours, onSetHabitHours, onClose,
}: {
  habits: string[]
  todayHours: number
  onSetRoutineHours: (date: string, hours: number) => void
  onSetHabitHours: (date: string, habit: string, hours: number) => void
  onClose: () => void
}) => {
  const [habit, setHabit] = useState<string>(habits[0] ?? '')
  const [hoursStr, setHoursStr] = useState('1h')
  const [date, setDate] = useState(todayISO())

  const submit = () => {
    const h = parseHoursInput(hoursStr)
    if (h === null || h < 0) return
    const rounded = Math.round(h * 100) / 100
    if (habit) {
      onSetHabitHours(date, habit, rounded)
    } else {
      onSetRoutineHours(date, rounded)
    }
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-5xl font-extrabold bg-gradient-to-br from-cyan-300 to-cyan-100 bg-clip-text text-transparent font-mono">
          {formatHours(todayHours)}
        </p>
        <p className="text-[10px] text-zinc-500 mt-1">aujourd'hui</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Durée</label>
          <input
            value={hoursStr}
            onChange={e => setHoursStr(e.target.value)}
            placeholder="1h30 / 45min"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-cyan-500 font-mono text-center"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Habitude</label>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {habits.map(h => (
            <button
              key={h}
              onClick={() => setHabit(h)}
              className={cn(
                'px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all',
                habit === h ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
              )}
            >
              <span className="text-base">{habitIcon(h)}</span>
              <span className="truncate">{h}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-xs font-bold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Logger
      </button>
    </div>
  )
}

// ─── Todo form ───────────────────────────────────────────────────────────────
const TodoForm = ({ onAdd, onClose }: { onAdd: (t: Omit<Todo, 'id' | 'created'>) => void; onClose: () => void }) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>('pro')
  const [priority, setPriority] = useState<TodoPriority>('normal')
  const [durationMin, setDurationMin] = useState('')

  const submit = () => {
    if (!text.trim()) return
    const dur = durationMin.trim() ? parseInt(durationMin.trim(), 10) : null
    onAdd({
      text: text.trim(),
      category,
      priority,
      status: 'open',
      delegated_to: null,
      due: null,
      completed_at: null,
      duration_min: dur && !isNaN(dur) && dur > 0 ? dur : null,
      completed_min: null,
    })
    onClose()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Texte</label>
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Que faut-il faire ?"
          className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Catégorie</label>
        <p className="text-[9px] text-violet-400 font-semibold mt-1.5 mb-1">Travail</p>
        <div className="grid grid-cols-2 gap-1.5">
          {TRAVAIL_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1',
                category === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500'
              )}><span>{CATEGORY_CONFIG[c].emoji}</span> {CATEGORY_CONFIG[c].label}</button>
          ))}
        </div>
        <p className="text-[9px] text-cyan-400 font-semibold mt-2 mb-1">Personnel</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PERSONNEL_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1',
                category === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500'
              )}><span>{CATEGORY_CONFIG[c].emoji}</span> {CATEGORY_CONFIG[c].label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Priorité</label>
          <div className="flex gap-1.5 mt-1">
            {(['normal', 'urgent'] as TodoPriority[]).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all',
                  priority === p
                    ? p === 'urgent' ? 'border-rose-500 bg-rose-500/10 text-rose-300' : 'border-zinc-700 bg-zinc-800 text-zinc-200'
                    : 'border-zinc-800 text-zinc-500'
                )}
              >
                {p === 'urgent' ? '🔴 Urgent' : 'Normal'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Durée estimée</label>
          <input
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            placeholder="minutes"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-cyan-500 text-center font-mono"
          />
        </div>
      </div>
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Ajouter la tâche
      </button>
    </div>
  )
}
