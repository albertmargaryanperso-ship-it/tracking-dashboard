import { useState } from 'react'
import type { AppState, CategoryConfig, TabConfig } from '@/types'
import { getActiveCategories, getTodoTabs, getActiveTabs, cn } from '@/lib/utils'

interface SettingsViewProps {
  state: AppState
  onUpdateCategories: (cats: CategoryConfig[]) => void
  onUpdateTabs: (tabs: TabConfig[]) => void
  onUpdateAppMeta: (patch: { app_name?: string; app_emoji?: string }) => void
}

const PRESET_COLORS = [
  { name: 'blue', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', hex: '#60a5fa' },
  { name: 'emerald', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', hex: '#34d399' },
  { name: 'amber', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', hex: '#fbbf24' },
  { name: 'violet', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30', hex: '#a78bfa' },
  { name: 'pink', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30', hex: '#f472b6' },
  { name: 'orange', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', hex: '#fb923c' },
  { name: 'sky', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30', hex: '#38bdf8' },
  { name: 'teal', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30', hex: '#2dd4bf' },
  { name: 'rose', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', hex: '#fb7185' },
]

const APP_EMOJIS = ['📊', '🎯', '🚀', '💼', '📋', '⚡', '🔥', '💎', '🏆', '📈', '🌟', '🎨', '🧠', '💰', '🛠️', '🎮']

export const SettingsView = ({ state, onUpdateCategories, onUpdateTabs, onUpdateAppMeta }: SettingsViewProps) => {
  const [appName, setAppName] = useState(state.meta.app_name ?? 'Tracking')
  const [appEmoji, setAppEmoji] = useState(state.meta.app_emoji ?? '📊')
  const { CATEGORY_CONFIG, CATEGORY_LIST } = getActiveCategories(state.meta.custom_categories)
  const todoTabs = getTodoTabs(state.meta.custom_tabs)
  const allTabs = getActiveTabs(state.meta.custom_tabs)

  const [categories, setCategories] = useState<CategoryConfig[]>(() => CATEGORY_LIST.map(id => CATEGORY_CONFIG[id]))

  // Track which tab each category belongs to (derived from current tab categoryFilters)
  const [catTabMap, setCatTabMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const cat of CATEGORY_LIST) {
      // Find which tab contains this category
      for (const tab of todoTabs) {
        if (tab.categoryFilter?.includes(cat)) { map[cat] = tab.id; break }
      }
      // Fallback: legacy group field
      if (!map[cat]) {
        const cfg = CATEGORY_CONFIG[cat]
        if (cfg?.group === 'travail' && todoTabs[0]) map[cat] = todoTabs[0].id
        else if (cfg?.group === 'personnel' && todoTabs[1]) map[cat] = todoTabs[1].id
        else if (todoTabs[0]) map[cat] = todoTabs[0].id
      }
    }
    return map
  })

  const assignCatToTab = (catId: string, tabId: string) => {
    setCatTabMap(prev => ({ ...prev, [catId]: tabId }))
  }

  const save = () => {
    // 1. Save categories
    onUpdateCategories(categories)

    // 2. Rebuild tab categoryFilters from catTabMap
    const updatedTabs = allTabs.map(tab => {
      if (tab.type !== 'todos') return tab
      const catsForTab = categories.filter(c => catTabMap[c.id] === tab.id).map(c => c.id)
      return { ...tab, categoryFilter: catsForTab.length > 0 ? catsForTab : ['__empty__'] }
    })
    onUpdateTabs(updatedTabs)

    alert("Catégories et onglets sauvegardés !")
  }

  const addCategory = () => {
    const id = `cat_${Date.now()}`
    const defaultTabId = todoTabs[0]?.id ?? ''
    setCategories([...categories, { id, label: 'Nouvelle', emoji: '🌟', group: 'travail', ...PRESET_COLORS[0] }])
    setCatTabMap(prev => ({ ...prev, [id]: defaultTabId }))
  }

  const updateCat = (id: string, patch: Partial<CategoryConfig>) => {
    setCategories(categories.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const deleteCat = (id: string) => {
    if (categories.length <= 1) return alert("Vous devez garder au moins une catégorie.")
    setCategories(categories.filter(c => c.id !== id))
    setCatTabMap(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  const saveAppMeta = () => {
    onUpdateAppMeta({ app_name: appName.trim() || 'Tracking', app_emoji: appEmoji })
    // Update page title + PWA manifest dynamically
    document.title = `${appEmoji} ${appName.trim() || 'Tracking'}`
    // Update favicon
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    if (link) link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${appEmoji}</text></svg>`
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* App identity */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-bold mb-1">Identité de l'application</h2>
        <p className="text-[11px] text-zinc-500 mb-4">Nom, icône et logo de l'écran d'accueil.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Nom</label>
            <input value={appName} onChange={e => setAppName(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Icône</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {APP_EMOJIS.map(e => (
                <button key={e} onClick={() => setAppEmoji(e)}
                  className={cn('w-10 h-10 rounded-xl text-lg flex items-center justify-center border transition-all',
                    appEmoji === e ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30' : 'border-zinc-800 hover:border-zinc-700')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={saveAppMeta} className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-all">
          Appliquer
        </button>
        <p className="text-[9px] text-zinc-600 mt-2">Pour mettre à jour l'icône sur l'écran d'accueil iPhone : supprimer l'app → re-télécharger depuis Safari.</p>
      </div>

      {/* Categories */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Catégories</h2>
          <p className="text-[11px] text-zinc-500">Personnalisez vos catégories et assignez-les à un onglet.</p>
        </div>
        <button onClick={save} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20">
          Enregistrer
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex gap-2">
              <input value={c.emoji} onChange={e => updateCat(c.id, { emoji: e.target.value })} className="w-12 h-10 text-center bg-zinc-950 border border-zinc-800 rounded-lg text-lg" title="Emoji" />
              <input value={c.label} onChange={e => updateCat(c.id, { label: e.target.value })} className="flex-1 min-w-[120px] h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500" placeholder="Nom" />
            </div>

            <div className="flex gap-2 items-center flex-1">
              <select value={catTabMap[c.id] ?? ''} onChange={e => assignCatToTab(c.id, e.target.value)}
                className="h-10 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-emerald-500">
                {todoTabs.map(tab => (
                  <option key={tab.id} value={tab.id}>{tab.emoji} {tab.label}</option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1 px-2">
                {PRESET_COLORS.map(p => (
                  <button key={p.name} onClick={() => updateCat(c.id, { color: p.color, bg: p.bg, hex: p.hex })}
                    className={cn('w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center font-bold text-[10px]', p.bg, c.hex === p.hex ? 'border-zinc-300 ring-2 ring-emerald-500/50' : 'border-transparent')} title={p.name}>
                    {c.hex === p.hex && "✓"}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => deleteCat(c.id)} className="h-10 px-3 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold">
              Supprimer
            </button>
          </div>
        ))}

        <button onClick={addCategory} className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-all font-semibold text-sm">
          + Ajouter une catégorie
        </button>
      </div>
    </div>
  )
}
