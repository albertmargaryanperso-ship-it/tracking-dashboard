import { useState, useMemo } from 'react'
import { Plus, Check, Trash2, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import type { AppState, Stats, Todo, TodoCategory, TodoPriority, TodoStatus } from '@/types'
import { CATEGORY_CONFIG, CATEGORY_LIST, cn, formatMinutes } from '@/lib/utils'

interface TodosViewProps {
  state: AppState
  stats: Stats
  onAdd: (t: Omit<Todo, 'id' | 'created'>) => void
  onUpdate: (id: number, patch: Partial<Todo>) => void
  onToggle: (id: number, completed_min?: number | null) => void
  onDelete: (id: number) => void
}

// ─── Kanban column definitions ─────────────────────────────────────────────

type ColumnId = 'urgent' | 'todo' | 'delegated' | 'waiting'

interface ColumnDef {
  id: ColumnId
  label: string
  emoji: string
  borderColor: string
  dotColor: string
  match: (t: Todo) => boolean
  // When a todo is dropped into this column, what patch to apply
  toPatch: (t: Todo) => Partial<Todo>
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'urgent',
    label: 'URGENT',
    emoji: '🔴',
    borderColor: 'border-rose-500/40',
    dotColor: 'bg-rose-500',
    match: (t) => t.status === 'open' && t.priority === 'urgent',
    toPatch: () => ({ status: 'open', priority: 'urgent' }),
  },
  {
    id: 'todo',
    label: 'À FAIRE',
    emoji: '🟡',
    borderColor: 'border-amber-500/40',
    dotColor: 'bg-amber-400',
    match: (t) => t.status === 'open' && t.priority !== 'urgent',
    toPatch: (t) => ({ status: 'open', priority: t.priority === 'urgent' ? 'normal' : t.priority }),
  },
  {
    id: 'delegated',
    label: 'DÉLÉGUÉ',
    emoji: '👤',
    borderColor: 'border-violet-500/40',
    dotColor: 'bg-violet-500',
    match: (t) => t.status === 'delegated',
    toPatch: () => ({ status: 'delegated' }),
  },
  {
    id: 'waiting',
    label: 'EN ATTENTE',
    emoji: '⏳',
    borderColor: 'border-sky-500/40',
    dotColor: 'bg-sky-500',
    match: (t) => t.status === 'waiting',
    toPatch: () => ({ status: 'waiting' }),
  },
]

// ─── Main view ─────────────────────────────────────────────────────────────

