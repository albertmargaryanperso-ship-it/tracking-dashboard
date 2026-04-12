import { useMemo, useState } from 'react'
import type { Stats, AppState } from '@/types'
import { formatMinutes, cn, getActiveCategories, getTodoTabs } from '@/lib/utils'

interface ChartsViewProps { state: AppState; stats: Stats }

const TAB_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f472b6', '#fb923c']

interface Slice { label: string; value: number; color: string; icon?: string }
const TAU = Math.PI * 2
const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
const arcPath = (cx: number, cy: number, r: number, s: number, e: number): string => {
  if (e - s >= TAU - 1e-6) { const p1 = polar(cx, cy, r, s); const p2 = polar(cx, cy, r, s + Math.PI); return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 1 1 ${p2.x} ${p2.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y} Z` }
  const p1 = polar(cx, cy, r, s); const p2 = polar(cx, cy, r, e); const la = e - s > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${la} 1 ${p2.x} ${p2.y} Z`
}

const PieChart = ({ slices, size = 220, label }: { slices: Slice[]; size?: number; label: string }) => {
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return <div className="flex items-center justify-center" style={{ width: size, height: size }}><div className="rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center" style={{ width: size - 30, height: size - 30 }}><p className="text-[10px] text-zinc-600">Aucune donnée</p></div></div>
  const cx = size / 2; const cy = size / 2; const r = size / 2 - 6; let cursor = -Math.PI / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {slices.map((s, i) => { const angle = (s.value / total) * TAU; const path = arcPath(cx, cy, r, cursor, cursor + angle); cursor += angle
        return <path key={i} d={path} fill={s.color} stroke="#0a0a0a" strokeWidth={1.5} opacity={0.92}><title>{`${s.label}: ${formatMinutes(s.value * 60)} (${Math.round((s.value / total) * 100)}%)`}</title></path> })}
      <circle cx={cx} cy={cy} r={r * 0.42} fill="#0a0a0a" stroke="#27272a" strokeWidth={1} />
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-zinc-300" style={{ font: '700 14px ui-sans-serif, system-ui' }}>{formatMinutes(total * 60) || '0'}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-zinc-500" style={{ font: '500 9px ui-sans-serif, system-ui' }}>total</text>
    </svg>
  )
}

const Legend = ({ slices }: { slices: Slice[] }) => {
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  return <ul className="space-y-1.5 text-[11px]">{slices.map((s, i) => (
    <li key={i} className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
      <span className="flex-1 truncate text-zinc-300">{s.icon && <span className="mr-1">{s.icon}</span>}{s.label}</span>
      <span className="font-mono text-zinc-400">{formatMinutes(s.value * 60)}</span>
      <span className="font-mono text-zinc-600 w-9 text-right">{Math.round((s.value / total) * 100)}%</span>
    </li>
  ))}</ul>
}

const ChartCard = ({ title, subtitle, borderColor, slices }: { title: string; subtitle?: string; borderColor: string; slices: Slice[] }) => (
  <div className="rounded-2xl border bg-zinc-900/50 p-5" style={{ borderColor }}>
    <div className="mb-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>{subtitle && <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>}</div>
    <div className="flex flex-col lg:flex-row items-center gap-5">
      <div className="shrink-0"><PieChart slices={slices} label={title} /></div>
      <div className="flex-1 w-full max-h-[220px] overflow-y-auto scrollbar-thin pr-1"><Legend slices={slices} /></div>
    </div>
  </div>
)

export const ChartsView = ({ state, stats }: ChartsViewProps) => {
  const [combinedMode, setCombinedMode] = useState<'macro' | 'detailed'>('macro')
  const bc = stats.tracking.by_category
  const { CATEGORY_CONFIG } = getActiveCategories(state.meta.custom_categories)
  const todoTabs = getTodoTabs(state.meta.custom_tabs)

  // Per-tab slices
  const tabSlices = useMemo(() => {
    return todoTabs.map((tab, i) => {
      const cats = tab.categoryFilter?.length ? tab.categoryFilter : Object.keys(CATEGORY_CONFIG)
      const slices: Slice[] = cats.map(c => ({
        label: CATEGORY_CONFIG[c]?.label || c,
        value: (bc[c]?.minutes || 0) / 60,
        color: CATEGORY_CONFIG[c]?.hex || '#666',
        icon: CATEGORY_CONFIG[c]?.emoji,
      })).filter(s => s.value > 0)
      return { tab, slices, color: TAB_COLORS[i % TAB_COLORS.length] }
    })
  }, [bc, todoTabs, CATEGORY_CONFIG])

  // Combined macro = per tab group
  const combinedMacro: Slice[] = useMemo(() =>
    todoTabs.map((tab, i) => {
      const grp = stats.tracking.by_group[tab.id]
      return { label: tab.label, value: (grp?.minutes ?? 0) / 60, color: TAB_COLORS[i % TAB_COLORS.length], icon: tab.emoji }
    }).filter(s => s.value > 0),
  [todoTabs, stats.tracking.by_group])

  // Combined detailed = all categories flat
  const combinedDetailed: Slice[] = useMemo(() => tabSlices.flatMap(t => t.slices), [tabSlices])

  return (
    <div className="space-y-5">
      {/* Stats per tab — compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {todoTabs.slice(0, 3).map((tab, i) => {
          const grp = stats.tracking.by_group[tab.id]
          const hex = TAB_COLORS[i % TAB_COLORS.length]
          return [
            <div key={`${tab.id}-total`} className="rounded-xl p-2.5 border bg-zinc-900/50" style={{ borderColor: hex + '30' }}>
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">{tab.emoji} Total</p>
              <p className="text-lg font-extrabold" style={{ color: hex }}>{formatMinutes(grp?.minutes ?? 0) || '0'}</p>
            </div>,
            <div key={`${tab.id}-streak`} className="rounded-xl p-2.5 border bg-zinc-900/50" style={{ borderColor: hex + '30' }}>
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">🔥 Streak</p>
              <p className="text-lg font-extrabold" style={{ color: hex }}>{stats.tracking.streaks_by_tab?.[tab.id] ?? 0}j</p>
            </div>,
          ]
        })}
      </div>

      {/* All charts in one grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tabSlices.map(({ tab, slices, color }) => (
          <ChartCard key={tab.id} title={`${tab.emoji} ${tab.label} — par catégorie`}
            subtitle={tab.categoryFilter?.map(c => CATEGORY_CONFIG[c]?.label).filter(Boolean).join(' · ')}
            borderColor={color + '30'} slices={slices} />
        ))}
        {/* Combined — same grid */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Combiné</h3>
            <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
              <button onClick={() => setCombinedMode('macro')} className={cn('px-3 py-1 rounded text-[10px] font-semibold transition-all', combinedMode === 'macro' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500')}>Macro</button>
              <button onClick={() => setCombinedMode('detailed')} className={cn('px-3 py-1 rounded text-[10px] font-semibold transition-all', combinedMode === 'detailed' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500')}>Détaillé</button>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row items-center gap-5">
            <div className="shrink-0"><PieChart slices={combinedMode === 'macro' ? combinedMacro : combinedDetailed} label="Combiné" /></div>
            <div className="flex-1 w-full max-h-[220px] overflow-y-auto scrollbar-thin pr-1"><Legend slices={combinedMode === 'macro' ? combinedMacro : combinedDetailed} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
