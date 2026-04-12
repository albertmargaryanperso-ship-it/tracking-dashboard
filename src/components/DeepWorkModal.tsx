import { useState } from 'react'
import { Square, X } from 'lucide-react'
import type { AppState } from '@/types'
import { useActiveTimer } from '@/hooks/useActiveTimer'
import { getActiveCategories } from '@/lib/utils'

interface DeepWorkModalProps {
  state: AppState
  onToggleTodo: (id: number, min: number) => void
}

export const DeepWorkModal = ({ state, onToggleTodo }: DeepWorkModalProps) => {
  const { activeTodoId, elapsedMinutes, stopTimer } = useActiveTimer()
  const [isOpen, setIsOpen] = useState(false)

  if (!activeTodoId) return null

  const activeTodo = state.todos.find(t => t.id === activeTodoId)
  if (!activeTodo) return null

  const { CATEGORY_CONFIG } = getActiveCategories(state.meta.custom_categories)
  const cat = CATEGORY_CONFIG[activeTodo.category] ?? CATEGORY_CONFIG.admin

  const handleStop = () => {
    const min = stopTimer()
    const raw = window.prompt(`Temps écoulé : ${min} min. Valider ?`, String(min))
    if (raw !== null) {
      const parsed = parseInt(raw.trim(), 10)
      onToggleTodo(activeTodo.id, isNaN(parsed) ? min : Math.max(0, parsed))
    }
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 sm:top-24 sm:right-8 z-40 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl flex items-center gap-2 sm:gap-3 hover:scale-105 transition-all group animate-slide-in">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[10px] sm:text-[11px] font-bold text-zinc-200 truncate max-w-[100px] sm:max-w-[200px]">{activeTodo.text}</span>
        <span className="text-[10px] text-cyan-400 font-mono font-semibold">{String(Math.floor(elapsedMinutes / 60)).padStart(2, '0')}:{String(elapsedMinutes % 60).padStart(2, '0')}</span>
      </button>
    )
  }

  // Full Screen Zen Mode
  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center animate-fade-in overflow-hidden">
      {/* Background aurora effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-1/4 right-1/4 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] rounded-full bg-cyan-500/20 blur-[80px] lg:blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-1/4 left-1/4 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] rounded-full bg-violet-500/20 blur-[80px] lg:blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 lg:top-8 lg:right-12 p-3 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 z-10 transition-all">
        <X size={28} />
      </button>

      <div className="relative z-10 max-w-3xl text-center px-4 w-full">
        <div className="mb-6 lg:mb-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 shadow-lg">
           <span className="text-sm">{cat.emoji}</span>
           <span className="text-xs font-semibold text-zinc-300 tracking-wider uppercase">{cat.label}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-12 lg:mb-20 min-h-[80px] flex items-center justify-center">{activeTodo.text}</h1>

        <div className="font-mono text-7xl sm:text-[120px] lg:text-[180px] font-light text-cyan-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.2)] mb-12 lg:mb-20">
          {String(Math.floor(elapsedMinutes / 60)).padStart(2, '0')}:{String(elapsedMinutes % 60).padStart(2, '0')}
        </div>

        <button onClick={handleStop} className="group relative overflow-hidden rounded-full p-1 bg-gradient-to-r from-cyan-500 to-violet-500 hover:scale-[1.02] transition-transform active:scale-95 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
          <div className="px-6 py-3 sm:px-8 sm:py-4 bg-zinc-950 rounded-full flex items-center justify-center gap-3 transition-colors group-hover:bg-transparent">
             <Square className="text-cyan-400 group-hover:text-white transition-colors" size={18} fill="currentColor" />
             <span className="text-xs sm:text-sm font-bold tracking-widest uppercase text-zinc-200 group-hover:text-white transition-colors">Terminer Focus</span>
          </div>
        </button>
      </div>

    </div>
  )
}