export const TodosView = ({ state, stats, onAdd, onUpdate, onToggle, onDelete }: TodosViewProps) => {
  const [quickCol, setQuickCol] = useState<ColumnId | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null)

  const { byColumn, done } = useMemo(() => {
    const byCol: Record<ColumnId, Todo[]> = {
      urgent: [],
      todo: [],
      delegated: [],
      waiting: [],
    }
    const doneList: Todo[] = []
    for (const t of state.todos) {
      if (t.status === 'done') {
        doneList.push(t)
        continue
      }
      for (const col of COLUMNS) {
        if (col.match(t)) {
          byCol[col.id].push(t)
          break
        }
      }
    }
    // Sort open lists by priority then id desc
    for (const k of Object.keys(byCol) as ColumnId[]) {
      byCol[k].sort((a, b) => b.id - a.id)
    }
    // Done by completion date desc
    doneList.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return { byColumn: byCol, done: doneList }
  }, [state.todos])

  const handleDrop = (colId: ColumnId) => {
    if (dragId === null) return
    const todo = state.todos.find(t => t.id === dragId)
    if (!todo) return
    const col = COLUMNS.find(c => c.id === colId)!
    const patch = col.toPatch(todo)
    // No-op if dropping in same column
    if (col.match(todo)) {
      setDragId(null)
      setDragOverCol(null)
      return
    }
    onUpdate(todo.id, patch)
    setDragId(null)
    setDragOverCol(null)
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TodoStat label="Ouverts" value={stats.todos.open} sub={`${stats.todos.total} au total`} color="emerald" />
        <TodoStat label="Urgents" value={stats.todos.urgent} sub="à traiter" color="rose" />
        <TodoStat
          label="Aujourd'hui"
          value={formatMinutes(stats.todos.today_minutes) || '0min'}
          sub={`${stats.todos.done} terminés (${stats.todos.completion_rate}%)`}
          color="zinc"
        />
        <TodoStat
          label="Semaine"
          value={formatMinutes(stats.todos.week_minutes) || '0min'}
          sub="temps cumulé"
          color="blue"
        />
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const items = byColumn[col.id]
          const isOver = dragOverCol === col.id
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id) }}
              onDragLeave={() => setDragOverCol(prev => prev === col.id ? null : prev)}
              onDrop={() => handleDrop(col.id)}
              className={cn(
                'rounded-2xl border bg-zinc-900/40 p-3 flex flex-col gap-2 min-h-[240px] transition-all',
                col.borderColor,
                isOver && 'bg-zinc-900/70 ring-2 ring-emerald-500/40',
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', col.dotColor)} />
                  <span className="text-[11px] font-bold tracking-wider text-zinc-200">{col.label}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {items.length}
                  </span>
                </div>
                <button
                  onClick={() => setQuickCol(quickCol === col.id ? null : col.id)}
                  className="w-6 h-6 rounded-md border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-300 flex items-center justify-center transition-all"
                  title="Nouvelle tâche"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Quick add form (inline) */}
              {quickCol === col.id && (
                <QuickTodoForm
                  column={col.id}
                  onAdd={(t) => { onAdd(t); setQuickCol(null) }}
                  onCancel={() => setQuickCol(null)}
                />
              )}

              {/* Cards */}
              <div className="flex-1 flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-600 italic py-6">
                    {quickCol === col.id ? '' : 'Aucune tâche'}
                  </div>
                ) : (
                  items.map(t => (
                    <TodoCard
                      key={t.id}
                      todo={t}
                      dragging={dragId === t.id}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setDragOverCol(null) }}
                      onToggle={onToggle}
                      onDelete={onDelete}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Terminé section */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <button
          onClick={() => setDoneOpen(o => !o)}
          className="w-full flex items-center gap-2 text-left"
        >
          {doneOpen ? <ChevronDown size={14} className="text-emerald-400" /> : <ChevronRight size={14} className="text-emerald-400" />}
          <span className="text-sm">✅</span>
          <span className="text-[11px] font-bold tracking-wider text-emerald-300">TERMINÉ</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
            {done.length}
          </span>
          <span className="flex-1" />
          <span className="text-[10px] text-zinc-500">
            {stats.todos.completion_rate}% complétés
          </span>
        </button>

        {doneOpen && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-1.5">
            {done.length === 0 ? (
              <div className="col-span-full text-center text-[10px] text-zinc-600 italic py-4">
                Rien de terminé pour le moment.
              </div>
            ) : (
              done.map(t => (
                <TodoCard
                  key={t.id}
                  todo={t}
                  dragging={false}
                  onDragStart={() => {}}
                  onDragEnd={() => {}}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────

const TodoCard = ({
  todo,
  dragging,
  onDragStart,
  onDragEnd,
  onToggle,
  onDelete,
}: {
  todo: Todo
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onToggle: (id: number, completed_min?: number | null) => void
  onDelete: (id: number) => void
}) => {
  const cat = CATEGORY_CONFIG[todo.category] ?? CATEGORY_CONFIG.admin
  const isDone = todo.status === 'done'

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDone) {
      onToggle(todo.id)
      return
    }
    if (todo.duration_min && todo.duration_min > 0) {
      const raw = window.prompt(`Temps réel passé (en minutes) ?`, String(todo.duration_min))
      if (raw === null) return
      const parsed = parseInt(raw.trim(), 10)
      onToggle(todo.id, isNaN(parsed) ? todo.duration_min : Math.max(0, parsed))
    } else {
      onToggle(todo.id)
    }
  }

  return (
    <div
      draggable={!isDone}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative rounded-xl border bg-zinc-900/70 hover:bg-zinc-900 p-2.5 transition-all',
        isDone ? 'border-zinc-800/60 opacity-60' : 'border-zinc-800 hover:border-emerald-500/30 cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40 ring-2 ring-emerald-500/50',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={handleToggle}
          className={cn(
            'shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
            isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 hover:border-emerald-400'
          )}
        >
          {isDone && <Check size={9} strokeWidth={3.5} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[12px] leading-snug font-medium',
            isDone ? 'line-through text-zinc-500' : 'text-zinc-100'
          )}>
            {todo.text}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold border', cat.bg, cat.color)}>
              {cat.emoji} {cat.label}
            </span>
            {todo.status === 'delegated' && todo.delegated_to && (
              <span className="text-[9px] text-violet-300 font-semibold">
                → {todo.delegated_to}
              </span>
            )}
            {todo.duration_min ? (
              <span className="flex items-center gap-0.5 text-[9px] text-cyan-400">
                <Clock size={8} /> {formatMinutes(todo.duration_min)}
              </span>
            ) : null}
            {isDone && todo.completed_min ? (
              <span className="text-[9px] text-emerald-400">⏱ {formatMinutes(todo.completed_min)}</span>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => onDelete(todo.id)}
          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ─── Inline quick add ──────────────────────────────────────────────────────

const QuickTodoForm = ({
  column,
  onAdd,
  onCancel,
}: {
  column: ColumnId
  onAdd: (t: Omit<Todo, 'id' | 'created'>) => void
  onCancel: () => void
}) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>('pro')
  const [durationMin, setDurationMin] = useState('')
  const [delegatedTo, setDelegatedTo] = useState('')

  const statusFromCol = (): TodoStatus => {
    if (column === 'delegated') return 'delegated'
    if (column === 'waiting') return 'waiting'
    return 'open'
  }

  const priorityFromCol = (): TodoPriority => {
    if (column === 'urgent') return 'urgent'
    return 'normal'
  }

  const submit = () => {
    if (!text.trim()) return
    const dur = durationMin.trim() ? parseInt(durationMin.trim(), 10) : null
    onAdd({
      text: text.trim(),
      category,
      priority: priorityFromCol(),
      status: statusFromCol(),
      delegated_to: column === 'delegated' && delegatedTo.trim() ? delegatedTo.trim() : null,
      due: null,
      completed_at: null,
      duration_min: dur && !isNaN(dur) && dur > 0 ? dur : null,
      completed_min: null,
    })
    setText('')
    setDurationMin('')
    setDelegatedTo('')
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1.5">
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Texte de la tâche…"
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-emerald-500"
      />
      <div className="flex flex-wrap gap-1">
        {CATEGORY_LIST.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all',
              category === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500'
            )}
            title={CATEGORY_CONFIG[c].label}
          >
            {CATEGORY_CONFIG[c].emoji}
          </button>
        ))}
      </div>
      {column === 'delegated' && (
        <input
          value={delegatedTo}
          onChange={e => setDelegatedTo(e.target.value)}
          placeholder="Délégué à…"
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] focus:outline-none focus:border-violet-500"
        />
      )}
      <div className="flex items-center gap-1">
        <Clock size={10} className="text-zinc-500" />
        <input
          value={durationMin}
          onChange={e => setDurationMin(e.target.value)}
          placeholder="min"
          className="w-12 px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] text-center focus:outline-none focus:border-cyan-500"
        />
        <div className="flex-1" />
        <button onClick={submit} className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold">
          Ajouter
        </button>
        <button onClick={onCancel} className="px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 text-[10px]">
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Stat tile ─────────────────────────────────────────────────────────────

const TodoStat = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: 'emerald' | 'rose' | 'blue' | 'zinc' }) => {
  const colors = {
    emerald: 'border-emerald-500/20 text-emerald-300',
    rose: 'border-rose-500/20 text-rose-300',
    blue: 'border-blue-500/20 text-blue-300',
    zinc: 'border-zinc-800 text-zinc-300',
  }
  return (
    <div className={cn('rounded-xl border bg-zinc-900/50 p-3', colors[color])}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p className="text-xl font-extrabold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}
