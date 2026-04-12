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

      {/* % breakdown — week & month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PercentCard label="Semaine" travail={t.travail_week_min} personnel={t.personnel_week_min} />
        <PercentCard label="Mois" travail={t.travail_month_min} personnel={t.personnel_month_min} />
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Travail — catégories</h3>
          <div className="grid grid-cols-2 gap-2">
            {TRAVAIL_CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat]; const b = t.by_category[cat] || { minutes: 0 }
              if (!cfg) return null
              return (
                <div key={cat} className={cn('px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2',
                  b.minutes > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30 text-zinc-500')}
                  style={{ borderColor: b.minutes > 0 ? cfg.hex + '60' : '#27272a' }}>
                  <span className="flex items-center gap-1.5 truncate"><span>{cfg.emoji}</span><span className="truncate">{cfg.label}</span></span>
                  <span className="text-xs font-mono font-bold shrink-0" style={{ color: b.minutes > 0 ? cfg.hex : undefined }}>
                    {formatMinutes(b.minutes) || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Personnel — catégories</h3>
          <div className="grid grid-cols-2 gap-2">
            {PERSONNEL_CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat]; const b = t.by_category[cat] || { minutes: 0 }
              if (!cfg) return null
              return (
                <div key={cat} className={cn('px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2',
                  b.minutes > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30 text-zinc-500')}
                  style={{ borderColor: b.minutes > 0 ? cfg.hex + '60' : '#27272a' }}>
                  <span className="flex items-center gap-1.5 truncate"><span>{cfg.emoji}</span><span className="truncate">{cfg.label}</span></span>
                  <span className="text-xs font-mono font-bold shrink-0" style={{ color: b.minutes > 0 ? cfg.hex : undefined }}>
                    {formatMinutes(b.minutes) || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Streak flame component ────────────────────────────────────────────────
const StreakFlame = ({ streak, label, color }: { streak: number; label: string; color: 'violet' | 'cyan' }) => {
  // Intensity: 0=dead, 1-2=low, 3-6=medium, 7-13=high, 14+=blazing
  const intensity = streak === 0 ? 0 : streak <= 2 ? 1 : streak <= 6 ? 2 : streak <= 13 ? 3 : 4
  const flames = intensity === 0 ? 1 : intensity
  const speed = [0, 2.5, 1.8, 1.2, 0.7][intensity]
  const scale = [0.7, 0.85, 1, 1.15, 1.3][intensity]
  const glow = [0, 0, 8, 15, 25][intensity]

  const flameColor = color === 'violet'
    ? { from: '#8b5cf6', to: '#c084fc', glow: 'rgba(139,92,246,' }
    : { from: '#06b6d4', to: '#67e8f9', glow: 'rgba(6,182,212,' }

  return (
    <div className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all',
      color === 'violet'
        ? 'bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20'
        : 'bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20')}
      style={{ boxShadow: glow > 0 ? `0 0 ${glow}px ${flameColor.glow}0.3)` : undefined }}>
      <div className="relative flex items-end justify-center" style={{ width: 28, height: 28, transform: `scale(${scale})` }}>
        {Array.from({ length: flames }).map((_, i) => (
          <div key={i} className="absolute bottom-0"
            style={{
              width: 14 - i * 2,
              height: 20 - i * 3,
              left: '50%',
              transform: `translateX(-50%) translateX(${(i - Math.floor(flames / 2)) * 4}px)`,
              background: `linear-gradient(to top, ${flameColor.from}, ${flameColor.to})`,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              animation: `flicker ${speed}s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
              opacity: 1 - i * 0.15,
            }} />
        ))}
      </div>
      <div>
        <p className={cn('text-2xl font-extrabold', color === 'violet' ? 'text-violet-300' : 'text-cyan-300')}>{streak}</p>
        <p className={cn('text-[9px] uppercase tracking-wider font-semibold', color === 'violet' ? 'text-violet-400/80' : 'text-cyan-400/80')}>
          {streak === 0 ? 'pas de streak' : 'streak'}
        </p>
      </div>
    </div>
  )
}

// ─── Percent breakdown card ────────────────────────────────────────────────
const PercentCard = ({ label, travail, personnel }: { label: string; travail: number; personnel: number }) => {
  const total = travail + personnel
  const pctT = total > 0 ? Math.round((travail / total) * 100) : 0
  const pctP = total > 0 ? 100 - pctT : 0
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
        <p className="text-xs font-mono text-zinc-300">{formatMinutes(total) || '0'}</p>
      </div>
      <div className="h-3 rounded-full bg-zinc-800 overflow-hidden flex">
        {total > 0 && (
          <>
            <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${pctT}%` }} />
            <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${pctP}%` }} />
          </>
        )}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-violet-400 font-semibold">Travail {pctT}%</span>
        <span className="text-[10px] text-cyan-400 font-semibold">Personnel {pctP}%</span>
      </div>
    </div>
  )
}
