import type { View } from '@/types'
import { cn } from '@/lib/utils'

interface HeaderProps {
  view: View
  onViewChange: (v: View) => void
}

const VIEWS: Array<{ id: View; label: string; emoji: string }> = [
  { id: 'dashboard',       label: 'Dashboard',       emoji: '📊' },
  { id: 'todo-travail',    label: 'Todo Travail',    emoji: '💼' },
  { id: 'todo-personnel',  label: 'Todo Personnel',  emoji: '🧘' },
  { id: 'charts',          label: 'Camemberts',      emoji: '🥧' },
  { id: 'historique',      label: 'Historique',       emoji: '📜' },
  { id: 'settings',        label: 'Paramètres',      emoji: '⚙️' },
]

export const Header = ({ view, onViewChange }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-base">📊</div>
          <h1 className="text-sm font-semibold tracking-tight hidden sm:block">Tracking</h1>
        </div>

        {/* Tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl flex-1 justify-center">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => onViewChange(v.id)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                view === v.id
                  ? 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60')}>
              <span className="text-sm">{v.emoji}</span>{v.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tabs (mobile) */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => onViewChange(v.id)}
            className={cn('shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              view === v.id
                ? 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white'
                : 'text-zinc-400 bg-zinc-900 border border-zinc-800')}>
            <span>{v.emoji}</span>{v.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
