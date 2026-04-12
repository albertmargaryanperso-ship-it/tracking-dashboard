import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, ChevronLeft, ChevronRight, Check, Pencil } from 'lucide-react'
import type { View, TabConfig, TabType } from '@/types'
import { cn, getActiveCategories, getActiveTabs, DEFAULT_TABS } from '@/lib/utils'

interface HeaderProps {
  view: View
  onViewChange: (v: View) => void
  tabs: TabConfig[]
  onUpdateTabs: (tabs: TabConfig[]) => void
  onDeleteTabWithTodos: (tab: TabConfig) => void
  customCategories?: import('@/types').CategoryConfig[]
}

export const Header = ({ view, onViewChange, tabs, onUpdateTabs, onDeleteTabWithTodos, customCategories }: HeaderProps) => {
  const [reorderMode, setReorderMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const startRename = (tab: TabConfig) => { setEditingTabId(tab.id); setEditLabel(tab.label) }
  const saveRename = () => {
    if (editingTabId && editLabel.trim()) {
      onUpdateTabs(tabs.map(t => t.id === editingTabId ? { ...t, label: editLabel.trim() } : t))
    }
    setEditingTabId(null)
  }

  const moveTab = (id: string, dir: -1 | 1) => {
    const idx = tabs.findIndex(t => t.id === id)
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= tabs.length) return
    const updated = [...tabs]
    ;[updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]]
    onUpdateTabs(updated)
  }

  const deleteTab = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (!tab?.removable) return
    const hasCatFilter = tab.type === 'todos' && tab.categoryFilter && tab.categoryFilter.length > 0
    const msg = hasCatFilter
      ? `Supprimer l'onglet "${tab.label}" et ses tâches ouvertes ?\n(L'historique archivé est conservé)`
      : `Supprimer l'onglet "${tab.label}" ?`
    if (!window.confirm(msg)) return
    onDeleteTabWithTodos(tab)
    const updated = tabs.filter(t => t.id !== id)
    onUpdateTabs(updated)
    if (view === id) onViewChange(updated[0]?.id ?? 'dashboard')
  }

  const addTab = (tab: TabConfig) => {
    const settingsIdx = tabs.findIndex(t => t.type === 'settings')
    const updated = [...tabs]
    if (settingsIdx >= 0) updated.splice(settingsIdx, 0, tab)
    else updated.push(tab)
    onUpdateTabs(updated)
    setAddOpen(false)
    onViewChange(tab.id)
  }

  const renderTab = (tab: TabConfig, isMobile: boolean) => {
    const isActive = view === tab.id
    const isEditing = editingTabId === tab.id
    return (
      <div key={tab.id} className="relative flex items-center shrink-0">
        {reorderMode && (
          <button onClick={(e) => { e.stopPropagation(); moveTab(tab.id, -1) }}
            className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-all">
            <ChevronLeft size={12} />
          </button>
        )}
        {isEditing ? (
          <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditingTabId(null) }}
            onBlur={saveRename} autoFocus
            className="px-2 py-1 rounded-lg text-xs font-semibold bg-zinc-800 border border-emerald-500 text-zinc-100 focus:outline-none w-24" />
        ) : (
          <button
            onClick={() => { if (reorderMode) startRename(tab); else onViewChange(tab.id) }}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              reorderMode && 'ring-1 ring-zinc-700',
              isActive
                ? 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                : isMobile
                  ? 'text-zinc-400 bg-zinc-900 border border-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60')}>
            <span className={isMobile ? '' : 'text-sm'}>{tab.emoji}</span>
            {tab.label}
          </button>
        )}
        {reorderMode && (
          <button onClick={(e) => { e.stopPropagation(); moveTab(tab.id, 1) }}
            className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-all">
            <ChevronRight size={12} />
          </button>
        )}
        {reorderMode && tab.removable && (
          <button onClick={(e) => { e.stopPropagation(); deleteTab(tab.id) }}
            className="absolute -top-1.5 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg z-10">
            <X size={8} strokeWidth={3} />
          </button>
        )}
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-base">📊</div>
          <h1 className="text-sm font-semibold tracking-tight hidden sm:block">Tracking</h1>
        </div>

        {/* Tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl flex-1 justify-center">
          {tabs.map(t => renderTab(t, false))}
          {reorderMode && (
            <>
              <button onClick={() => setAddOpen(true)}
                className="w-7 h-7 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/40 flex items-center justify-center transition-all">
                <Plus size={14} />
              </button>
              <button onClick={() => setReorderMode(false)}
                className="ml-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1">
                <Check size={10} /> OK
              </button>
            </>
          )}
        </nav>

        {/* Customize button (desktop) */}
        {!reorderMode && (
          <button onClick={() => setReorderMode(true)} title="Personnaliser les onglets"
            className="hidden md:flex p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all shrink-0">
            <Pencil size={14} />
          </button>
        )}
      </div>

      {/* Tabs (mobile) */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
        {tabs.map(t => renderTab(t, true))}
        {/* Customize button (mobile) — always visible */}
        {!reorderMode && (
          <button onClick={() => setReorderMode(true)}
            className="shrink-0 w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 flex items-center justify-center">
            <Pencil size={12} />
          </button>
        )}
        {reorderMode && (
          <>
            <button onClick={() => setAddOpen(true)}
              className="shrink-0 w-8 h-8 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-emerald-400 flex items-center justify-center">
              <Plus size={14} />
            </button>
            <button onClick={() => setReorderMode(false)}
              className="shrink-0 px-2 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold">
              OK
            </button>
          </>
        )}
      </nav>

      {/* Add tab modal — portaled to body to escape header stacking context */}
      {addOpen && createPortal(
        <AddTabModal onAdd={addTab} onClose={() => setAddOpen(false)} customCategories={customCategories} />,
        document.body
      )}
    </header>
  )
}

