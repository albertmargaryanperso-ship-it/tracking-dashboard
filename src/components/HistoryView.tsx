import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Calendar, Clock, TrendingUp, Award } from 'lucide-react'
import type { AppState, ArchiveMonth, TodoCategory, CategoryConfig } from '@/types'
import { cn, formatMinutes, categoryGroup, todayISO, getActiveCategories } from '@/lib/utils'

interface HistoryViewProps { state: AppState }

const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const fmtMonth = (m: string): string => {
  const [y, mm] = m.split('-')
  return `${MONTH_NAMES[parseInt(mm, 10)] ?? mm} ${y}`
}

export const HistoryView = ({ state }: HistoryViewProps) => {
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const archive = useMemo(() => [...(state.archive ?? [])].sort((a, b) => b.month.localeCompare(a.month)), [state.archive])

  const last30Days = useMemo(() => {
    const todayStr = todayISO()
    const todayDate = new Date(todayStr + 'T12:00:00')
    const days: { date: string; travail: number; personnel: number }[] = []
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayDate)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().split('T')[0]
      days.push({ date: iso, travail: 0, personnel: 0 })
    }
    
    const map = new Map(days.map(d => [d.date, d]))
    
    const processTodo = (t: any) => {
      if (!t.completed_at || !t.completed_min) return
      const iso = t.completed_at.slice(0, 10)
      const day = map.get(iso)
      if (day) {
        if (categoryGroup(t.category, state.meta.custom_categories) === 'travail') day.travail += t.completed_min
        else day.personnel += t.completed_min
      }
    }
    
    state.todos.forEach(t => { if (t.status === 'done') processTodo(t) })
    state.archive?.forEach(a => { a.todos.forEach(processTodo) })

    return days
  }, [state.todos, state.archive])

  const maxDayMin = Math.max(1, ...last30Days.map(d => d.travail + d.personnel))

  if (archive.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl mb-4">📜</div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Aucun historique</h2>
        <p className="text-[11px] text-zinc-500 max-w-sm">
          Les todos terminées sont archivées automatiquement au début de chaque mois.
          Complète des tâches ce mois-ci — elles apparaîtront ici le mois prochain.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats across all archived months */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HistStat label="Mois archivés" value={String(archive.length)} icon={<Calendar size={14} />} />
        <HistStat label="Todos archivées" value={String(archive.reduce((s, a) => s + a.todos.length, 0))} icon={<TrendingUp size={14} />} />
        <HistStat label="Heures totales" value={formatMinutes(archive.reduce((s, a) => s + (a.stats?.total_minutes ?? 0), 0)) || '0'} icon={<Clock size={14} />} />
        <HistStat label="Travail / Personnel" value={`${formatMinutes(archive.reduce((s, a) => s + (a.stats?.travail_minutes ?? 0), 0)) || '0'} / ${formatMinutes(archive.reduce((s, a) => s + (a.stats?.personnel_minutes ?? 0), 0)) || '0'}`} icon={<Award size={14} />} />
      </div>

      {/* 30-Day Activity Chart */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">Activité des 30 derniers jours</h3>
          <div className="flex gap-3 text-[10px] font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Travail</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Personnel</span>
          </div>
        </div>
        
        <div className="flex items-end gap-1 h-32 pt-2">
          {last30Days.map((day, i) => {
            const hT = (day.travail / maxDayMin) * 100
            const hP = (day.personnel / maxDayMin) * 100
            const isToday = i === last30Days.length - 1
            return (
              <div key={day.date} className="flex-1 flex flex-col justify-end gap-0.5 group relative" title={`${day.date}: ${day.travail}m travail / ${day.personnel}m perso`}>
                <div className="w-full bg-cyan-500/80 rounded-t-sm transition-all group-hover:bg-cyan-400" style={{ height: `${hP}%` }} />
                <div className={cn("w-full bg-violet-500/80 rounded-b-sm transition-all group-hover:bg-violet-400", isToday && 'ring-1 ring-emerald-500 ring-offset-1 ring-offset-zinc-900')} style={{ height: `${hT}%` }} />
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max bg-zinc-800 border border-zinc-700 text-[10px] p-2 rounded shadow-xl whitespace-nowrap">
                  <p className="font-bold text-zinc-300 mb-1">{day.date.split('-').reverse().join('/')}</p>
                  <p className="text-violet-300 font-mono">Travail: {formatMinutes(day.travail) || '0'}</p>
                  <p className="text-cyan-300 font-mono">Perso:   {formatMinutes(day.personnel) || '0'}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-zinc-500 font-mono">
          <span>{last30Days[0].date.split('-').reverse().slice(0, 2).join('/')}</span>
          <span>Aujourd'hui</span>
        </div>
      </div>

      {/* Monthly cards */}
      {archive.map((entry, idx) => {
        const isOpen = openMonth === entry.month
        const prev = idx + 1 < archive.length ? archive[idx + 1] : null
        return (
          <MonthCard key={entry.month} entry={entry} prev={prev} isOpen={isOpen}
            onToggle={() => setOpenMonth(isOpen ? null : entry.month)} customCategories={state.meta.custom_categories} />
        )
      })}
    </div>
  )
}

// ─── Month card ─────────────────────────────────────────────────────────────
const MonthCard = ({ entry, prev, isOpen, onToggle, customCategories }: {
  entry: ArchiveMonth; prev: ArchiveMonth | null; isOpen: boolean; onToggle: () => void; customCategories?: CategoryConfig[]
}) => {
  const { CATEGORY_CONFIG, CATEGORY_LIST, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES } = getActiveCategories(customCategories)
  const s = entry.stats
  const ratio = s.total_minutes > 0 ? Math.round((s.travail_minutes / s.total_minutes) * 100) : 0

  // Delta vs previous month
  const deltaTravail = prev ? s.travail_minutes - (prev.stats?.travail_minutes ?? 0) : 0
  const deltaPersonnel = prev ? s.personnel_minutes - (prev.stats?.personnel_minutes ?? 0) : 0

  // Best category
  const bestCat = CATEGORY_LIST.reduce<{ cat: TodoCategory; min: number } | null>((best, cat) => {
    const m = s.by_category?.[cat]?.minutes ?? 0
    return (!best || m > best.min) ? { cat, min: m } : best
  }, null)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 hover:bg-zinc-900/70 transition-all">
        {isOpen ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-zinc-200">{fmtMonth(entry.month)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {entry.todos.length} tâches · {formatMinutes(s.total_minutes) || '0'} · {s.days_active}j actifs
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold text-violet-300">
            {formatMinutes(s.travail_minutes) || '0'}
          </span>
          <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-semibold text-cyan-300">
            {formatMinutes(s.personnel_minutes) || '0'}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-4">
          {/* Cross stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniStat label="Ratio Travail" value={`${ratio}%`} />
            <MiniStat label="Jour top" value={s.best_day ? `${s.best_day.date.split('-').reverse().join('/')} (${formatMinutes(s.best_day.minutes)})` : '—'} />
            <MiniStat label="Delta Travail" value={deltaTravail === 0 ? '=' : `${deltaTravail > 0 ? '+' : ''}${formatMinutes(deltaTravail)}`}
              color={deltaTravail > 0 ? 'text-emerald-400' : deltaTravail < 0 ? 'text-rose-400' : undefined} />
            <MiniStat label="Delta Personnel" value={deltaPersonnel === 0 ? '=' : `${deltaPersonnel > 0 ? '+' : ''}${formatMinutes(deltaPersonnel)}`}
              color={deltaPersonnel > 0 ? 'text-emerald-400' : deltaPersonnel < 0 ? 'text-rose-400' : undefined} />
          </div>

          {/* Category bars */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Heures par catégorie</p>
            <div className="space-y-1.5">
              {CATEGORY_LIST.map(cat => {
                const cfg = CATEGORY_CONFIG[cat]
                const data = s.by_category?.[cat]
                const min = data?.minutes ?? 0
                const count = data?.count ?? 0
                const maxMin = Math.max(1, ...CATEGORY_LIST.map(c => s.by_category?.[c]?.minutes ?? 0))
                const pct = (min / maxMin) * 100
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-sm w-5 text-center">{cfg.emoji}</span>
                    <span className="text-[10px] text-zinc-400 w-24 truncate">{cfg.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.hex }} />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 w-12 text-right">{formatMinutes(min) || '—'}</span>
                    <span className="text-[9px] text-zinc-600 w-8 text-right">{count}x</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Todos by category */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Détail des tâches</p>
            {[...TRAVAIL_CATEGORIES, ...PERSONNEL_CATEGORIES].map(cat => {
              const cfg = CATEGORY_CONFIG[cat]
              const catTodos = entry.todos.filter(t => t.category === cat).sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''))
              if (catTodos.length === 0) return null
              return (
                <div key={cat} className="mb-3">
                  <p className={cn('text-[10px] font-semibold mb-1', cfg.color)}>{cfg.emoji} {cfg.label} ({catTodos.length})</p>
                  <div className="space-y-0.5">
                    {catTodos.map(t => (
                      <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/50 text-[10px]">
                        <span className="text-zinc-500 w-16 shrink-0 font-mono">{t.completed_at?.split('-').reverse().join('/') ?? ''}</span>
                        <span className="flex-1 text-zinc-300 truncate">{t.text}</span>
                        {t.completed_min ? <span className="text-emerald-400 font-mono shrink-0">{formatMinutes(t.completed_min)}</span> : null}
                        {t.priority === 'urgent' && <span className="text-[8px] text-rose-400">URGENT</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const MiniStat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
    <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
    <p className={cn('text-xs font-bold mt-0.5', color ?? 'text-zinc-300')}>{value}</p>
  </div>
)

const HistStat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex items-center gap-3">
    <div className="text-zinc-500">{icon}</div>
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p className="text-lg font-extrabold text-zinc-200">{value}</p>
    </div>
  </div>
)
