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
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-br from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                {formatMinutes(t.today_minutes) || '0min'}
              </span>
              <span className="text-xs text-zinc-500">
                travail <span className="text-violet-400 font-semibold">{formatMinutes(t.travail_today_min) || '0'}</span> ·
                personnel <span className="text-cyan-400 font-semibold">{formatMinutes(t.personnel_today_min) || '0'}</span>
              </span>
            </div>
            {t.today_minutes > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden flex">
                  <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${t.today_minutes > 0 ? Math.round((t.travail_today_min / t.today_minutes) * 100) : 0}%` }} />
                  <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${t.today_minutes > 0 ? Math.round((t.personnel_today_min / t.today_minutes) * 100) : 0}%` }} />
                </div>
                <span className="text-[10px] font-mono text-violet-300 shrink-0">{t.today_minutes > 0 ? Math.round((t.travail_today_min / t.today_minutes) * 100) : 0}%</span>
                <span className="text-[10px] font-mono text-cyan-300 shrink-0">{t.today_minutes > 0 ? Math.round((t.personnel_today_min / t.today_minutes) * 100) : 0}%</span>
              </div>
            )}
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
          { cats: TRAVAIL_CATEGORIES, label: 'Travail — catégories', totalMin: t.by_group.travail.minutes, borderColor: 'border-zinc-800' },
          { cats: PERSONNEL_CATEGORIES, label: 'Personnel — catégories', totalMin: t.by_group.personnel.minutes, borderColor: 'border-zinc-800' },
        ].map(group => (
          <div key={group.label} className={cn('rounded-2xl border bg-zinc-900/50 p-5', group.borderColor)}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{group.label}</h3>
              <span className="text-[10px] text-zinc-500 font-mono">{formatMinutes(group.totalMin) || '0'} total</span>
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
        ))}
      </div>
    </div>
  )
}

// ─── Streak flame component (emoji + glow) ─────────────────────────────────
const StreakFlame = ({ streak, label, color }: { streak: number; label: string; color: 'violet' | 'cyan' }) => {
  const intensity = streak === 0 ? 0 : streak <= 2 ? 1 : streak <= 6 ? 2 : streak <= 13 ? 3 : 4
  const glowSize = [0, 8, 15, 25, 40][intensity]
  const pulseSpeed = [0, 4, 2.5, 1.5, 0.8][intensity]
  const emojiSize = ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'][intensity]

  const c = color === 'violet'
    ? { hex: '#8b5cf6', glow: 'rgba(139,92,246,', grad: 'from-violet-500/10 to-violet-500/5', border: 'border-violet-500/20', text: 'text-violet-300', sub: 'text-violet-400/80' }
    : { hex: '#06b6d4', glow: 'rgba(6,182,212,', grad: 'from-cyan-500/10 to-cyan-500/5', border: 'border-cyan-500/20', text: 'text-cyan-300', sub: 'text-cyan-400/80' }

  return (
    <div className={cn('flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all bg-gradient-to-br', c.grad, c.border)}
      style={{ boxShadow: glowSize > 0 ? `0 0 ${glowSize}px ${c.glow}0.4)` : undefined }}>
      <span className={cn(emojiSize, 'transition-all')}
        style={pulseSpeed > 0 ? {
          animation: `flicker ${pulseSpeed}s ease-in-out infinite`,
          filter: glowSize > 10 ? `drop-shadow(0 0 ${glowSize / 2}px ${c.hex})` : undefined,
        } : { opacity: 0.3 }}>
        🔥
      </span>
      <div>
        <p className={cn('text-2xl font-extrabold', c.text)}>{streak}</p>
        <p className={cn('text-[9px] uppercase tracking-wider font-semibold', c.sub)}>
          {streak === 0 ? 'pas de streak' : 'streak'}
        </p>
      </div>
    </div>
  )
}
