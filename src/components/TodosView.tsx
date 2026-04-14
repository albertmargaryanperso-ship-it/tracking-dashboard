import { useState, useMemo } from 'react'
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion'
import { Plus, Check, Trash2, Clock, ChevronDown, ChevronRight, CalendarDays, Hourglass, Play, Square } from 'lucide-react'
import type { AppState, Stats, Todo, TodoCategory, TodoPriority, TodoStatus, CategoryConfig } from '@/types'
import { cn, formatMinutes, todayISO, isoToFr, getActiveCategories } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useActiveTimer } from '@/hooks/useActiveTimer'
import { SubtaskSheet } from './SubtaskSheet'

interface TodosViewProps {
  state: AppState
  stats: Stats
  onAdd: (t: Omit<Todo, 'id' | 'created'>) => void
  onAddDone: (t: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string }) => void
  onUpdate: (id: number, patch: Partial<Todo>) => void
  onToggle: (id: number, completed_min?: number | null) => void
  onDelete: (id: number) => void
  onSwapOrder: (id1: number, id2: number) => void
  categoryFilter?: TodoCategory[]
}

type ColumnId = 'urgent' | 'todo' | 'delegated' | 'waiting'

interface ColumnDef {
  id: ColumnId; label: string; emoji: string; borderColor: string; dotColor: string
  match: (t: Todo) => boolean
  toPatch: (t: Todo) => Partial<Todo>
}

const COLUMNS: ColumnDef[] = [
  { id: 'urgent', label: 'URGENT', emoji: '🔴', borderColor: 'border-rose-500/40', dotColor: 'bg-rose-500',
    match: (t) => t.status === 'open' && t.priority === 'urgent', toPatch: () => ({ status: 'open', priority: 'urgent' }) },
  { id: 'todo', label: 'À FAIRE', emoji: '🟡', borderColor: 'border-amber-500/40', dotColor: 'bg-amber-400',
    match: (t) => t.status === 'open' && t.priority !== 'urgent', toPatch: (t) => ({ status: 'open', priority: t.priority === 'urgent' ? 'normal' : t.priority }) },
  { id: 'delegated', label: 'DÉLÉGUÉ', emoji: '👤', borderColor: 'border-violet-500/40', dotColor: 'bg-violet-500',
    match: (t) => t.status === 'delegated', toPatch: () => ({ status: 'delegated' }) },
  { id: 'waiting', label: 'EN ATTENTE', emoji: '⏳', borderColor: 'border-sky-500/40', dotColor: 'bg-sky-500',
    match: (t) => t.status === 'waiting', toPatch: () => ({ status: 'waiting' }) },
]

