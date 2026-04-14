import { useState } from 'react'
import { useActiveTimer } from '@/hooks/useActiveTimer'
import type { AppState } from '@/types'
import { StopCircle, Timer, Minimize2, Maximize2 } from 'lucide-react'
import { cn, formatMinutes } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface LiveTrackerProps {
  state: AppState
  onStop: (id: number, elapsed: number) => void
}

export const LiveTracker = ({ state, onStop }: LiveTrackerProps) => {
  const { activeTodoId, elapsedMinutes, stopTimer } = useActiveTimer()
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  if (activeTodoId === null) return null
  
  const activeTodo = state.todos.find(t => t.id === activeTodoId)
  if (!activeTodo) return null

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    const min = stopTimer()
    onStop(activeTodoId, min)
    setIsFullscreen(false)
  }

  return (
    <AnimatePresence>
      {isFullscreen ? (
        <motion.div 
          key="fullscreen"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center p-6"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none" />
          
          <button onClick={() => setIsFullscreen(false)} 
            className="absolute top-[calc(env(safe-area-inset-top,20px)+20px)] left-6 p-4 rounded-full bg-zinc-900/50 text-zinc-400 hover:text-white border border-zinc-800 transition-all hover:bg-zinc-800">
            <Minimize2 size={24} />
          </button>
          
          <div className="text-center z-10 w-full max-w-xl mx-auto flex flex-col items-center space-y-12">
            <div className="inline-flex items-center justify-center p-6 rounded-full bg-cyan-500/10 text-cyan-400 relative">
               <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-50" style={{ animationDuration: '3s' }} />
               <Timer size={48} />
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 leading-snug">
               {activeTodo.text}
            </h2>
            
            <p className="text-[120px] sm:text-[180px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 font-mono" 
               style={{ fontVariantNumeric: 'tabular-nums', textShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
              {formatMinutes(elapsedMinutes)}
            </p>
          </div>

          <div className="absolute bottom-[calc(env(safe-area-inset-bottom,40px)+40px)] inset-x-0 flex justify-center z-10">
            <button onClick={handleStop}
              className="group flex items-center gap-3 px-8 py-5 rounded-[2rem] bg-rose-500/10 hover:bg-rose-500 text-rose-500 border border-rose-500/50 hover:text-white transition-all shadow-[0_0_30px_rgba(244,63,94,0.15)] hover:shadow-[0_0_50px_rgba(244,63,94,0.4)]">
              <StopCircle size={28} />
              <span className="text-xl font-bold uppercase tracking-widest">Terminer la tâche</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="pill"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-[env(safe-area-inset-top,0px)] inset-x-0 z-[60] p-3 pointer-events-none"
        >
          <div 
            onClick={() => setIsFullscreen(true)}
            className="cursor-pointer max-w-md mx-auto pointer-events-auto bg-zinc-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-[0_10px_30px_rgba(6,182,212,0.1)] flex items-center justify-between px-4 py-3 hover:bg-zinc-800/90 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Timer size={18} className="animate-pulse" />
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-cyan-500/80 leading-none mb-1">Mode Deep Work</p>
                <p className="text-sm font-semibold text-zinc-100 truncate pr-2">{activeTodo.text}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right flex items-center gap-1.5 px-2 py-1 bg-zinc-950/50 rounded-lg">
                <div className="w-1 h-3 rounded-full bg-cyan-500 animate-pulse" />
                <p className="text-xs font-mono font-black text-cyan-50">{formatMinutes(elapsedMinutes)}</p>
              </div>
              
              <div className="h-6 w-px bg-zinc-800 mx-1" />
              <button 
                onClick={handleStop}
                className="p-2.5 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 transition-all active:scale-90"
              >
                <StopCircle size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
