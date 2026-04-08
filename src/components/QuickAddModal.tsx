import { useState } from 'react'
import { X, Plus, Clock, Activity, CheckSquare } from 'lucide-react'
import type { VaultSession, Todo, TodoCategory, TodoPriority } from '@/types'
import { todayISO, cn, CATEGORY_CONFIG } from '@/lib/utils'

type QuickMode = 'session' | 'blocs' | 'todo'

interface QuickAddModalProps {
  open: boolean
  onClose: () => void
  projects: string[]
  onAddSession: (s: Omit<VaultSession, 'id'>) => void
  onSetBlocs: (date: string, blocs: number) => void
  onAddTodo: (t: Omit<Todo, 'id' | 'created'>) => void
  currentBlocs: number
}

export const QuickAddModal = ({
  open, onClose, projects, onAddSession, onSetBlocs, onAddTodo, currentBlocs,
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
            ['session', 'Session', Clock, 'violet'],
            ['blocs', 'Blocs', Activity, 'cyan'],
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

        {mode === 'session' && <SessionForm projects={projects} onAdd={onAddSession} onClose={onClose} />}
        {mode === 'blocs' && <BlocsForm currentBlocs={currentBlocs} onSetBlocs={onSetBlocs} onClose={onClose} />}
        {mode === 'todo' && <TodoForm onAdd={onAddTodo} onClose={onClose} />}
      </div>
    </div>
  )
}

// ─── Session form ────────────────────────────────────────────────────────────
const SessionForm = ({
  projects, onAdd, onClose,
}: {
  projects: string[]
  onAdd: (s: Omit<VaultSession, 'id'>) => void
  onClose: () => void
}) => {
  const [project, setProject] = useState(projects[0] ?? '')
  const [hours, setHours] = useState('1')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())

  const submit = () => {
    const h = parseFloat(hours.replace(',', '.'))
    if (!project.trim() || isNaN(h) || h <= 0) return
    onAdd({ project: project.trim(), hours: h, note: note.trim(), date })
    onClose()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Projet</label>
        <input
          list="quick-projects"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Ex: FTTH CCT 2026 - Partie 1"
          className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500"
        />
        <datalist id="quick-projects">
          {projects.map(p => <option key={p} value={p} />)}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Heures</label>
          <input
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="2.5"
            className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 text-center font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Note (optionnelle)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Ce que tu as fait…"
          className="w-full mt-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-xs font-bold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Ajouter la session
      </button>
    </div>
  )
}

// ─── Blocs form ──────────────────────────────────────────────────────────────
const BlocsForm = ({
  currentBlocs, onSetBlocs, onClose,
}: {
  currentBlocs: number
  onSetBlocs: (date: string, blocs: number) => void
  onClose: () => void
}) => {
  const [blocs, setBlocs] = useState(currentBlocs)
  const hours = blocs * 0.5

  const save = () => {
    onSetBlocs(todayISO(), blocs)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <p className="text-6xl font-extrabold bg-gradient-to-br from-cyan-300 to-cyan-100 bg-clip-text text-transparent font-mono">
          {blocs}
        </p>
        <p className="text-xs text-zinc-500 mt-1">{hours}h aujourd'hui</p>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {[0, 2, 4, 6, 8, 12].map(n => (
          <button
            key={n}
            onClick={() => setBlocs(n)}
            className={cn(
              'py-2.5 rounded-xl text-xs font-semibold border transition-all',
              blocs === n ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setBlocs(Math.max(0, blocs - 1))}
          className="py-2.5 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold"
        >
          − 30 min
        </button>
        <button
          onClick={() => setBlocs(blocs + 1)}
          className="py-2.5 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold"
        >
          + 30 min
        </button>
      </div>
      <button onClick={save} className="w-full py-3 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-xs font-bold">
        Enregistrer
      </button>
    </div>
  )
}

// ─── Todo form ───────────────────────────────────────────────────────────────
const TodoForm = ({ onAdd, onClose }: { onAdd: (t: Omit<Todo, 'id' | 'created'>) => void; onClose: () => void }) => {
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
        <div className="flex gap-1.5 mt-1">
          {(['pro', 'finance', 'admin'] as TodoCategory[]).map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all flex items-center justify-center gap-1',
                category === c ? CATEGORY_CONFIG[c].bg + ' ' + CATEGORY_CONFIG[c].color : 'border-zinc-800 text-zinc-500'
              )}
            >
              <span>{CATEGORY_CONFIG[c].emoji}</span> {CATEGORY_CONFIG[c].label}
            </button>
          ))}
        </div>
      </div>
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
      <button onClick={submit} className="w-full py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
        <Plus size={14} /> Ajouter la tâche
      </button>
    </div>
  )
}
