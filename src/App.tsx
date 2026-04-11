import { useState, useMemo, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Dashboard } from '@/components/Dashboard'
import { VaultView } from '@/components/VaultView'
import { RoutineView } from '@/components/RoutineView'
import { TodosView } from '@/components/TodosView'
import { ChartsView } from '@/components/ChartsView'
import { QuickAddModal } from '@/components/QuickAddModal'
import { TokenModal } from '@/components/TokenModal'
import { useAppState } from '@/hooks/useAppState'
import { hasToken } from '@/lib/github'
import { todayISO } from '@/lib/utils'
import type { View } from '@/types'

export default function App() {
  const { state, stats, actions, syncStatus, lastSync, pull } = useAppState()
  const [view, setView] = useState<View>('dashboard')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [tokenPresent, setTokenPresent] = useState(hasToken())

  // Prompt for token on first load if missing
  useEffect(() => {
    if (!tokenPresent) {
      const t = setTimeout(() => setTokenOpen(true), 1200)
      return () => clearTimeout(t)
    }
  }, [tokenPresent])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'n' || e.key === '+') { e.preventDefault(); setQuickAddOpen(true) }
      if (e.key === 'r') { e.preventDefault(); void pull() }
      if (e.key === '1') setView('dashboard')
      if (e.key === '2') setView('travail')
      if (e.key === '3') setView('personnel')
      if (e.key === '4') setView('todos')
      if (e.key === '5') setView('charts')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pull])

  const projects = useMemo(() => {
    const set = new Set<string>()
    for (const s of state.sessions) set.add(s.project)
    return Array.from(set).sort()
  }, [state.sessions])

  const todayHours = useMemo(() => {
    const today = todayISO()
    return state.routine.find(r => r.date === today)?.hours ?? 0
  }, [state.routine])

  const handleTokenChange = () => setTokenPresent(hasToken())

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <Header
        view={view}
        onViewChange={setView}
        onQuickAdd={() => setQuickAddOpen(true)}
        onSyncNow={() => void pull()}
        onOpenToken={() => setTokenOpen(true)}
        syncStatus={syncStatus}
        lastSync={lastSync}
        hasToken={tokenPresent}
      />

      {/* Sync banner */}
      {syncStatus === 'no-token' && (
        <div className="relative bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-[11px] text-amber-300 flex items-center justify-center gap-2">
          <span>⚠️</span>
          <span>Modifications locales uniquement. Configure un token GitHub pour sync.</span>
          <button onClick={() => setTokenOpen(true)} className="underline font-semibold ml-1">Configurer</button>
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="relative bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-[11px] text-rose-300 flex items-center justify-center gap-2">
          <span>⚠️</span> Sync échouée — données en cache
        </div>
      )}

      <main className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {view === 'dashboard' && <Dashboard state={state} stats={stats} />}
        {view === 'travail' && (
          <VaultView
            state={state}
            stats={stats}
            onUpsertDayProject={actions.upsertDayProject}
            onDeleteDayProject={actions.deleteDayProject}
            onAddSession={actions.addSession}
          />
        )}
        {view === 'personnel' && (
          <RoutineView
            state={state}
            stats={stats}
            onSetRoutineHours={actions.setRoutineHours}
            onSetHabitHours={actions.setHabitHours}
            onSetRoutineNotes={actions.setRoutineNotes}
            onAddHabit={actions.addHabit}
            onRemoveHabit={actions.removeHabit}
          />
        )}
        {view === 'todos' && (
          <TodosView
            state={state}
            stats={stats}
            onAdd={actions.addTodo}
            onUpdate={actions.updateTodo}
            onToggle={actions.toggleTodo}
            onDelete={actions.deleteTodo}
          />
        )}
        {view === 'charts' && <ChartsView state={state} stats={stats} />}
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-5 right-5 sm:hidden w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 shadow-2xl shadow-violet-500/30 flex items-center justify-center text-2xl text-white z-30 active:scale-95 transition-all"
      >
        +
      </button>

      {/* Footer shortcuts */}
      <footer className="hidden lg:flex items-center justify-center gap-4 px-6 py-3 text-[10px] text-zinc-600 font-mono fixed bottom-0 inset-x-0 bg-zinc-950/80 backdrop-blur-sm border-t border-zinc-900">
        <span><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded">N</kbd> ajouter</span>
        <span><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded">R</kbd> sync</span>
        <span><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded">1-5</kbd> vues</span>
        <span className="text-zinc-700">· v{state.meta.version} · push auto</span>
      </footer>

      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        projects={projects}
        habits={state.meta.habitudes}
        onAddSession={actions.addSession}
        onSetRoutineHours={actions.setRoutineHours}
        onSetHabitHours={actions.setHabitHours}
        onAddTodo={actions.addTodo}
        todayHours={todayHours}
      />

      <TokenModal
        open={tokenOpen}
        onClose={() => setTokenOpen(false)}
        onTokenChange={handleTokenChange}
      />

    </div>
  )
}
