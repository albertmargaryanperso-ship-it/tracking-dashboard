import { Clock, Activity, CheckCheck } from 'lucide-react'
import type { AppState, Stats } from '@/types'
import { StatCard } from './StatCard'
import { Heatmap } from './Heatmap'
import { formatMinutes, cn, getActiveCategories } from '@/lib/utils'

interface DashboardProps { state: AppState; stats: Stats }

export const Dashboard = ({ state, stats }: DashboardProps) => {
  const t = stats.tracking
  const { CATEGORY_CONFIG, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES } = getActiveCategories(state.meta.custom_categories)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Aujourd'hui</p>
            <p className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-white to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(139,92,246,0.25)]"
              style={{ letterSpacing: '-0.02em' }}>
              {formatMinutes(t.today_minutes) || '0min'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[11px]">
              <span className="text-violet-400 font-semibold">{formatMinutes(t.travail_today_min) || '0'} travail</span>
              <span className="text-zinc-600">·</span>
              <span className="text-cyan-400 font-semibold">{formatMinutes(t.personnel_today_min) || '0'} perso</span>
            </div>
          </div>
          <div className="flex gap-3">
            <StreakFlame streak={t.streak_travail} label="Streak Travail" color="violet" />
            <StreakFlame streak={t.streak_personnel} label="Streak Personnel" color="cyan" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Travail — semaine" value={formatMinutes(t.travail_week_min) || '0'} sub={`${formatMinutes(t.travail_month_min) || '0'} ce mois`} accent="vault" icon={<Clock size={14} />} />
        <StatCard label="Personnel — semaine" value={formatMinutes(t.personnel_week_min) || '0'} sub={`${formatMinutes(t.personnel_month_min) || '0'} ce mois`} accent="routine" icon={<Activity size={14} />} />
        <StatCard label="Todos ouverts" value={stats.todos.open} sub={`${stats.todos.urgent} urgent${stats.todos.urgent > 1 ? 's' : ''}`} accent="todo" icon={<CheckCheck size={14} />} />
        <StatCard label="Total historique" value={formatMinutes(t.total_minutes) || '0'} sub={`${(state.archive ?? []).length} mois archivés`} accent="neutral" icon={<Clock size={14} />} />
      </div>

      {/* Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-500/20 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-violet-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">Travail — 6 mois</h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{formatMinutes(t.by_group.travail.minutes) || '0'} total</span>
          </div>
          <Heatmap todos={state.todos} archive={state.archive} customCategories={state.meta.custom_categories} mode="travail" days={182} />
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-cyan-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Personnel — 6 mois</h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{t.streak_personnel}j streak</span>
          </div>
          <Heatmap todos={state.todos} archive={state.archive} customCategories={state.meta.custom_categories} mode="personnel" days={182} />
        </div>
      </div>

      {/* Categories with % */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { cats: TRAVAIL_CATEGORIES, label: 'Travail', totalMin: t.by_group.travail.minutes, hex: '#8b5cf6', border: 'border-violet-500/20' },
          { cats: PERSONNEL_CATEGORIES, label: 'Personnel', totalMin: t.by_group.personnel.minutes, hex: '#06b6d4', border: 'border-cyan-500/20' },
        ].map(group => {
          const globalTotal = t.by_group.travail.minutes + t.by_group.personnel.minutes
          const groupPct = globalTotal > 0 ? Math.round((group.totalMin / globalTotal) * 100) : 0
          return (
          <div key={group.label} className={cn('rounded-2xl border bg-zinc-900/50 p-5', group.border)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{group.label}</h3>
                {groupPct > 0 && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border" style={{ color: group.hex, borderColor: group.hex + '40', backgroundColor: group.hex + '15' }}>{groupPct}%</span>}
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{formatMinutes(group.totalMin) || '0'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.cats.map(cat => {
                const cfg = CATEGORY_CONFIG[cat]; const b = t.by_category[cat] || { minutes: 0 }
                if (!cfg) return null
                const pct = group.totalMin > 0 ? Math.round((b.minutes / group.totalMin) * 100) : 0
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

// ─── Streak flame component (animated SVG) ─────────────────────────────────
const StreakFlame = ({ streak, label, color }: { streak: number; label: string; color: 'violet' | 'cyan' }) => {
  const intensity = streak === 0 ? 0 : streak <= 2 ? 1 : streak <= 6 ? 2 : streak <= 13 ? 3 : 4
  const glow = [0, 6, 12, 22, 38][intensity]
  const speed = [0, 3.5, 2.2, 1.4, 0.7][intensity]

  const v = color === 'violet'
  const colors = v
    ? { a: '#7c3aed', b: '#a78bfa', c: '#ddd6fe', glow: 'rgba(139,92,246,', grad: 'from-violet-500/10 to-violet-500/5', border: 'border-violet-500/20', text: 'text-violet-300', sub: 'text-violet-400/80' }
    : { a: '#0891b2', b: '#22d3ee', c: '#cffafe', glow: 'rgba(6,182,212,', grad: 'from-cyan-500/10 to-cyan-500/5', border: 'border-cyan-500/20', text: 'text-cyan-300', sub: 'text-cyan-400/80' }
  const id = `flame-${color}`

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-all bg-gradient-to-br', colors.grad, colors.border)}
      style={{ boxShadow: glow > 0 ? `0 0 ${glow}px ${colors.glow}0.35)` : undefined }}>
      <svg width={26} height={30} viewBox="0 0 32 40" className="shrink-0"
        style={{ filter: glow > 10 ? `drop-shadow(0 0 ${glow / 3}px ${colors.a})` : undefined }}>
        <defs>
          <linearGradient id={id} x1="0.5" y1="1" x2="0.5" y2="0">
            <stop offset="0%" stopColor={colors.a} />
            <stop offset="50%" stopColor={colors.b} />
            <stop offset="100%" stopColor={colors.c} />
          </linearGradient>
        </defs>
        {/* Main flame body */}
        <path d="M16 3C16 3 6 16 6 25C6 30 10.5 34 16 34C21.5 34 26 30 26 25C26 16 16 3 16 3Z"
          fill={`url(#${id})`} opacity={streak === 0 ? 0.2 : 1}
          style={speed > 0 ? { animation: `flameWave ${speed}s ease-in-out infinite`, transformOrigin: '16px 34px' } : undefined} />
        {/* Inner bright core */}
        {intensity >= 1 && (
          <path d="M16 16C16 16 11 24 11 28C11 30.8 13.2 33 16 33C18.8 33 21 30.8 21 28C21 24 16 16 16 16Z"
            fill={colors.c} opacity={[0, 0.3, 0.4, 0.55, 0.7][intensity]}
            style={speed > 0 ? { animation: `flameWave ${speed * 0.7}s ease-in-out infinite`, animationDelay: '0.15s', transformOrigin: '16px 33px' } : undefined} />
        )}
        {/* Hot center for high streaks */}
        {intensity >= 3 && (
          <ellipse cx="16" cy="29" rx="3.5" ry="2.5" fill="white" opacity={0.35}
            style={{ animation: `flameWave ${speed * 0.5}s ease-in-out infinite`, animationDelay: '0.1s', transformOrigin: '16px 29px' }} />
        )}
      </svg>
      <div>
        <p className={cn('text-2xl font-extrabold', colors.text)}>{streak}</p>
        <p className={cn('text-[9px] uppercase tracking-wider font-semibold', colors.sub)}>
          {streak === 0 ? 'pas de streak' : 'streak'}
        </p>
      </div>
    </div>
  )
}
