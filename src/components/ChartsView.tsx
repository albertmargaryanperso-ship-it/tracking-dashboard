import { useMemo, useState } from 'react'
import type { Stats, AppState } from '@/types'
import { formatHours, habitColor, habitIcon, cn, CATEGORY_CONFIG, TRAVAIL_CATEGORIES } from '@/lib/utils'

interface ChartsViewProps {
  state: AppState
  stats: Stats
}

interface Slice {
  label: string
  value: number
  color: string
  icon?: string
}

const TAU = Math.PI * 2

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
})

const arcPath = (cx: number, cy: number, r: number, start: number, end: number): string => {
  if (end - start >= TAU - 1e-6) {
    const p1 = polar(cx, cy, r, start)
    const p2 = polar(cx, cy, r, start + Math.PI)
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 1 1 ${p2.x} ${p2.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y} Z`
  }
  const p1 = polar(cx, cy, r, start)
  const p2 = polar(cx, cy, r, end)
  const largeArc = end - start > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`
}

const PieChart = ({ slices, size = 220, label }: { slices: Slice[]; size?: number; label: string }) => {
  const total = slices.reduce((acc, s) => acc + s.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 6
  let cursor = -Math.PI / 2

  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <div className="rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center"
          style={{ width: size - 30, height: size - 30 }}>
          <p className="text-[10px] text-zinc-600">Aucune donnée</p>
        </div>
      </div>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {slices.map((s, i) => {
        const angle = (s.value / total) * TAU
        const path = arcPath(cx, cy, r, cursor, cursor + angle)
        cursor += angle
        return (
          <path key={i} d={path} fill={s.color} stroke="#0a0a0a" strokeWidth={1.5} opacity={0.92}>
            <title>{`${s.label}: ${formatHours(s.value)} (${Math.round((s.value / total) * 100)}%)`}</title>
          </path>
        )
      })}
      <circle cx={cx} cy={cy} r={r * 0.42} fill="#0a0a0a" stroke="#27272a" strokeWidth={1} />
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-zinc-300"
        style={{ font: '700 14px ui-sans-serif, system-ui' }}>{formatHours(total)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-zinc-500"
        style={{ font: '500 9px ui-sans-serif, system-ui' }}>total</text>
    </svg>
  )
}

const Legend = ({ slices }: { slices: Slice[] }) => {
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  return (
    <ul className="space-y-1.5 text-[11px]">
      {slices.map((s, i) => {
        const pct = Math.round((s.value / total) * 100)
        return (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="flex-1 truncate text-zinc-300">
              {s.icon && <span className="mr-1">{s.icon}</span>}
              {s.label}
            </span>
            <span className="font-mono text-zinc-400">{formatHours(s.value)}</span>
            <span className="font-mono text-zinc-600 w-9 text-right">{pct}%</span>
          </li>
        )
      })}
    </ul>
  )
}

const ChartCard = ({ title, subtitle, borderColor, slices }: {
  title: string; subtitle?: string; borderColor: string; slices: Slice[]
}) => (
  <div className={cn('rounded-2xl border bg-zinc-900/50 p-5', borderColor)}>
    <div className="mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
      {subtitle && <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
    <div className="flex flex-col lg:flex-row items-center gap-5">
      <div className="shrink-0"><PieChart slices={slices} label={title} /></div>
      <div className="flex-1 w-full max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
        <Legend slices={slices} />
      </div>
    </div>
  </div>
)

export const ChartsView = ({ state, stats }: ChartsViewProps) => {
  const [combinedMode, setCombinedMode] = useState<'macro' | 'detailed'>('macro')

  // Travail by category
  const travailSlices: Slice[] = useMemo(
    () => stats.vault.by_category.filter(c => c.hours > 0).map(c => ({
      label: c.name, value: c.hours, color: c.color, icon: c.emoji,
    })),
    [stats.vault.by_category],
  )

  // Personnel by habit
  const personnelSlices: Slice[] = useMemo(
    () => stats.routine.by_habit.filter(h => h.hours > 0).map(h => ({
      label: h.name, value: h.hours, color: habitColor(h.name), icon: habitIcon(h.name),
    })),
    [stats.routine.by_habit],
  )

  // Todos by category (time)
  const todoSlices: Slice[] = useMemo(() => {
    return [...TRAVAIL_CATEGORIES, 'sport', 'cardio', 'lecture', 'bien-etre' as const].map(cat => {
      const cfg = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]
      const minutes = stats.todos.by_category[cat as keyof typeof stats.todos.by_category]?.minutes ?? 0
      return { label: cfg?.label ?? cat, value: minutes / 60, color: cfg?.hex ?? '#94a3b8', icon: cfg?.emoji }
    }).filter(s => s.value > 0)
  }, [stats.todos.by_category])

  // Combined macro: Travail vs Personnel
  const combinedMacro: Slice[] = useMemo(() => {
    const t = stats.vault.total_hours
    const p = stats.routine.total_hours
    return [
      { label: 'Travail', value: t, color: '#a78bfa' },
      { label: 'Personnel', value: p, color: '#22d3ee' },
    ].filter(s => s.value > 0)
  }, [stats.vault.total_hours, stats.routine.total_hours])

  // Combined detailed: all 8 categories
  const combinedDetailed: Slice[] = useMemo(
    () => [...travailSlices, ...personnelSlices],
    [travailSlices, personnelSlices],
  )

  return (
    <div className="space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Travail total" value={formatHours(stats.vault.total_hours)} accent="violet" />
        <Stat label="Personnel total" value={formatHours(stats.routine.total_hours)} accent="cyan" />
        <Stat label="Streak travail" value={`${stats.vault.streak_days}j`} accent="violet" />
        <Stat label="Streak personnel" value={`${stats.routine.streak_days}j`} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Travail — par catégorie"
          subtitle="Pro · Finance · Admin · Automatisation"
          borderColor="border-violet-500/20"
          slices={travailSlices}
        />
        <ChartCard
          title="Personnel — par catégorie"
          subtitle="Sport · Cardio · Lecture · Bien-être"
          borderColor="border-cyan-500/20"
          slices={personnelSlices}
        />
      </div>

      {/* Todos time by category */}
      <ChartCard
        title="Todos — temps par catégorie"
        subtitle="Temps cumulé des tâches terminées"
        borderColor="border-emerald-500/20"
        slices={todoSlices}
      />

      {/* Combined card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Combiné — Travail × Personnel</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {combinedMode === 'macro' ? 'Vue macro : ratio Travail / Personnel' : 'Vue détaillée : les 8 catégories'}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <button onClick={() => setCombinedMode('macro')}
              className={cn('px-3 py-1 rounded text-[10px] font-semibold transition-all',
                combinedMode === 'macro' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>Macro</button>
            <button onClick={() => setCombinedMode('detailed')}
              className={cn('px-3 py-1 rounded text-[10px] font-semibold transition-all',
                combinedMode === 'detailed' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>Détaillé</button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center gap-5">
          <div className="shrink-0">
            <PieChart size={260}
              slices={combinedMode === 'macro' ? combinedMacro : combinedDetailed}
              label={combinedMode === 'macro' ? 'Travail vs Personnel' : '8 catégories'} />
          </div>
          <div className="flex-1 w-full max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
            <Legend slices={combinedMode === 'macro' ? combinedMacro : combinedDetailed} />
          </div>
        </div>
      </div>
    </div>
  )
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent: 'violet' | 'cyan' }) => (
  <div className={cn('rounded-xl p-3 border bg-zinc-900/50',
    accent === 'violet' ? 'border-violet-500/20' : 'border-cyan-500/20')}>
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
    <p className={cn('text-xl font-extrabold mt-0.5', accent === 'violet' ? 'text-violet-300' : 'text-cyan-300')}>{value}</p>
  </div>
)
