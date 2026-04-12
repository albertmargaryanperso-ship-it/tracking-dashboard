import { Flame, Clock, Activity, CheckCheck } from 'lucide-react'
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
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20">
              <Flame className="text-violet-400" size={24} />
              <div>
                <p className="text-2xl font-extrabold text-violet-300">{t.streak_travail}</p>
                <p className="text-[9px] text-violet-400/80 uppercase tracking-wider font-semibold">travail</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
              <Flame className="text-cyan-400" size={24} />
              <div>
                <p className="text-2xl font-extrabold text-cyan-300">{t.streak_personnel}</p>
                <p className="text-[9px] text-cyan-400/80 uppercase tracking-wider font-semibold">personnel</p>
              </div>
            </div>
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
          <Heatmap todos={state.todos} mode="travail" days={182} />
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-cyan-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Personnel — 6 mois</h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{t.streak_personnel}j streak</span>
          </div>
          <Heatmap todos={state.todos} mode="personnel" days={182} />
        </div>
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
