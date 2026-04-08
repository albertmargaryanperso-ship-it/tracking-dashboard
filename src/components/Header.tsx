import { RefreshCw, Cloud, CloudOff, KeyRound, Plus } from 'lucide-react'
import type { View } from '@/types'
import type { SyncStatus } from '@/lib/github'
import { cn } from '@/lib/utils'

interface HeaderProps {
  view: View
  onViewChange: (v: View) => void
  onQuickAdd: () => void
  onSyncNow: () => void
  onOpenToken: () => void
  syncStatus: SyncStatus
  lastSync: string | null
  hasToken: boolean
}

const VIEWS: Array<{ id: View; label: string; emoji: string }> = [
  { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
  { id: 'vault',     label: 'Vault',     emoji: '🧠' },
  { id: 'routine',   label: 'Routine',   emoji: '🔁' },
  { id: 'todos',     label: 'Todos',     emoji: '✅' },
  { id: 'charts',    label: 'Camemberts', emoji: '🥧' },
]

export const Header = ({
  view, onViewChange, onQuickAdd, onSyncNow, onOpenToken, syncStatus, lastSync, hasToken,
}: HeaderProps) => {
  const relative = (iso: string | null): string => {
    if (!iso) return 'jamais'
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
    return d.toLocaleDateString('fr-FR')
  }

  const SyncIcon = !hasToken ? KeyRound : syncStatus === 'error' ? CloudOff : Cloud
  const syncColor =
    syncStatus === 'syncing' ? 'text-cyan-400 animate-pulse' :
    syncStatus === 'success' ? 'text-emerald-400' :
    syncStatus === 'error' ? 'text-rose-400' :
    !hasToken ? 'text-amber-400' : 'text-zinc-500'

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-base shrink-0">
            📊
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight truncate">Tracking — Albert</h1>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full', syncColor)} />
              Sync {relative(lastSync)}
            </p>
          </div>
        </div>

        {/* Tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                view === v.id
                  ? 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              )}
            >
              <span className="text-sm">{v.emoji}</span>
              {v.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenToken}
            title={hasToken ? 'Token configuré' : 'Configurer le token GitHub'}
            className={cn(
              'p-2 rounded-xl border transition-all',
              hasToken
                ? 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 animate-pulse'
            )}
          >
            <SyncIcon size={14} />
          </button>
          <button
            onClick={onSyncNow}
            title="Sync maintenant"
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-all"
          >
            <RefreshCw size={14} className={cn(syncStatus === 'syncing' && 'animate-spin')} />
          </button>
          <button
            onClick={onQuickAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-xs font-semibold text-white transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>
      </div>

      {/* Tabs (mobile) */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              view === v.id
                ? 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white'
                : 'text-zinc-400 bg-zinc-900 border border-zinc-800'
            )}
          >
            <span>{v.emoji}</span>
            {v.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