export const TodosView = ({ state, stats, onAdd, onAddDone, onUpdate, onToggle, onDelete, onSwapOrder, categoryFilter }: TodosViewProps) => {
  const isMobile = useIsMobile()
  const [quickCol, setQuickCol] = useState<ColumnId | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const [logMode, setLogMode] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [subtasksTodoId, setSubtasksTodoId] = useState<number | null>(null)
  
  const { CATEGORY_CONFIG, CATEGORY_LIST, TRAVAIL_CATEGORIES } = getActiveCategories(state.meta.custom_categories)
  const availableCategories = categoryFilter ?? CATEGORY_LIST
  
  const { activeTodoId, elapsedMinutes, startTimer, stopTimer } = useActiveTimer()

  const filteredTodos = useMemo(() =>
    categoryFilter ? state.todos.filter(t => categoryFilter.includes(t.category)) : state.todos,
    [state.todos, categoryFilter]
  )

  const { byColumn, done } = useMemo(() => {
    const byCol: Record<ColumnId, Todo[]> = { urgent: [], todo: [], delegated: [], waiting: [] }
    const doneList: Todo[] = []
    for (const t of filteredTodos) {
      if (t.status === 'done') { doneList.push(t); continue }
      for (const col of COLUMNS) { if (col.match(t)) { byCol[col.id].push(t); break } }
    }
    for (const k of Object.keys(byCol) as ColumnId[]) {
      byCol[k].sort((a, b) => (b.orderIndex ?? b.id) - (a.orderIndex ?? a.id))
    }
    doneList.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return { byColumn: byCol, done: doneList }
  }, [filteredTodos])

  // Filtered stats
  const filteredStats = useMemo(() => {
    const cats = categoryFilter ?? CATEGORY_LIST
    let openCount = 0, urgentCount = 0, totalMin = 0
    for (const c of cats) {
      const b = stats.tracking.by_category[c]
      if (b) { openCount += b.open; totalMin += b.minutes }
    }
    urgentCount = filteredTodos.filter(t => t.status === 'open' && t.priority === 'urgent').length
    const remainingMin = filteredTodos.filter(t => t.status !== 'done').reduce((s, t) => s + (t.duration_min ?? 0), 0)
    return { open: openCount, urgent: urgentCount, minutes: totalMin, done: done.length, remainingMin }
  }, [stats, categoryFilter, filteredTodos, done])

  const handleDrop = (colId: ColumnId) => {
    if (dragId === null) return
    const todo = filteredTodos.find(t => t.id === dragId)
    if (!todo) return
    const col = COLUMNS.find(c => c.id === colId)!
    if (!col.match(todo)) {
       onUpdate(todo.id, col.toPatch(todo))
    }
    setDragId(null); setDragOverCol(null); setDragOverId(null)
  }

  // ── Global subtask progress ─────────────────────────────────────────────
  const subtaskProgress = useMemo(() => {
    const openTodos = filteredTodos.filter(t => t.status !== 'done')
    let total = 0, doneCount = 0
    for (const t of openTodos) {
      const subs = t.subtasks ?? []
      total += subs.length
      doneCount += subs.filter(s => s.done).length
    }
    return { total, done: doneCount, pct: total > 0 ? Math.round((doneCount / total) * 100) : 0 }
  }, [filteredTodos])

  return (
    <div className="space-y-5">
      {/* Fixed panel: stats + subtask progress + nav buttons */}
      <div className="fixed left-0 right-0 z-10 px-3 sm:px-6 pt-1 pb-2 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/50 space-y-1.5"
        style={{ top: isMobile ? 'env(safe-area-inset-top, 0px)' : '60px' }}>
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5">
            <div>
              <p className="text-[9px] text-zinc-500 font-semibold uppercase">Restant</p>
              <p className="text-sm font-extrabold text-rose-300">{formatMinutes(filteredStats.remainingMin) || '0'}</p>
            </div>
            <Hourglass size={12} className="text-rose-400" />
          </div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <div>
              <p className="text-[9px] text-zinc-500 font-semibold uppercase">Cumulé</p>
              <p className="text-sm font-extrabold text-blue-300">{formatMinutes(filteredStats.minutes) || '0'}</p>
            </div>
            <Clock size={12} className="text-blue-400" />
          </div>
        </div>
        {/* Subtask progress */}
        {subtaskProgress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className={cn('h-full rounded-full', subtaskProgress.pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-cyan-500')}
                style={{ width: `${subtaskProgress.pct}%` }} />
            </div>
            <span className="text-[9px] font-bold text-zinc-400">{subtaskProgress.pct}%</span>
          </div>
        )}
        {/* Nav buttons (Chips) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x pb-2 pt-1 -mx-2 px-2">
          <button onClick={() => document.getElementById('kanban-board')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex-shrink-0 snap-start flex items-center gap-2 rounded-full border border-emerald-500/40 bg-zinc-900/80 px-4 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all hover:bg-emerald-500/10">
            <span className="text-[13px] font-black text-emerald-400">{filteredStats.open}</span>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">Ouverts</span>
          </button>
          {([
            { id: 'col-todo', label: 'À faire', count: byColumn.todo.length, border: 'border-amber-500/40', text: 'text-amber-400' },
            { id: 'col-delegated', label: 'Délégué', count: byColumn.delegated.length, border: 'border-violet-500/40', text: 'text-violet-400' },
            { id: 'col-waiting', label: 'Attente', count: byColumn.waiting.length, border: 'border-sky-500/40', text: 'text-sky-400' },
          ] as const).map(btn => (
            <button key={btn.id} onClick={() => document.getElementById(btn.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={cn('flex-shrink-0 snap-start flex items-center gap-2 rounded-full border bg-zinc-900/80 px-4 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all hover:bg-white/5', btn.border)}>
              <span className={cn('text-[13px] font-black', btn.text)}>{btn.count}</span>
              <span className={cn('text-[10px] font-bold uppercase tracking-widest text-zinc-300')}>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Spacer for fixed panel */}
      <div className="h-32" />

      {/* Log done todo button */}
      <div className="flex justify-end">
        <button onClick={() => setLogMode(!logMode)}
          className={cn('text-[10px] px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all',
            logMode ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300')}>
          <Clock size={11} /> Loguer une activité faite
        </button>
      </div>
      {logMode && <LogDoneForm categories={availableCategories} config={CATEGORY_CONFIG} onAdd={(t) => { onAddDone(t); setLogMode(false) }} onCancel={() => setLogMode(false)} />}

      {/* Kanban board */}
      <div id="kanban-board" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const items = byColumn[col.id]; const isOver = dragOverCol === col.id
          return (
            <div key={col.id} id={`col-${col.id}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id) }}
              onDragLeave={() => setDragOverCol(prev => prev === col.id ? null : prev)}
              onDrop={() => handleDrop(col.id)}
              className={cn('rounded-2xl border bg-zinc-900/40 p-3 flex flex-col gap-2 min-h-[240px] transition-all',
                col.borderColor, isOver && 'bg-zinc-900/70 ring-2 ring-emerald-500/40')}>
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', col.dotColor)} />
                  <span className="text-[11px] font-bold tracking-wider text-zinc-200">{col.label}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{items.length}</span>
                </div>
                <button onClick={() => setQuickCol(quickCol === col.id ? null : col.id)}
                  className="w-6 h-6 rounded-md border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-300 flex items-center justify-center transition-all">
                  <Plus size={12} />
                </button>
              </div>
              {quickCol === col.id && <QuickTodoForm column={col.id} categories={availableCategories} config={CATEGORY_CONFIG} onAdd={(t) => { onAdd(t); setQuickCol(null) }} onCancel={() => setQuickCol(null)} />}
              <div className="flex-1 flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-600 italic py-6">{quickCol === col.id ? '' : 'Aucune tâche'}</div>
                ) : items.map(t => (
                  <TodoCard key={t.id} todo={t} dragging={dragId === t.id}
                    isActive={activeTodoId === t.id}
                    elapsedMinutes={activeTodoId === t.id ? elapsedMinutes : 0}
                    isDragOver={dragOverId === t.id}
                    config={CATEGORY_CONFIG}
                    onStartTimer={() => {
                      if (activeTodoId !== null && activeTodoId !== t.id) {
                        const prevTodo = state.todos.find(td => td.id === activeTodoId)
                        if (!window.confirm(`Timer actif sur "${prevTodo?.text ?? '?'}". L'arrêter pour démarrer celui-ci ?`)) return
                        const elapsed = stopTimer()
                        const raw = window.prompt(`Temps écoulé pour "${prevTodo?.text ?? '?'}" : ${elapsed} min. Valider ?`, String(elapsed))
                        if (raw !== null) {
                          const parsed = parseInt(raw.trim(), 10)
                          onToggle(activeTodoId, isNaN(parsed) ? elapsed : Math.max(0, parsed))
                        }
                      }
                      startTimer(t.id)
                    }}
                    onStopTimer={() => {
                      const min = stopTimer()
                      const raw = window.prompt(`Temps écoulé pour "${t.text}" : ${min} min. Ajuster si besoin ?`, String(min))
                      if (raw !== null) {
                        const parsed = parseInt(raw.trim(), 10)
                        const finalMin = isNaN(parsed) ? min : Math.max(0, parsed)
                        onToggle(t.id, finalMin)
                      }
                    }}
                    onDragStart={() => setDragId(t.id)} 
                    onDragEnd={() => { setDragId(null); setDragOverCol(null); setDragOverId(null) }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(t.id) }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      if (dragId && dragId !== t.id) {
                        // Move to destination column if it differs
                        const dragged = state.todos.find(td => td.id === dragId)
                        if (dragged) {
                          const colDragged = COLUMNS.find(c => c.match(dragged))
                          const colTarget = COLUMNS.find(c => c.match(t))
                          if (colDragged && colTarget && colDragged !== colTarget) {
                            onUpdate(dragId, colTarget.toPatch(dragged))
                          }
                        }
                        onSwapOrder(dragId, t.id)
                      }
                      setDragId(null); setDragOverId(null); setDragOverCol(null)
                    }}
                    onToggle={onToggle} onDelete={onDelete} onEditSubtasks={() => setSubtasksTodoId(t.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Done section */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <button onClick={() => setDoneOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
          {doneOpen ? <ChevronDown size={14} className="text-emerald-400" /> : <ChevronRight size={14} className="text-emerald-400" />}
          <span className="text-sm">✅</span>
          <span className="text-[11px] font-bold tracking-wider text-emerald-300">TERMINÉ</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{done.length}</span>
          <span className="flex-1" />
          <span className="text-[10px] text-zinc-500">{formatMinutes(filteredStats.minutes) || '0min'} cumulés</span>
        </button>
        {doneOpen && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-1.5">
            {done.length === 0 ? (
              <div className="col-span-full text-center text-[10px] text-zinc-600 italic py-4">Rien de terminé pour le moment.</div>
            ) : done.map(t => <TodoCard key={t.id} todo={t} dragging={false} isActive={false} elapsedMinutes={0} config={CATEGORY_CONFIG} onStartTimer={() => {}} onStopTimer={() => {}} onDragStart={() => {}} onDragEnd={() => {}} onToggle={onToggle} onDelete={onDelete} onEditSubtasks={() => setSubtasksTodoId(t.id)} />)}
          </div>
        )}
      </div>
      
      <SubtaskSheet 
        todo={subtasksTodoId ? state.todos.find(t => t.id === subtasksTodoId) ?? null : null} 
        onClose={() => setSubtasksTodoId(null)} 
        onUpdate={onUpdate} 
      />
    </div>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────
const TodoCard = ({ todo, dragging, isDragOver, isActive, elapsedMinutes, config, onStartTimer, onStopTimer, onDragStart, onDragEnd, onDragOver, onDrop, onToggle, onDelete, onEditSubtasks }: {
  todo: Todo; dragging: boolean; isDragOver?: boolean; isActive: boolean; elapsedMinutes: number; config: Record<string, CategoryConfig>;
  onStartTimer: () => void; onStopTimer: () => void;
  onDragStart: () => void; onDragEnd: () => void;
  onDragOver?: React.DragEventHandler; onDrop?: React.DragEventHandler;
  onToggle: (id: number, completed_min?: number | null) => void; onDelete: (id: number) => void; onEditSubtasks: () => void
}) => {
  const isMobile = useIsMobile()
  const cat = config[todo.category] ?? config.admin
  const isDone = todo.status === 'done'
  const subtasks = todo.subtasks ?? []
  const subtasksDoneCount = subtasks.filter(s => s.done).length

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDone) { onToggle(todo.id); return }
    if (todo.duration_min && todo.duration_min > 0) {
      const raw = window.prompt(`Temps réel passé (en minutes) ?`, String(todo.duration_min))
      if (raw === null) return
      const parsed = parseInt(raw.trim(), 10)
      onToggle(todo.id, isNaN(parsed) ? todo.duration_min : Math.max(0, parsed))
    } else {
      onToggle(todo.id)
    }
  }

  const x = useMotionValue(0)
  const controls = useAnimation()
  
  const bgOpacityDelete = useTransform(x, [-80, -30, 0], [1, 0.3, 0])
  const bgOpacityToggle = useTransform(x, [0, 30, 80], [0, 0.3, 1])

  const handleDragEnd = (_e: any, info: any) => {
    const offset = info.offset.x
    const velocity = info.velocity.x
    
    if (offset < -100 || velocity < -800) {
      controls.start({ x: -500, transition: { duration: 0.2 } }).then(() => {
        onDelete(todo.id)
        controls.set({ x: 0 })
      })
    } else if (offset > 100 || velocity > 800) {
      controls.start({ x: 500, transition: { duration: 0.2 } }).then(() => {
        onToggle(todo.id)
        controls.set({ x: 0 })
      })
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } })
    }
  }

  return (
    <div className={cn("relative group rounded-xl overflow-hidden", isDragOver && 'ring-2 ring-emerald-500/80 bg-zinc-800/50')}>
      {/* Background for Gestures */}
      <div className="absolute inset-0 flex items-center justify-between px-5 bg-zinc-900 rounded-xl">
        <motion.div className="flex items-center gap-2 text-emerald-400 font-bold tracking-widest text-xs uppercase" style={{ opacity: bgOpacityToggle }}>
          <Check size={20} strokeWidth={3} />
          <span>{isDone ? 'Ouvrir' : 'Terminer'}</span>
        </motion.div>
        <motion.div className="flex items-center gap-2 text-rose-400 font-bold tracking-widest text-xs uppercase" style={{ opacity: bgOpacityDelete }}>
          <span>Suppr.</span>
          <Trash2 size={20} strokeWidth={2.5} />
        </motion.div>
      </div>

      <motion.div 
        drag={isMobile ? "x" : false} // On mobile only, to prevent collision with kanban desktop drag
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        draggable={!isMobile && !isDone} 
        onDragStart={(e: any) => { 
          if (!isMobile && e?.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; onDragStart() }
        }} 
        onDragOver={onDragOver} onDrop={onDrop}
        className={cn('relative rounded-xl border bg-zinc-900 hover:bg-zinc-800 p-3.5 transition-colors shadow-sm',
          isDone ? 'border-zinc-800/60 opacity-60' : 'border-zinc-800 hover:border-emerald-500/30 cursor-grab active:cursor-grabbing',
          dragging && 'opacity-40 ring-2 ring-emerald-500/50',
          isActive && 'border-cyan-500/50 bg-[linear-gradient(to_bottom_right,#08334440,#00000080)] shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30')}
      >
      <div className="flex items-start gap-3">
        <button onClick={handleToggle} className={cn('shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 hover:border-emerald-400',
          isMobile && "w-7 h-7")}>
          {isDone && <Check size={isMobile ? 12 : 9} strokeWidth={3.5} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm leading-snug font-medium', isDone ? 'line-through text-zinc-500' : (isActive ? 'text-cyan-300' : 'text-zinc-100'))}>{todo.text}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold border', cat.bg, cat.color)}>{cat.emoji} {cat.label}</span>
            {todo.status === 'delegated' && todo.delegated_to && <span className="text-[9px] text-violet-300 font-semibold">→ {todo.delegated_to}</span>}
            {todo.due && !isDone && (
              <span className={cn('flex items-center gap-0.5 text-[9px] font-semibold',
                todo.due < todayISO() ? 'text-rose-400' : todo.due === todayISO() ? 'text-amber-400' : 'text-zinc-500')}>
                <CalendarDays size={8} /> {isoToFr(todo.due)}{todo.due <= todayISO() ? ' !' : ''}
              </span>
            )}
            
            <button onClick={(e) => { e.stopPropagation(); onEditSubtasks(); }} 
              className={cn('flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all', subtasks.length > 0 ? (subtasksDoneCount === subtasks.length ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20') : 'text-zinc-500 bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700')}>
              <Check size={8} className={subtasks.length > 0 && subtasksDoneCount === subtasks.length ? 'text-emerald-400' : ''} /> 
              {subtasks.length > 0 ? `${subtasksDoneCount}/${subtasks.length}` : 'Sous-tâches'}
            </button>

            {todo.duration_min ? <span className="flex items-center gap-0.5 text-[9px] text-cyan-400"><Clock size={8} /> {formatMinutes(todo.duration_min)}</span> : null}
            {isDone && todo.completed_min ? <span className="text-[9px] text-emerald-400">⏱ {formatMinutes(todo.completed_min)}</span> : null}
            {isActive && !isDone && (
               <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                 ⏱ {elapsedMinutes}m en cours
               </span>
            )}
          </div>
        </div>
        <div className={cn("flex items-center gap-1 shrink-0 transition-all", !isActive && !isMobile && "opacity-0 group-hover:opacity-100")}>
          {!isDone && (
            isActive ? (
              <button onClick={(e) => { e.stopPropagation(); onStopTimer() }} className="p-2.5 rounded-xl text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all" title="Arrêter et valider le temps">
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onStartTimer() }} className="p-2.5 rounded-xl text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Démarrer le chrono">
                <Play size={12} fill="currentColor" />
              </button>
            )
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(todo.id) }}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {/* Subtask progress bar — always visible */}
      {subtasks.length > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onEditSubtasks() }}
          className="w-full mt-1.5 group/bar" title={`${subtasksDoneCount}/${subtasks.length} sous-tâches`}>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-300',
              subtasksDoneCount === subtasks.length ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${Math.round((subtasksDoneCount / subtasks.length) * 100)}%` }} />
          </div>
        </button>
      )}
      </motion.div>
    </div>
  )
}

// ─── Quick add form ──────────────────────────────────────────────────────
const QuickTodoForm = ({ column, categories, config, onAdd, onCancel }: {
  column: ColumnId; categories: TodoCategory[]; config: Record<string, CategoryConfig>;
  onAdd: (t: Omit<Todo, 'id' | 'created'>) => void; onCancel: () => void
}) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>(categories[0])
  const [durationMin, setDurationMin] = useState('')
  const [due, setDue] = useState('')
  const [delegatedTo, setDelegatedTo] = useState('')

  const statusFromCol = (): TodoStatus => { if (column === 'delegated') return 'delegated'; if (column === 'waiting') return 'waiting'; return 'open' }
  const priorityFromCol = (): TodoPriority => column === 'urgent' ? 'urgent' : 'normal'

  const submit = () => {
    if (!text.trim()) return
    const dur = durationMin.trim() ? parseInt(durationMin.trim(), 10) : null
    onAdd({
      text: text.trim(), category, priority: priorityFromCol(), status: statusFromCol(),
      delegated_to: column === 'delegated' && delegatedTo.trim() ? delegatedTo.trim() : null,
      due: due || null, completed_at: null,
      duration_min: dur && !isNaN(dur) && dur > 0 ? dur : null, completed_min: null,
    })
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1.5">
      <input autoFocus value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Texte de la tâche…"
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-emerald-500" />
      <div className="flex flex-wrap gap-1">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all',
              category === c ? config[c].bg + ' ' + config[c].color : 'border-zinc-800 text-zinc-500')}
            title={config[c].label}>{config[c].emoji}</button>
        ))}
      </div>
      {column === 'delegated' && (
        <input value={delegatedTo} onChange={e => setDelegatedTo(e.target.value)} placeholder="Délégué à…"
          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] focus:outline-none focus:border-violet-500" />
      )}
      <div className="grid grid-cols-4 gap-1">
        {[{ l: '15m', v: '15' }, { l: '30m', v: '30' }, { l: '1h', v: '60' }, { l: '2h', v: '120' }].map(p => (
          <button key={p.v} type="button" onClick={() => setDurationMin(durationMin === p.v ? '' : p.v)}
            className={cn('py-1 rounded text-[8px] font-semibold border transition-all',
              durationMin === p.v ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-zinc-800 text-zinc-500')}>{p.l}</button>
        ))}
      </div>
      <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg">
        <CalendarDays size={10} className="text-zinc-500 shrink-0" />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} placeholder="échéance"
          className="w-full bg-transparent focus:outline-none" />
      </div>
      <div className="flex justify-end gap-1">
        <button onClick={submit} className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold">Ajouter</button>
        <button onClick={onCancel} className="px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 text-[10px]">✕</button>
      </div>
    </div>
  )
}

// ─── Log done form ──────────────────────────────────────────────────────
const LogDoneForm = ({ categories, config, onAdd, onCancel }: {
  categories: TodoCategory[]; config: Record<string, CategoryConfig>;
  onAdd: (t: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string }) => void
  onCancel: () => void
}) => {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<TodoCategory>(categories[0])
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
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
      <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">Loguer une activité déjà réalisée</p>
      <input autoFocus value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Qu'est-ce qui a été fait ?"
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-emerald-500" />
      <div className="flex flex-wrap gap-1">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all',
              category === c ? config[c].bg + ' ' + config[c].color : 'border-zinc-800 text-zinc-500')}>
            {config[c].emoji} {config[c].label}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-zinc-500" />
          <input value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="minutes"
            className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-center focus:outline-none focus:border-emerald-500" />
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} placeholder="date"
          className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500" />
        <button onClick={submit} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold">OK</button>
        <button onClick={onCancel} className="px-2 py-1 rounded border border-zinc-800 text-zinc-500 text-[10px]">✕</button>
      </div>
    </div>
  )
}

const TodoStat = ({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: 'emerald' | 'rose' | 'blue' | 'zinc'; icon?: React.ReactNode }) => {
  const colors = { emerald: 'border-emerald-500/20 text-emerald-300', rose: 'border-rose-500/20 text-rose-300', blue: 'border-blue-500/20 text-blue-300', zinc: 'border-zinc-800 text-zinc-300' }
  return (
    <div className={cn('rounded-xl border bg-zinc-900/50 p-3', colors[color])}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
        {icon}
      </div>
      <p className="text-xl font-extrabold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}
