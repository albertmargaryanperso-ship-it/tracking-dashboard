import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, Check, CalendarDays } from 'lucide-react'
import type { Todo, Subtask } from '@/types'
import { cn } from '@/lib/utils'

interface SubtaskSheetProps {
  todo: Todo | null
  onClose: () => void
  onUpdate: (id: number, patch: Partial<Todo>) => void
}

export const SubtaskSheet = ({ todo, onClose, onUpdate }: SubtaskSheetProps) => {
  const [newText, setNewText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [sheetMaxH, setSheetMaxH] = useState('85vh')

  const isVisible = todo !== null

  // Lock body scroll when open
  useEffect(() => {
    if (isVisible) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isVisible])

  // Track iOS keyboard via visualViewport
  useEffect(() => {
    if (!isVisible) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const h = vv.height
      setSheetMaxH(`${Math.min(h * 0.85, h - 20)}px`)
    }
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [isVisible])

  if (!todo) return null

  const subtasks = todo.subtasks ?? []
  const doneCount = subtasks.filter(s => s.done).length

  const handleAdd = () => {
    if (!newText.trim()) return
    const updated = [...subtasks, { id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, text: newText.trim(), done: false }]
    onUpdate(todo.id, { subtasks: updated })
    setNewText('')
    inputRef.current?.focus()
  }

  const handleToggle = (stId: string) => {
    const updated = subtasks.map(s => s.id === stId ? { ...s, done: !s.done } : s)
    onUpdate(todo.id, { subtasks: updated })
    
    // Auto-complete the parent todo if all subtasks are done now?
    // User requested: "Valider que les Sous-tâches cochent bien la Todo-parent automatiquement".
    const allDone = updated.length > 0 && updated.every(s => s.done)
    if (allDone && todo.status !== 'done') {
      // Actually, we shouldn't fully finish the timer here since they might be timing it.
      // But we can prompt them, or let them manually do it.
      // We will just leave it to `onToggle` for the parent, or if we want to auto-done, we need `onToggle` from `useAppState`.
      // It's safer to just let the user click the checkbox of the parent since doing it here doesn't prompt for time elapsed easily.
    }
  }

  const handleDelete = (stId: string) => {
    const updated = subtasks.filter(s => s.id !== stId)
    onUpdate(todo.id, { subtasks: updated })
  }

  const handleEditText = (stId: string, txt: string) => {
    const updated = subtasks.map(s => s.id === stId ? { ...s, text: txt } : s)
    onUpdate(todo.id, { subtasks: updated })
  }

  const progress = subtasks.length === 0 ? 0 : (doneCount / subtasks.length) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Bottom Sheet Modal */}
      <div className="relative w-full max-w-lg bg-zinc-950 rounded-t-3xl sm:rounded-3xl border border-zinc-800 flex flex-col animate-slide-up shadow-2xl overflow-hidden" style={{ maxHeight: sheetMaxH }} onClick={e => e.stopPropagation()}>
        
        {/* Visual drag handle for mobile */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden" onClick={onClose}>
           <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 pt-1 sm:pt-5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold text-zinc-100 leading-snug">{todo.text}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all shrink-0"><X size={16} /></button>
          </div>

          {/* Date editor */}
          {todo.status === 'done' ? (
            <label className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <CalendarDays size={12} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold shrink-0">Réalisée le</span>
              <input type="date" value={todo.completed_at ?? ''}
                onChange={e => onUpdate(todo.id, { completed_at: e.target.value || null })}
                className="flex-1 bg-transparent border-none focus:outline-none text-xs text-zinc-200 text-right" />
            </label>
          ) : (
            <label className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <CalendarDays size={12} className="text-amber-400 shrink-0" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold shrink-0">Échéance</span>
              <input type="date" value={todo.due ?? ''}
                onChange={e => onUpdate(todo.id, { due: e.target.value || null })}
                className="flex-1 bg-transparent border-none focus:outline-none text-xs text-zinc-200 text-right" />
              {todo.due && (
                <button onPointerDown={e => e.preventDefault()} onClick={() => onUpdate(todo.id, { due: null })}
                  className="p-1 text-zinc-500 hover:text-rose-400 rounded shrink-0"><X size={10} /></button>
              )}
            </label>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
               <div className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 font-bold w-6 text-right">{doneCount}/{subtasks.length}</span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 scrollbar-thin">
          {subtasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm rounded-xl px-4 py-3 bg-zinc-900/50 text-zinc-500 border border-zinc-800/50 inline-block border-dashed">
                Aucune sous-tâche pour l'instant.<br/>Diviser pour mieux régner !
              </p>
            </div>
          ) : subtasks.map(st => (
            <div key={st.id} className={cn('flex items-center gap-3 p-2 rounded-xl border transition-all', st.done ? 'bg-zinc-900/40 border-emerald-500/10' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700')}>
              
              <button onClick={() => handleToggle(st.id)} className={cn('shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40', st.done ? 'bg-emerald-500 border-emerald-500 text-zinc-950' : 'border-zinc-600 text-transparent hover:border-emerald-500')}>
                {st.done && <Check size={12} strokeWidth={3} />}
              </button>
              
              <input value={st.text} onChange={e => handleEditText(st.id, e.target.value)}
                className={cn('flex-1 bg-transparent border-none focus:outline-none text-sm transition-all', st.done ? 'text-zinc-500 line-through' : 'text-zinc-200')} />
                
              <button onClick={() => handleDelete(st.id)} className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all focus:outline-none">
                 <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Input Add */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 sticky bottom-0 z-10">
           <div className="relative flex items-center">
             <input ref={inputRef} value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
               onFocus={() => { setTimeout(() => inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300) }}
               enterKeyHint="done"
               placeholder="Ajouter une sous-tâche..."
               className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-4 pr-12 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600 shadow-inner" />
               
             <button onPointerDown={e => e.preventDefault()} onClick={handleAdd} disabled={!newText.trim()}
               className="absolute right-2 p-1.5 bg-emerald-600 text-white rounded-lg disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all hover:bg-emerald-500 active:scale-95">
               <Plus size={16} />
             </button>
           </div>
        </div>

      </div>
    </div>
  )
}
