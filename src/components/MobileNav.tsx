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
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      {/* Action Bar - Just above the main nav */}
      <div className="flex justify-end px-4 mb-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={onSync}
            className={cn(
              "p-3 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl text-zinc-400 shadow-2xl transition-all active:scale-95",
              syncStatus === 'syncing' && "animate-spin text-cyan-400"
            )}
          >
            <RefreshCw size={20} />
          </button>
          
          <button 
            onClick={onAdd}
            className="p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-2xl shadow-violet-500/40 active:scale-95 transition-all"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="bg-zinc-950/80 backdrop-blur-2xl border-t border-white/5 pt-3 pb-[env(safe-area-inset-bottom,24px)] px-2">
        <div className="flex items-center justify-around gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = view === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id as View)}
                className={cn(
                  "flex flex-col items-center gap-1 min-w-[64px] py-1 transition-all relative",
                  isActive ? "text-white" : "text-zinc-500"
                )}
              >
                <span className={cn(
                  "text-2xl transition-transform duration-300",
                  isActive ? "scale-110 -translate-y-0.5" : "scale-100 opacity-70 grayscale"
                )}>
                  {tab.emoji}
                </span>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-all",
                  isActive ? "opacity-100" : "opacity-0 translate-y-2"
                )}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                )}
              </button>
            )
          })}
          
          {/* Sync status / Token Indicator at the end or as a special item */}
          <button 
            onClick={onOpenToken}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] py-1",
              tokenPresent ? "text-zinc-500" : "text-amber-500 animate-pulse"
            )}
          >
            <span className="text-xl">
              {!tokenPresent ? <KeyRound size={20} /> : syncStatus === 'error' ? <CloudOff size={20} /> : <Cloud size={20} />}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Cloud</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
