import { Flame, TrendingUp, Target, Zap, CheckCheck, Clock, BookOpen, Activity } from 'lucide-react'
import type { AppState, Stats } from '@/types'
import { StatCard } from './StatCard'
import { Heatmap } from './Heatmap'
import { formatHours, habitIcon, habitColor, cn } from '@/lib/utils'

interface DashboardProps {
  state: AppState
  stats: Stats
}

export const Dashboard = ({ state, stats }: DashboardProps) => {
  const totalStreak = Math.max(stats.vault.streak_days, stats.routine.streak_days)

  return (
    <div className="space-y-6">
      {/* Hero — combined streak + today */}
      <div className="relative rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Aujourd'hui</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-br from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                {formatHours(stats.vault.today_hours + stats.routine.today_hours)}
              </span>
              <span className="text-xs text-zinc-500">
                travail <span className="text-violet-400 font-semibold">{formatHours(stats.vault.today_hours)}</span> ·
                personnel <span className="text-cyan-400 font-semibold"> {formatHours(stats.routine.today_hours)}</span>
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Intensité : <span className="font-semibold text-zinc-200">{stats.routine.today_intensity}</span>
            </p>
          </div>

          {/* Streak */}
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-rose-500/10 border border-orange-500/20">
            <Flame className="text-orange-400" size={32} />
            <div>
              <p className="text-3xl font-extrabold text-orange-300">{totalStreak}</p>
              <p className="text-[10px] text-orange-400/80 uppercase tracking-wider font-semibold">jour{totalStreak > 1 ? 's' : ''} d'affilée</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Travail — semaine"
          value={formatHours(stats.vault.week_hours)}
          sub={`${formatHours(stats.vault.month_hours)} ce mois`}
          accent="vault"
          icon={<Clock size={14} />}
        />
        <StatCard
          label="Personnel — semaine"
          value={formatHours(stats.routine.week_hours)}
          sub={`${formatHours(stats.routine.month_hours)} ce mois`}
          accent="routine"
          icon={<Activity size={14} />}
        />
        <StatCard
          label="Todos ouverts"
          value={stats.todos.open}
          sub={`${stats.todos.urgent} urgent${stats.todos.urgent > 1 ? 's' : ''}`}
          accent="todo"
          icon={<CheckCheck size={14} />}
        />
        <StatCard
          label="Projets actifs"
          value={stats.vault.active_projects}
          sub={stats.vault.top_project ? `#1 ${stats.vault.top_project.name.slice(0, 18)}…` : '—'}
          accent="neutral"
          icon={<Target size={14} />}
        />
      </div>

      {/* Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-500/20 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-violet-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">Travail — 6 mois</h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{formatHours(stats.vault.total_hours)} total</span>
          </div>
          <Heatmap sessions={state.sessions} routine={state.routine} mode="vault" days={182} />
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-cyan-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Personnel — 6 mois</h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{stats.routine.streak_days}j streak</span>
          </div>
          <Heatmap sessions={state.sessions} routine={state.routine} mode="routine" days={182} />
        </div>
      </div>

      {/* Top projects + habitudes aujourd'hui */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top projects */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-violet-400" size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Top projets</h3>
          </div>
          <TopProjectsList state={state} />
        </div>

        {/* Habitudes aujourd'hui */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-cyan-400" size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Habitudes aujourd'hui</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stats.routine.habits_today).map(([name, hours]) => {
              const active = hours > 0
              const color = habitColor(name)
              return (
                <div
                  key={name}
                  className={cn(
                    'px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2',
                    active ? 'bg-zinc-900/70' : 'bg-zinc-900/30 text-zinc-500',
                  )}
                  style={{ borderColor: active ? color + '60' : '#27272a' }}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{habitIcon(name)}</span>
                    <span className="truncate">{name}</span>
                  </span>
                  <span
                    className="text-xs font-mono font-bold shrink-0"
                    style={{ color: active ? color : undefined }}
                  >
                    {active ? formatHours(hours) : '—'}
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

const TopProjectsList = ({ state }: { state: AppState }) => {
  const byProject: Record<string, number> = {}
  for (const s of state.sessions) byProject[s.project] = (byProject[s.project] ?? 0) + s.hours
  const sorted = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = sorted[0]?.[1] ?? 1

  if (sorted.length === 0) {
    return <p className="text-xs text-zinc-500 text-center py-4">Aucune session enregistrée</p>
  }

  return (
    <ul className="space-y-2.5">
      {sorted.map(([name, hours]) => (
        <li key={name}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-300 truncate pr-2">{name}</span>
            <span className="text-violet-400 font-mono font-semibold shrink-0">{formatHours(hours)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
              style={{ width: `${(hours / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Unused imports avoided by referencing them
void BookOpen
