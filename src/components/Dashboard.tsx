import { Clock, Activity, CheckCheck } from 'lucide-react'
import type { AppState, Stats } from '@/types'
import { StatCard } from './StatCard'
import { Heatmap } from './Heatmap'
import { formatMinutes, cn, getActiveCategories, getTodoTabs, todayISO } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'

const TAB_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f472b6', '#fb923c']

interface DashboardProps { state: AppState; stats: Stats }

export const Dashboard = ({ state, stats }: DashboardProps) => {
  const t = stats.tracking
  const isMobile = useIsMobile()
  const { CATEGORY_CONFIG } = getActiveCategories(state.meta.custom_categories)
  const todoTabs = getTodoTabs(state.meta.custom_tabs)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        {/* Row 1: Time + Todos count */}
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Total</p>
            <p className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-white to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(139,92,246,0.25)]"
              style={{ letterSpacing: '-0.02em' }}>
              {formatMinutes(t.total_minutes) || '0min'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] flex-wrap">
              {todoTabs.map((tab, i) => (
                <span key={tab.id}>
                  {i > 0 && <span className="text-zinc-600 mr-2">·</span>}
                  <span className="font-semibold" style={{ color: TAB_COLORS[i % TAB_COLORS.length] }}>{formatMinutes(t.by_tab[tab.id]?.total ?? 0) || '0'} {tab.label}</span>
                </span>
              ))}
            </div>
          </div>
          {/* Todos count — top right */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shrink-0">
            <CheckCheck size={16} className="text-emerald-400" />
            <div>
              <p className="text-lg font-extrabold text-emerald-300">{stats.todos.open}</p>
              <p className="text-[7px] text-emerald-400/80 uppercase tracking-wider font-semibold">{stats.todos.urgent} urgents</p>
            </div>
          </div>
        </div>
        {/* Row 2: Streaks with big animated flames */}
        <div className={cn('grid gap-2 mt-3', isMobile ? 'grid-cols-2' : 'grid-cols-3')}>
          {todoTabs.slice(0, 3).map((tab, i) => {
            const streak = t.streaks_by_tab?.[tab.id] ?? 0
            const hex = TAB_COLORS[i % TAB_COLORS.length]
            const intensity = streak === 0 ? 0 : streak <= 2 ? 1 : streak <= 6 ? 2 : streak <= 13 ? 3 : 4
            const speed = [0, 2.5, 1.5, 0.8, 0.4][intensity]
            const glow = [0, 6, 14, 24, 40][intensity]
            const scale = [0.8, 1, 1.1, 1.2, 1.35][intensity]
            return (
              <div key={tab.id} className="flex flex-col items-center justify-center gap-2 py-4">
                <div className="relative w-28 h-28 rounded-full flex items-center justify-center border-2"
                  style={{
                    borderColor: hex + '50',
                    backgroundColor: hex + '10',
                    boxShadow: glow > 0 ? `0 0 ${glow * 1.5}px ${hex}60, inset 0 0 ${glow}px ${hex}20` : undefined,
                  }}>
                  <svg width={56} height={66} viewBox="0 0 32 40" className="shrink-0"
                    style={{ transform: `scale(${scale})`, filter: glow > 8 ? `drop-shadow(0 0 ${glow / 2}px ${hex})` : undefined }}>
                    <defs>
                      <linearGradient id={`fl-${tab.id}`} x1="0.5" y1="1" x2="0.5" y2="0">
                        <stop offset="0%" stopColor={hex} />
                        <stop offset="40%" stopColor={hex} />
                        <stop offset="75%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#fff" />
                      </linearGradient>
                    </defs>
                    <path d="M16 2C16 2 4 15 4 24C4 30 9 36 16 36C23 36 28 30 28 24C28 15 16 2 16 2Z"
                      fill={`url(#fl-${tab.id})`} opacity={streak === 0 ? 0.12 : 0.95}
                      style={speed > 0 ? { animation: `flameWave ${speed}s ease-in-out infinite`, transformOrigin: '16px 36px' } : undefined} />
                    {intensity >= 1 && (
                      <path d="M16 14C16 14 10 23 10 28C10 31.3 12.7 34 16 34C19.3 34 22 31.3 22 28C22 23 16 14 16 14Z"
                        fill="#fef08a" opacity={[0, 0.3, 0.5, 0.65, 0.8][intensity]}
                        style={speed > 0 ? { animation: `flameWave ${speed * 0.6}s ease-in-out infinite`, animationDelay: '0.1s', transformOrigin: '16px 34px' } : undefined} />
                    )}
                    {intensity >= 2 && (
                      <ellipse cx="16" cy="30" rx={[0, 0, 3, 4, 5][intensity]} ry={[0, 0, 2, 3, 3.5][intensity]}
                        fill="white" opacity={[0, 0, 0.4, 0.6, 0.8][intensity]}
                        style={{ animation: `flameWave ${speed * 0.4}s ease-in-out infinite`, animationDelay: '0.05s', transformOrigin: '16px 30px' }} />
                    )}
                  </svg>
                  <span className="absolute -bottom-1 -right-1 min-w-[28px] h-7 px-1.5 rounded-full flex items-center justify-center text-sm font-black border-2"
                    style={{ backgroundColor: '#09090b', borderColor: hex + '80', color: hex }}>
                    {streak}
                  </span>
                </div>
                <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: hex + 'aa' }}>streak</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats grid — moyenne/jour per tab */}
      <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : (todoTabs.length >= 3 ? 'grid-cols-3' : todoTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-1'))}>
        {todoTabs.slice(0, 3).map((tab, i) => {
          const hex = TAB_COLORS[i % TAB_COLORS.length]
          const cats = tab.categoryFilter?.length ? tab.categoryFilter : undefined
          const daysActive = new Set(state.todos.filter(td => td.status === 'done' && td.completed_at && (!cats || cats.includes(td.category))).map(td => td.completed_at!)).size
          const totalMin = state.todos.filter(td => td.status === 'done' && (!cats || cats.includes(td.category))).reduce((s, td) => s + (td.completed_min ?? 0), 0)
          const avg = daysActive > 0 ? Math.round(totalMin / daysActive) : 0
          return (
            <div key={tab.id} className="relative rounded-2xl border bg-zinc-900/60 p-4 transition-all hover:-translate-y-0.5"
              style={{ borderColor: hex + '30' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{tab.emoji} {tab.label} — moy/jour</p>
                <Clock size={14} style={{ color: hex }} />
              </div>
              <p className="text-2xl font-extrabold" style={{ color: hex }}>{formatMinutes(avg) || '0'}</p>
              <p className="text-[10px] text-zinc-500 mt-1 font-medium">{daysActive} jours actifs</p>
            </div>
          )
        })}
      </div>

      {/* Heatmaps — per tab */}
      <div className={cn('grid gap-4', todoTabs.length <= 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
        {todoTabs.map((tab, i) => {
          const hex = TAB_COLORS[i % TAB_COLORS.length]
          const tabGroup = t.by_group[tab.id]
          return (
            <div key={tab.id} className="rounded-2xl border bg-zinc-900/50 p-5" style={{ borderColor: hex + '30' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: hex }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: hex }}>{tab.emoji} {tab.label} — {isMobile ? '3 mois' : '6 mois'}</h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">{formatMinutes(tabGroup?.minutes ?? 0) || '0'} total</span>
              </div>
              <Heatmap todos={state.todos} archive={state.archive} customCategories={state.meta.custom_categories}
                mode="combined" categoryFilter={tab.categoryFilter} colorHex={hex} days={isMobile ? 90 : 182} />
            </div>
          )
        })}
      </div>

      {/* Categories with % — per tab */}
      <div className={cn('grid gap-4', todoTabs.length <= 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
        {todoTabs.map((tab, i) => {
          const hex = TAB_COLORS[i % TAB_COLORS.length]
          const cats = tab.categoryFilter?.length ? tab.categoryFilter : Object.keys(CATEGORY_CONFIG)
          const tabGroup = t.by_group[tab.id]
          const tabMin = tabGroup?.minutes ?? 0
          const globalTotal = Object.values(t.by_group).reduce((s, g) => s + g.minutes, 0)
          const groupPct = globalTotal > 0 ? Math.round((tabMin / globalTotal) * 100) : 0
          return (
          <div key={tab.id} className="rounded-2xl border bg-zinc-900/50 p-5" style={{ borderColor: hex + '30' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{tab.emoji} {tab.label}</h3>
                {groupPct > 0 && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border" style={{ color: hex, borderColor: hex + '40', backgroundColor: hex + '15' }}>{groupPct}%</span>}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{formatMinutes(tabMin) || '0'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cats.map(cat => {
                const cfg = CATEGORY_CONFIG[cat]; const b = t.by_category[cat] || { minutes: 0 }
                if (!cfg) return null
                const pct = tabMin > 0 ? Math.round((b.minutes / tabMin) * 100) : 0
                return (
                  <div key={cat} className={cn('rounded-xl border text-xs font-medium overflow-hidden',
                    b.minutes > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30 text-zinc-500')}
                    style={{ borderColor: b.minutes > 0 ? cfg.hex + '60' : '#27272a' }}>
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{cfg.emoji}</span>
                        {pct > 0 && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border" style={{ color: cfg.hex, borderColor: cfg.hex + '40', backgroundColor: cfg.hex + '15' }}>{pct}%</span>}
                        <span className="truncate">{cfg.label}</span>
                      </span>
                      <span className="text-xs font-mono font-bold shrink-0" style={{ color: b.minutes > 0 ? cfg.hex : undefined }}>
                        {formatMinutes(b.minutes) || '—'}
                      </span>
                    </div>
                    {b.minutes > 0 && (
                      <div className="h-1 bg-zinc-800">
                        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cfg.hex }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}

