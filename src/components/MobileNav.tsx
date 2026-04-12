import type { TabConfig, View } from '@/types'
import { cn } from '@/lib/utils'
import { Plus, RefreshCw } from 'lucide-react'

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

export const MobileNav = ({ view, onViewChange, tabs, onSync, onAdd, syncStatus }: MobileNavProps) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      {/* FAB */}
      <div className="flex justify-end gap-2 px-5 mb-3">
        <button onClick={onSync}
          className={cn('w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg',
            syncStatus === 'syncing' ? 'text-cyan-400' : 'text-zinc-500')}>
          <RefreshCw size={15} className={cn(syncStatus === 'syncing' && 'animate-spin')} />
        </button>
        <button onClick={onAdd}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Plus size={20} strokeWidth={2.5} className="text-white" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-zinc-950 border-t border-zinc-800/50 pb-[env(safe-area-inset-bottom,8px)] pt-1.5 px-2">
        <div className="flex items-center justify-around">
          {tabs.filter(t => t.type !== 'settings').map(tab => {
            const isActive = view === tab.id
            return (
              <button key={tab.id} onClick={() => onViewChange(tab.id as View)}
                className="flex flex-col items-center gap-0.5 py-1 flex-1">
                <span className={cn('text-[18px]', !isActive && 'opacity-40 grayscale')}>{tab.emoji}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-cyan-400" />}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
