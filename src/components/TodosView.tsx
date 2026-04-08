import { useState, useMemo } from 'react'
import { Plus, Check, Trash2, AlertCircle, Filter } from 'lucide-react'
import type { AppState, Stats, Todo, TodoCategory, TodoPriority } from '@/types'
import { CATEGORY_CONFIG, isoToFr, cn } from '@/lib/utils'

interface TodosViewProps {
  state: AppState
  stats: Stats
  onAdd: (t: Omit<Todo, 'id' | 'created'>) => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

type FilterCat = TodoCategory | 'all'
type FilterStatus = 'all' | 'open' | 'done' | 'urgent'

export const TodosView = ({ state, stats, onAdd, onToggle, onDelete }: TodosViewProps) => {
  const [cat, setCat] = useState<FilterCat>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('open')
  const [quickOpen, setQuickOpen] = useState(false)

  const filtered = useMemo(() => {
    return state.todos
      .filter(t => cat === 'all' || t.category === cat)
      .filter(t => {
        if (filterStatus === 'all') return true
        if (filterStatus === 'open') return t.status === 'open'
        if (filterStatus === 'done') return t.status === 'done'
        if (filterStatus === 'urgent') return t.status === 'open' && t.priority === 'urgent'
        return true
      })
      .sort((a, b) => {
        // Urgent first, then open, then recent created
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1
        if (a.priority !== 'urgent' && b.priority === 'urgent') return 1
        return b.id - a.id
      })
  }, [state.todos, cat, filterStatus])

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TodoStat label="Ouverts" value={stats.todos.open} sub={`${stats.todos.total} au total`} color="emerald" />
        <TodoStat label="Urgents" value={stats.todos.urgent} sub="à traiter" color="rose" />
        <TodoStat label="Terminés" value={stats.todos.done} sub={`${stats.todos.completion_rate}%`} color="zinc" />
        <TodoStat label="Pro" value={stats.todos.by_category.pro.open} sub={`${stats.todos.by_category.pro.total} au total`} color="blue" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-zinc-500" />
        {(['all', 'pro', 'finance', 'admin'] as FilterCat[]).map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
              cat === c
                ? c === 'all'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : CATEGORY_CONFIG[c as TodoCategory].bg + ' ' + CATEGORY_CONFIG[c as TodoCategory].color
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
            )}
          >
            {c === 'all' ? 'Tout' : CATEGORY_CONFIG[c as TodoCategory].label}
          </button>
        ))}
        <span className="w-px h-5 bg-zinc-800 mx-1" />
        {(['open', 'urgent', 'done', 'all'] as FilterStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
              filterStatus === s ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
            )}
          >
            {s === 'open' ? 'Ouverts' : s === 'urgent' ? '🔴 Urgents' : s === 'done' ? '✓ Terminés' : 'Tous'}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setQuickOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 text-[11px] font-semibold transition-all"
        >
          <Plus size={12} /> Nouvelle tâche
        </button>
      </div>

      {/* Quick add form */}
      {quickOpen && <QuickTodoForm onAdd={(t) => { onAdd(t); setQuickOpen(false) }} onCancel={() => setQuickOpen(false)} />}

      {/* Todos list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-xs text-zinc-500">
          Aucune tâche {filterStatus !== 'all' && `(${filterStatus})`}.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map(t => (
            <li key={t.id}>
              <TodoRow todo={t} onToggle={onToggle} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TodoStat = ({ label, value, sub, color }: { label: string; value: number; sub?: string; color: 'emerald' | 'rose' | 'blue' | 'zinc' }) => {
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

const TodoRow = ({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (id: number) => void; onDelete: (id: number) => void }) => {
  const cat = CATEGORY_CONFIG[todo.category]
  const isDone = todo.status === 'done'
  return (
    <div className={cn(
      'group flex items-center gap-3 p-3 rounded-xl border bg-zinc-900/50 hover:bg-zinc-900 transition-all',
      isDone ? 'border-zinc-800 opacity-60' : todo.priority === 'urgent' ? 'border-rose-500/30' : 'border-zinc-800 hover:border-emerald-500/30'
    )}>
      <button
        onClick={() => onToggle(todo.id)}
        className={cn(
          'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 hover:border-emerald-400'
        )}
      >
        {isDone && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium leading-snug', isDone ? 'line-through text-zinc-500' : 'text-zinc-200')}>
          {todo.text}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
          <span className={cn('px-1.5 py-0.5 rounded border', cat.bg, cat.color)}>
            {cat.emoji} {cat.label}
          </span>
          <span className="font-mono">{isoToFr(todo.created).slice(0, 5)}</span>
          {todo.priority === 'urgent' && !isDone && (
            <span className="flex items-center gap-0.5 text-rose-400 font-semibold">
              <AlertCircle size={9} /> URGENT
            </span>
          )}
          {todo.completed_at && (
            <span className="text-emerald-400">✓ {isoToFr(todo.completed_at).slice(0, 5)}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

const QuickTodoForm = ({ onAdd, onCancel }: { onAdd: (t: Omit<Todo, 'id' | 'created'>) => void; onCancel: () => void }) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>('pro')
  const [priority, setPriority] = useState<TodoPriority>('normal')

  const submit = () => {
    if (!text.trim()) return
    onAdd({
      text: text.trim(),
      category,
      priority,
      status: 'open',
      delegated_to: null,
      due: null,
      completed_at: null,
    })
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 animate-slide-in">
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Texte de la tâche (Enter pour valider)"
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['pro', 'finance', 'admin'] as TodoCategory[]).map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all',
                category === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500'
              )}
            >
              {CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['normal', 'urgent'] as TodoPriority[]).map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all',
                priority === p
                  ? p === 'urgent' ? 'border-rose-500 bg-rose-500/10 text-rose-300' : 'border-zinc-700 bg-zinc-800 text-zinc-200'
                  : 'border-zinc-800 text-zinc-500'
              )}
            >
              {p === 'urgent' ? '🔴 Urgent' : 'Normal'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={submit} className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold">Ajouter</button>
        <button onClick={onCancel} className="px-2 py-1 rounded-lg border border-zinc-800 text-zinc-500 text-[11px]">Annuler</button>
      </div>
    </div>
  )
}
