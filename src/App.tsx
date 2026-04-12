import { useState, useEffect } from 'react'
import { RefreshCw, Cloud, CloudOff, KeyRound, Plus, ClipboardCopy, Settings } from 'lucide-react'
import { Header } from '@/components/Header'
import { Dashboard } from '@/components/Dashboard'
import { TodosView } from '@/components/TodosView'
import { ChartsView } from '@/components/ChartsView'
import { HistoryView } from '@/components/HistoryView'
import { SettingsView } from '@/components/SettingsView'
import { DeepWorkModal } from '@/components/DeepWorkModal'
import { QuickAddModal } from '@/components/QuickAddModal'
import { TokenModal } from '@/components/TokenModal'
import { useAppState } from '@/hooks/useAppState'
import { hasToken } from '@/lib/github'
import { cn, todayISO, isoToFr, formatMinutes, getActiveTabs } from '@/lib/utils'
import type { View } from '@/types'
import type { SyncStatus } from '@/lib/github'

  export default function App() {
    const { state, stats, actions, syncStatus, lastSync, pull } = useAppState()
    const tabs = getActiveTabs(state.meta.custom_tabs)
    const [view, setView] = useState<View>(tabs[0]?.id ?? 'dashboard')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [tokenPresent, setTokenPresent] = useState(hasToken())

  // Ensure current view exists in tabs
  useEffect(() => {
    if (!tabs.find(t => t.id === view)) setView(tabs[0]?.id ?? 'dashboard')
  }, [tabs, view])

  // Sync page title + favicon with app meta
  useEffect(() => {
    const emoji = state.meta.app_emoji ?? '📊'
    const name = state.meta.app_name ?? 'Tracking'
    document.title = `${emoji} ${name}`
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    if (link) link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${encodeURIComponent(emoji)}</text></svg>`
  }, [state.meta.app_emoji, state.meta.app_name])

  useEffect(() => {
    if (!tokenPresent) { const t = setTimeout(() => setTokenOpen(true), 1200); return () => clearTimeout(t) }
  }, [tokenPresent])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'n' || e.key === '+') { e.preventDefault(); setQuickAddOpen(true) }
      if (e.key === 'r') { e.preventDefault(); void pull() }
      // Number keys map to tabs by index
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= tabs.length) setView(tabs[num - 1].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pull, tabs])

  const handleCopyBilan = () => {
    const today = todayISO()
    const doneToday = state.todos.filter(t => t.done && t.completed_at?.startsWith(today))
    if (doneToday.length === 0) {
      alert("Aucune tâche terminée aujourd'hui.")
      return
    }

    let md = `## 📊 Bilan du ${isoToFr(today)}\n\n`
    doneToday.forEach(t => {
      md += `- [x] ${t.text} (${t.completed_min ? formatMinutes(t.completed_min) : '?'})\n`
    })

    navigator.clipboard.writeText(md.trim())
      .then(() => alert("Bilan copié dans le presse-papier !"))
      .catch(err => console.error("Erreur de copie :", err))
  }

  // Find active tab config
  const activeTab = tabs.find(t => t.id === view)

  // Render view based on tab type
  const renderView = () => {
    if (!activeTab) return null
    switch (activeTab.type) {
      case 'dashboard':
        return <Dashboard state={state} stats={stats} />
      case 'todos':
        return (
          <TodosView state={state} stats={stats}
            onAdd={actions.addTodo} onAddDone={actions.addDoneTodo}
            onUpdate={actions.updateTodo} onToggle={actions.toggleTodo} onDelete={actions.deleteTodo} onSwapOrder={actions.swapTodoOrder}
            categoryFilter={activeTab.categoryFilter} />
        )
      case 'charts':
        return <ChartsView state={state} stats={stats} />
      case 'historique':
        return <HistoryView state={state} onEditArchived={actions.editArchivedTodo} onDeleteArchived={actions.deleteArchivedTodo} onDeleteMonth={actions.deleteArchiveMonth} />
      case 'settings':
        return <SettingsView state={state} onUpdateCategories={actions.updateCategories} onUpdateTabs={actions.updateTabs} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <Header view={view} onViewChange={setView} tabs={tabs} onUpdateTabs={actions.updateTabs}
        onDeleteTabWithTodos={(tab) => { if (tab.categoryFilter?.length) actions.deleteTabTodos(tab.categoryFilter) }}
        customCategories={state.meta.custom_categories}
        appName={state.meta.app_name} appEmoji={state.meta.app_emoji} />

      {syncStatus === 'no-token' && (
        <div className="relative bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-[11px] text-amber-300 flex items-center justify-center gap-2">
          <span>⚠️</span><span>Modifications locales uniquement.</span>
          <button onClick={() => setTokenOpen(true)} className="underline font-semibold ml-1">Configurer token</button>
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="relative bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-[11px] text-rose-300 flex items-center justify-center gap-2">
          <span>⚠️</span> Sync échouée — données en cache
        </div>
      )}

      <main className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {renderView()}
      </main>

      {/* Footer — actions bar */}
      <footer className="fixed bottom-0 inset-x-0 z-20 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <SyncIndicator syncStatus={syncStatus} lastSync={lastSync} />
          <div className="flex items-center gap-1.5">
            <button onClick={() => setTokenOpen(true)} title={tokenPresent ? 'Token configuré' : 'Configurer token'}
              className={cn('p-2 rounded-xl border transition-all',
                tokenPresent ? 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 animate-pulse')}>
              {!tokenPresent ? <KeyRound size={14} /> : syncStatus === 'error' ? <CloudOff size={14} /> : <Cloud size={14} />}
            </button>
            <button onClick={() => void pull()} title="Sync maintenant"
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-all">
              <RefreshCw size={14} className={cn(syncStatus === 'syncing' && 'animate-spin')} />
            </button>
            <button onClick={handleCopyBilan} title="Copier le bilan du jour"
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-all hidden sm:block">
              <ClipboardCopy size={14} />
            </button>
            <button onClick={() => setView('settings')} title="Paramètres"
              className={cn('p-2 rounded-xl border transition-all',
                view === 'settings' ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300')}>
              <Settings size={14} className={cn(view === 'settings' && 'animate-spin-slow')} />
            </button>
            <button onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-xs font-semibold text-white transition-all shadow-lg shadow-violet-500/20">
              <Plus size={14} /> <span>Ajouter</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile FAB (hidden since we have footer) */}

      <DeepWorkModal state={state} onToggleTodo={actions.toggleTodo} />

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)}
        onAddTodo={actions.addTodo} onAddDoneTodo={actions.addDoneTodo} customCategories={state.meta.custom_categories} />

      <TokenModal open={tokenOpen} onClose={() => setTokenOpen(false)}
        onTokenChange={() => setTokenPresent(hasToken())} />
    </div>
  )
}

const SyncIndicator = ({ syncStatus, lastSync }: { syncStatus: SyncStatus; lastSync: string | null }) => {
  const relative = (iso: string | null): string => {
    if (!iso) return 'jamais'
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return "à l'instant"
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
    return d.toLocaleDateString('fr-FR')
  }
  const color =
    syncStatus === 'syncing' ? 'text-cyan-400 animate-pulse' :
    syncStatus === 'success' ? 'text-emerald-400' :
    syncStatus === 'error' ? 'text-rose-400' : 'text-zinc-600'
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
      <span className={cn('w-1.5 h-1.5 rounded-full', color)} />
      <span>Sync {relative(lastSync)}</span>
    </div>
  )
}
