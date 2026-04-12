import { useActiveTimer } from '@/hooks/useActiveTimer'
import type { AppState } from '@/types'
import { StopCircle, Timer } from 'lucide-react'
import { cn, formatMinutes } from '@/lib/utils'

interface LiveTrackerProps {
  state: AppState
  onStop: (id: number, elapsed: number) => void
}

export const LiveTracker = ({ state, onStop }: LiveTrackerProps) => {
  const { activeTodoId, elapsedMinutes, stopTimer } = useActiveTimer()
  
  if (activeTodoId === null) return null
  
  const activeTodo = state.todos.find(t => t.id === activeTodoId)
  if (!activeTodo) return null

  const handleStop = () => {
    const min = stopTimer()
    onStop(activeTodoId, min)
  }

  return (
    <div className="fixed top-[env(safe-area-inset-top,0px)] inset-x-0 z-[60] p-3 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto bg-zinc-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 flex items-center justify-between px-4 py-3 animate-slide-in">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 animate-pulse">
            <Timer size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-500/80 leading-none mb-1">En cours</p>
            <p className="text-sm font-semibold text-zinc-100 truncate">{activeTodo.text}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-mono font-black text-white">{formatMinutes(elapsedMinutes)}</p>
          </div>
          <button 
            onClick={handleStop}
            className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-90"
          >
            <StopCircle size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
