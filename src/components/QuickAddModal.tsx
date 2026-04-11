import { useState } from 'react'
import { X, Plus, Clock } from 'lucide-react'
import type { Todo, TodoCategory, TodoStatus } from '@/types'
import { cn, CATEGORY_CONFIG, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES } from '@/lib/utils'

interface QuickAddModalProps {
  open: boolean
  onClose: () => void
  onAddTodo: (t: Omit<Todo, 'id' | 'created'>) => void
  onAddDoneTodo: (t: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string }) => void
}

export const QuickAddModal = ({ open, onClose, onAddTodo, onAddDoneTodo }: QuickAddModalProps) => {
  const [mode, setMode] = useState<'todo' | 'done'>('todo')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-100">Ajouter</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"><X size={14} /></button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl mb-4">
          <button onClick={() => setMode('todo')}
            className={cn('flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all',
              mode === 'todo' ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300')}>
            <Plus size={12} /> À faire
          </button>
          <button onClick={() => setMode('done')}
            className={cn('flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all',
              mode === 'done' ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-500 hover:text-zinc-300')}>
            <Clock size={12} /> Déjà fait
          </button>
        </div>

        {mode === 'todo' && <TodoForm onAdd={onAddTodo} onClose={onClose} />}
        {mode === 'done' && <DoneForm onAdd={onAddDoneTodo} onClose={onClose} />}
      </div>
    </div>
  )
}

type StatusChoice = 'open' | 'urgent' | 'delegated' | 'waiting'
const STATUS_CHOICES: Array<{ id: StatusChoice; label: string; emoji: string; border: string; active: string }> = [
  { id: 'open', label: 'À faire', emoji: '🟡', border: 'border-amber-500', active: 'bg-amber-500/10 text-amber-300' },
  { id: 'urgent', label: 'Urgent', emoji: '🔴', border: 'border-rose-500', active: 'bg-rose-500/10 text-rose-300' },
  { id: 'delegated', label: 'Délégué', emoji: '👤', border: 'border-violet-500', active: 'bg-violet-500/10 text-violet-300' },
  { id: 'waiting', label: 'En attente', emoji: '⏳', border: 'border-sky-500', active: 'bg-sky-500/10 text-sky-300' },
]

const TodoForm = ({ onAdd, onClose }: { onAdd: (t: Omit<Todo, 'id' | 'created'>) => void; onClose: () => void }) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>('pro')
  const [statusChoice, setStatusChoice] = useState<StatusChoice>('open')
  const [durationMin, setDurationMin] = useState('')
  const [due, setDue] = useState('')
  const [delegatedTo, setDelegatedTo] = useState('')

  const submit = () => {
    if (!text.trim()) return
    const dur = durationMin.trim() ? parseInt(durationMin.trim(), 10) : null
    const status: TodoStatus = statusChoice === 'urgent' ? 'open' : statusChoice
    const priority = statusChoice === 'urgent' ? 'urgent' : 'normal'
    onAdd({
      text: text.trim(), category, priority, status,
      delegated_to: statusChoice === 'delegated' && delegatedTo.trim() ? delegatedTo.trim() : null,
      due: due || null, completed_at: null,
      duration_min: dur && !isNaN(dur) && dur > 0 ? dur : null, completed_min: null,
    })
    onClose()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Texte</label>
        <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Que faut-il faire ?"
          className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500" />
      </div>
      <CategoryPicker value={category} onChange={setCategory} />
      {/* Statut — 4 choix */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Statut</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {STATUS_CHOICES.map(s => (
            <button key={s.id} onClick={() => setStatusChoice(s.id)}
              className={cn('px-1 py-2 rounded-lg text-[9px] font-semibold border transition-all flex flex-col items-center justify-center gap-0.5',
                statusChoice === s.id ? `${s.border} ${s.active}` : 'border-zinc-800 text-zinc-500')}>
              <span className="text-sm">{s.emoji}</span>{s.label}
            </button>
          ))}
        </div>
      </div>
      {/* Délégué à */}
      {statusChoice === 'delegated' && (
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Délégué à</label>
          <input value={delegatedTo} onChange={e => setDelegatedTo(e.target.value)} placeholder="Nom de la personne…"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Échéance</label>
          <input type="date" value={due} onChange={e => setDue(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-rose-500" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Durée estimée</label>
          <input value={durationMin} onChange={e => setDurationMin(e.target.value)} placeholder="minutes"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-cyan-500 text-center font-mono" />
        </div>
      </div>
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Ajouter la tâche
      </button>
    </div>
  )
}

const DoneForm = ({ onAdd, onClose }: {
  onAdd: (t: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string }) => void
  onClose: () => void
}) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>('pro')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState('')

  const submit = () => {
    if (!text.trim() || !minutes.trim()) return
    const min = parseInt(minutes.trim(), 10)
    if (isNaN(min) || min <= 0) return
    onAdd({
      text: text.trim(), category, priority: 'normal', delegated_to: null, due: null,
      duration_min: min, completed_min: min,
      ...(date ? { completed_at: date } : {}),
    })
    onClose()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Qu'est-ce qui a été fait ?</label>
        <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Description de l'activité…"
          className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500" />
      </div>
      <CategoryPicker value={category} onChange={setCategory} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Temps passé (min)</label>
          <input value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="45"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 text-center font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Date (optionnel)</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500" />
        </div>
      </div>
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-xs font-bold flex items-center justify-center gap-1.5">
        <Clock size={14} /> Loguer l'activité
      </button>
    </div>
  )
}

const CategoryPicker = ({ value, onChange }: { value: TodoCategory; onChange: (c: TodoCategory) => void }) => (
  <div>
    <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Catégorie</label>
    <p className="text-[9px] text-violet-400 font-semibold mt-1.5 mb-1">Travail</p>
    <div className="grid grid-cols-2 gap-1.5">
      {TRAVAIL_CATEGORIES.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={cn('px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1',
            value === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500')}>
          <span>{CATEGORY_CONFIG[c].emoji}</span> {CATEGORY_CONFIG[c].label}
        </button>
      ))}
    </div>
    <p className="text-[9px] text-cyan-400 font-semibold mt-2 mb-1">Personnel</p>
    <div className="grid grid-cols-2 gap-1.5">
      {PERSONNEL_CATEGORIES.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={cn('px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1',
            value === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500')}>
          <span>{CATEGORY_CONFIG[c].emoji}</span> {CATEGORY_CONFIG[c].label}
        </button>
      ))}
    </div>
  </div>
)
