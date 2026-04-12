import { useMemo, useState } from 'react'
import type { Stats, AppState } from '@/types'
import { formatMinutes, cn, getActiveCategories } from '@/lib/utils'

interface ChartsViewProps { state: AppState; stats: Stats }

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
  <div className={cn('rounded-2xl border bg-zinc-900/50 p-5', borderColor)}>
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
  const { CATEGORY_CONFIG, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES } = getActiveCategories(state.meta.custom_categories)

  const travailSlices: Slice[] = useMemo(() => TRAVAIL_CATEGORIES.map(c => ({ label: CATEGORY_CONFIG[c]?.label || c, value: (bc[c]?.minutes || 0) / 60, color: CATEGORY_CONFIG[c]?.hex || '#000', icon: CATEGORY_CONFIG[c]?.emoji })).filter(s => s.value > 0), [bc, TRAVAIL_CATEGORIES, CATEGORY_CONFIG])
  const personnelSlices: Slice[] = useMemo(() => PERSONNEL_CATEGORIES.map(c => ({ label: CATEGORY_CONFIG[c]?.label || c, value: (bc[c]?.minutes || 0) / 60, color: CATEGORY_CONFIG[c]?.hex || '#000', icon: CATEGORY_CONFIG[c]?.emoji })).filter(s => s.value > 0), [bc, PERSONNEL_CATEGORIES, CATEGORY_CONFIG])

  const combinedMacro: Slice[] = useMemo(() => [
    { label: 'Travail', value: stats.tracking.by_group.travail.minutes / 60, color: '#a78bfa' },
    { label: 'Personnel', value: stats.tracking.by_group.personnel.minutes / 60, color: '#22d3ee' },
  ].filter(s => s.value > 0), [stats.tracking.by_group])

  const combinedDetailed: Slice[] = useMemo(() => [...travailSlices, ...personnelSlices], [travailSlices, personnelSlices])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Travail total" value={formatMinutes(stats.tracking.by_group.travail.minutes) || '0'} accent="violet" />
        <Stat label="Personnel total" value={formatMinutes(stats.tracking.by_group.personnel.minutes) || '0'} accent="cyan" />
        <Stat label="Streak travail" value={`${stats.tracking.streak_travail}j`} accent="violet" />
        <Stat label="Streak personnel" value={`${stats.tracking.streak_personnel}j`} accent="cyan" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Travail — par catégorie" subtitle="Pro · Finance · Admin · Automatisation" borderColor="border-violet-500/20" slices={travailSlices} />
        <ChartCard title="Personnel — par catégorie" subtitle="Sport · Cardio · Lecture · Bien-être" borderColor="border-cyan-500/20" slices={personnelSlices} />
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div><h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Combiné — Travail × Personnel</h3></div>
          <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <button onClick={() => setCombinedMode('macro')} className={cn('px-3 py-1 rounded text-[10px] font-semibold transition-all', combinedMode === 'macro' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500')}>Macro</button>
            <button onClick={() => setCombinedMode('detailed')} className={cn('px-3 py-1 rounded text-[10px] font-semibold transition-all', combinedMode === 'detailed' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500')}>Détaillé</button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center gap-5">
          <div className="shrink-0"><PieChart size={260} slices={combinedMode === 'macro' ? combinedMacro : combinedDetailed} label="Combiné" /></div>
          <div className="flex-1 w-full max-h-[260px] overflow-y-auto scrollbar-thin pr-1"><Legend slices={combinedMode === 'macro' ? combinedMacro : combinedDetailed} /></div>
        </div>
      </div>
    </div>
  )
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent: 'violet' | 'cyan' }) => (
  <div className={cn('rounded-xl p-3 border bg-zinc-900/50', accent === 'violet' ? 'border-violet-500/20' : 'border-cyan-500/20')}>
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
    <p className={cn('text-xl font-extrabold mt-0.5', accent === 'violet' ? 'text-violet-300' : 'text-cyan-300')}>{value}</p>
  </div>
)
