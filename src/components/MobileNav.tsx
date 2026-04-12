import type { TabConfig, View } from '@/types'
import { cn } from '@/lib/utils'
import { Plus, Settings, RefreshCw, Cloud, CloudOff, KeyRound } from 'lucide-react'

interface MobileNavProps {
  view: View
  onViewChange: (v: View) => void
  tabs: TabConfig[]
  onSync: () => void
  onAdd: () => void
  onOpenToken: () => void
  syncStatus: 'idle' | 'syncing' | 'success' | 'error' | 'no-token'
  tokenPresent: boolean
}

export const MobileNav = ({
  view,
  onViewChange,
  tabs,
  onSync,
  onAdd,
  onOpenToken,
  syncStatus,
  tokenPresent
}: MobileNavProps) => {
  const activeIndex = tabs.findIndex(t => t.id === view)
  
  return (
    <nav className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="flex items-center gap-1 p-2 rounded-[32px] pointer-events-auto relative max-w-fit mx-auto glass-premium inner-shadow">
        
        {/* Sliding Indicator Background */}
        <div 
          className="absolute h-12 rounded-2xl bg-white/5 border border-white/5 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ 
            width: '64px',
            transform: `translateX(${activeIndex * 68}px)`,
            left: '8px', 
            opacity: activeIndex === -1 ? 0 : 1
          }}
        />

        {/* Tab Items */}
        <div className="flex items-center gap-1 relative z-10">
          {tabs.map((tab) => {
            const isActive = view === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id as View)}
                className={cn(
                  "flex flex-col items-center justify-center w-[64px] h-12 transition-all duration-300",
                  isActive ? "text-white scale-105" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <span className={cn(
                  "text-2xl transition-all duration-300",
                  isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" : "grayscale opacity-70"
                )}>
                  {tab.emoji}
                </span>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest transition-all duration-300 mt-0.5",
                  isActive ? "opacity-100" : "opacity-0 scale-75"
                )}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div className="w-[1px] h-8 bg-white/10 mx-1" />

        {/* Actions Section */}
        <div className="flex items-center gap-1.5 px-1 relative z-10">
          <button 
            onClick={onSync}
            className={cn(
              "p-2.5 rounded-2xl text-zinc-400 hover:text-cyan-400 transition-all active:scale-90",
              syncStatus === 'syncing' && "animate-spin text-cyan-400"
            )}
          >
            <RefreshCw size={20} />
          </button>
          
          <button 
            onClick={onAdd}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/25 flex items-center justify-center active:scale-90 transition-all hover:brightness-110"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </nav>
  )
}