// ─── Add tab modal — Todo only ──────────────────────────────────────────────
const EMOJIS = ['📋', '🎯', '🔥', '💡', '🚀', '📈', '🏠', '💰', '🎨', '📦', '🔧', '🌟']

const AddTabModal = ({ onAdd, onClose, customCategories }: {
  onAdd: (tab: TabConfig) => void; onClose: () => void; customCategories?: import('@/types').CategoryConfig[]
}) => {
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('📋')
  const [selectedCats, setSelectedCats] = useState<string[]>([])

  const { CATEGORY_CONFIG, CATEGORY_LIST } = getActiveCategories(customCategories)

  const toggleCat = (cat: string) => {
    setSelectedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  const submit = () => {
    if (!label.trim()) return
    onAdd({
      id: `tab_${Date.now()}`, label: label.trim(), emoji, type: 'todos', removable: true,
      ...(selectedCats.length > 0 ? { categoryFilter: selectedCats } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-sm font-bold">Nouvelle vue Todo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
        </div>

        <div className="p-5 pt-3 space-y-3">
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Nom de l'onglet…"
            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500" />

          {/* Emoji */}
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                className={cn('w-8 h-8 rounded-lg text-sm flex items-center justify-center border transition-all',
                  emoji === e ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700')}>
                {e}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Catégories à afficher</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_LIST.map(c => {
                const cat = CATEGORY_CONFIG[c]; const selected = selectedCats.includes(c)
                return (
                  <button key={c} onClick={() => toggleCat(c)}
                    className={cn('px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1',
                      selected ? cat.bg + ' ' + cat.color : 'border-zinc-800 text-zinc-500')}>
                    {cat.emoji} {cat.label}
                  </button>
                )
              })}
            </div>
            {selectedCats.length === 0 && <p className="text-[9px] text-zinc-600 mt-1">Aucun filtre = toutes les catégories</p>}
          </div>

          <button onClick={submit} disabled={!label.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-xs font-bold flex items-center justify-center gap-1.5">
            <Plus size={14} /> Créer l'onglet
          </button>
        </div>
      </div>
    </div>
  )
}
