import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Calendar, Clock, TrendingUp, Award } from 'lucide-react'
import type { AppState, ArchiveMonth, Todo, TodoCategory, CategoryConfig, CategoryGroup } from '@/types'
import { cn, formatMinutes, categoryGroup, todayISO, getActiveCategories } from '@/lib/utils'

interface HistoryViewProps { state: AppState }

const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const fmtMonth = (m: string): string => { const [y, mm] = m.split('-'); return `${MONTH_NAMES[parseInt(mm, 10)] ?? mm} ${y}` }

const GROUP_META: Record<CategoryGroup, { label: string; emoji: string; color: string; border: string; bg: string; hex: string }> = {
  travail: { label: 'Travail', emoji: '💼', color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/5', hex: '#8b5cf6' },
  personnel: { label: 'Personnel', emoji: '🧘', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/5', hex: '#06b6d4' },
}

export const HistoryView = ({ state }: HistoryViewProps) => {
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const [currentMonthOpen, setCurrentMonthOpen] = useState(false)
  const archive = useMemo(() => [...(state.archive ?? [])].sort((a, b) => b.month.localeCompare(a.month)), [state.archive])

  const monthProgress = useMemo(() => {
    const today = new Date()
    const dayOfMonth = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - dayOfMonth
    const pct = Math.round((dayOfMonth / daysInMonth) * 100)
    const monthStr = `${MONTH_NAMES[today.getMonth() + 1]} ${today.getFullYear()}`
    return { dayOfMonth, daysInMonth, daysLeft, pct, monthStr }
  }, [])

  // Source unique : getActiveCategories
  const { CATEGORY_CONFIG, CATEGORY_LIST, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES } = getActiveCategories(state.meta.custom_categories)

  // Current month data grouped
  const currentMonthData = useMemo(() => {
    const currentMonth = todayISO().slice(0, 7)
    const doneTodos = state.todos.filter(t => t.status === 'done' && t.completed_at?.startsWith(currentMonth))
    const byCategory: Record<string, { minutes: number; count: number; open: number; todos: Todo[] }> = {}
    for (const cat of CATEGORY_LIST) byCategory[cat] = { minutes: 0, count: 0, open: 0, todos: [] }
    for (const t of doneTodos) {
      if (!byCategory[t.category]) byCategory[t.category] = { minutes: 0, count: 0, open: 0, todos: [] }
      byCategory[t.category].minutes += t.completed_min ?? 0
      byCategory[t.category].count += 1
      byCategory[t.category].todos.push(t)
    }
    for (const t of state.todos) {
      if (t.status !== 'done' && byCategory[t.category]) byCategory[t.category].open += 1
    }
    const totalMin = doneTodos.reduce((s, t) => s + (t.completed_min ?? 0), 0)
    const travailMin = doneTodos.filter(t => TRAVAIL_CATEGORIES.includes(t.category)).reduce((s, t) => s + (t.completed_min ?? 0), 0)
    const personnelMin = totalMin - travailMin
    return { byCategory, totalMin, travailMin, personnelMin, doneCount: doneTodos.length }
  }, [state.todos, CATEGORY_LIST, TRAVAIL_CATEGORIES])

  // 30-day chart
  const last30Days = useMemo(() => {
    const todayStr = todayISO()
    const todayDate = new Date(todayStr + 'T12:00:00')
    const days: { date: string; travail: number; personnel: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayDate); d.setDate(d.getDate() - i)
      days.push({ date: d.toISOString().split('T')[0], travail: 0, personnel: 0 })
    }
    const map = new Map(days.map(d => [d.date, d]))
    const process = (t: any) => {
      if (!t.completed_at || !t.completed_min) return
      const day = map.get(t.completed_at.slice(0, 10))
      if (day) { if (categoryGroup(t.category, state.meta.custom_categories) === 'travail') day.travail += t.completed_min; else day.personnel += t.completed_min }
    }
    state.todos.forEach(t => { if (t.status === 'done') process(t) })
    state.archive?.forEach(a => a.todos.forEach(process))
    return days
  }, [state.todos, state.archive])
  const maxDayMin = Math.max(1, ...last30Days.map(d => d.travail + d.personnel))

  // Build group data for any set of todos
  const buildGroupData = (todos: Todo[], totalMin: number) => {
    const groups: Array<{ group: CategoryGroup; categories: string[]; minutes: number; pct: number; catData: Record<string, { minutes: number; count: number; todos: Todo[] }> }> = []
    for (const [grp, cats] of [['travail', TRAVAIL_CATEGORIES], ['personnel', PERSONNEL_CATEGORIES]] as const) {
      let grpMin = 0
      const catData: Record<string, { minutes: number; count: number; todos: Todo[] }> = {}
      for (const cat of cats) {
        const catTodos = todos.filter(t => t.category === cat)
        const min = catTodos.reduce((s, t) => s + (t.completed_min ?? 0), 0)
        catData[cat] = { minutes: min, count: catTodos.length, todos: catTodos }
        grpMin += min
      }
      groups.push({ group: grp, categories: cats, minutes: grpMin, pct: totalMin > 0 ? Math.round((grpMin / totalMin) * 100) : 0, catData })
    }
    return groups
  }

  return (
    <div className="space-y-4">
      {/* Current month — collapsible */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <button onClick={() => setCurrentMonthOpen(o => !o)} className="w-full p-4 flex items-center gap-3 hover:bg-zinc-900/70 transition-all">
          {currentMonthOpen ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-zinc-200">{monthProgress.monthStr} <span className="text-zinc-500 font-normal text-[10px]">— mois en cours</span></p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Jour {monthProgress.dayOfMonth}/{monthProgress.daysInMonth} — {monthProgress.daysLeft}j restants</p>
          </div>
          <span className="text-xl font-extrabold text-zinc-200">{monthProgress.pct}%</span>
        </button>
        <div className="px-4 pb-3">
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-500" style={{ width: `${monthProgress.pct}%` }} />
          </div>
          <p className="text-[9px] text-zinc-600 mt-1">Archivage automatique au 1er du mois suivant.</p>
        </div>

        {/* Level 2: Travail / Personnel groups */}
        {currentMonthOpen && (
          <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
            {buildGroupData(
              state.todos.filter(t => t.status === 'done' && t.completed_at?.startsWith(todayISO().slice(0, 7))),
              currentMonthData.totalMin
            ).map(g => (
              <GroupAccordion key={g.group} group={g.group} groupMin={g.minutes} groupPct={g.pct} totalMin={currentMonthData.totalMin}
                categories={g.categories} catData={g.catData} config={CATEGORY_CONFIG} showOpen currentMonthCats={currentMonthData.byCategory} />
            ))}
            {currentMonthData.doneCount === 0 && <p className="text-[10px] text-zinc-600 italic text-center py-2">Aucune tâche terminée ce mois-ci.</p>}
          </div>
        )}
      </div>

      {/* Summary stats */}
      {archive.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HistStat label="Mois archivés" value={String(archive.length)} icon={<Calendar size={14} />} />
          <HistStat label="Todos archivées" value={String(archive.reduce((s, a) => s + a.todos.length, 0))} icon={<TrendingUp size={14} />} />
          <HistStat label="Heures totales" value={formatMinutes(archive.reduce((s, a) => s + (a.stats?.total_minutes ?? 0), 0)) || '0'} icon={<Clock size={14} />} />
          <HistStat label="Travail / Personnel" value={`${formatMinutes(archive.reduce((s, a) => s + (a.stats?.travail_minutes ?? 0), 0)) || '0'} / ${formatMinutes(archive.reduce((s, a) => s + (a.stats?.personnel_minutes ?? 0), 0)) || '0'}`} icon={<Award size={14} />} />
        </div>
      )}

      {/* 30-Day Heatmap compact */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">30 derniers jours</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-500">Moins</span>
            <span className="w-3 h-3 rounded-[3px] bg-zinc-800/60" />
            <span className="w-3 h-3 rounded-[3px] bg-violet-500/30" />
            <span className="w-3 h-3 rounded-[3px] bg-violet-500/60" />
            <span className="w-3 h-3 rounded-[3px] bg-violet-500" />
            <span className="w-3 h-3 rounded-[3px] bg-amber-500" />
            <span className="text-[9px] text-zinc-500">Plus</span>
          </div>
        </div>
        <div className="flex gap-[3px] flex-wrap">
          {last30Days.map((day, i) => {
            const total = day.travail + day.personnel
            const hours = total / 60
            const isToday = i === last30Days.length - 1
            const bg = total === 0 ? 'bg-zinc-800/60'
              : hours < 0.5 ? 'bg-violet-500/20'
              : hours < 1.5 ? 'bg-violet-500/40'
              : hours < 3 ? 'bg-violet-500/70'
              : hours < 5 ? 'bg-violet-500'
              : 'bg-amber-500'
            return (
              <div key={day.date} className={cn('w-[calc((100%-87px)/30)] aspect-square min-w-[10px] rounded-[3px] group relative transition-all hover:scale-150 hover:z-10', bg, isToday && 'ring-1 ring-emerald-400')}
                title={`${day.date.split('-').reverse().join('/')}: ${formatMinutes(total) || '0'}`}>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-max bg-zinc-800 border border-zinc-700 text-[10px] p-2 rounded shadow-xl">
                  <p className="font-bold text-zinc-300">{day.date.split('-').reverse().join('/')}</p>
                  <p className="text-violet-300 font-mono">{formatMinutes(day.travail) || '0'} travail</p>
                  <p className="text-cyan-300 font-mono">{formatMinutes(day.personnel) || '0'} perso</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Archived months */}
      {archive.map((entry, idx) => {
        const prev = idx + 1 < archive.length ? archive[idx + 1] : null
        return (
          <ArchivedMonthCard key={entry.month} entry={entry} prev={prev}
            isOpen={openMonth === entry.month}
            onToggle={() => setOpenMonth(openMonth === entry.month ? null : entry.month)}
            customCategories={state.meta.custom_categories} />
        )
      })}
    </div>
  )
}

// ─── Group accordion (Travail / Personnel) ─────────────────────────────────
const GroupAccordion = ({ group, groupMin, groupPct, totalMin, categories, catData, config, showOpen, currentMonthCats }: {
  group: CategoryGroup; groupMin: number; groupPct: number; totalMin: number
  categories: string[]; catData: Record<string, { minutes: number; count: number; todos: Todo[] }>
  config: Record<string, CategoryConfig>; showOpen?: boolean
  currentMonthCats?: Record<string, { open: number }>
}) => {
  const [expanded, setExpanded] = useState(false)
  const meta = GROUP_META[group]

  return (
    <div className={cn('rounded-xl border overflow-hidden', meta.border, meta.bg)}>
      <button onClick={() => setExpanded(o => !o)} className="w-full px-3 py-3 flex items-center justify-between gap-2 hover:bg-zinc-800/30 transition-all">
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown size={12} className="text-zinc-400" /> : <ChevronRight size={12} className="text-zinc-400" />}
          <span className="text-sm">{meta.emoji}</span>
          {groupPct > 0 && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border" style={{ color: meta.hex, borderColor: meta.hex + '40', backgroundColor: meta.hex + '15' }}>{groupPct}%</span>}
          <span className={cn('text-[12px] font-bold', meta.color)}>{meta.label}</span>
        </span>
        <span className="text-sm font-mono font-bold" style={{ color: groupMin > 0 ? meta.hex : '#71717a' }}>
          {formatMinutes(groupMin) || '—'}
        </span>
      </button>
      {groupMin > 0 && (
        <div className="h-1 bg-zinc-800/50">
          <div className="h-full transition-all duration-300" style={{ width: `${groupPct}%`, backgroundColor: meta.hex }} />
        </div>
      )}

      {/* Level 3: Individual categories */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-1.5">
          {categories.map(cat => {
            const cfg = config[cat]; const data = catData[cat]
            if (!cfg) return null
            const catPct = groupMin > 0 ? Math.round(((data?.minutes ?? 0) / groupMin) * 100) : 0
            const openCount = showOpen ? (currentMonthCats?.[cat]?.open ?? 0) : 0
            return (
              <CategoryAccordion key={cat} cfg={cfg} pct={catPct} minutes={data?.minutes ?? 0}
                count={data?.count ?? 0} open={openCount} todos={data?.todos ?? []} />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Category accordion ────────────────────────────────────────────────────
const CategoryAccordion = ({ cfg, pct, minutes, count, open, todos }: {
  cfg: CategoryConfig; pct: number; minutes: number; count: number; open: number; todos: Todo[]
}) => {
  const [expanded, setExpanded] = useState(false)
  const hasTodos = todos.length > 0

  return (
    <div className={cn('rounded-lg border overflow-hidden', minutes > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30')}
      style={{ borderColor: minutes > 0 ? cfg.hex + '40' : '#27272a' }}>
      <button onClick={() => hasTodos && setExpanded(o => !o)}
        className={cn('w-full px-2.5 py-2 flex items-center justify-between gap-2 transition-all text-[11px]', hasTodos && 'hover:bg-zinc-800/50')}>
        <span className="flex items-center gap-1.5">
          {hasTodos && (expanded ? <ChevronDown size={9} className="text-zinc-500" /> : <ChevronRight size={9} className="text-zinc-500" />)}
          <span>{cfg.emoji}</span>
          {pct > 0 && <span className="px-1 py-0.5 rounded text-[9px] font-bold border" style={{ color: cfg.hex, borderColor: cfg.hex + '40', backgroundColor: cfg.hex + '15' }}>{pct}%</span>}
          <span className="font-semibold text-zinc-300">{cfg.label}</span>
          {open > 0 && <span className="text-[8px] text-zinc-500">{open} ouv.</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {count > 0 && <span className="text-[9px] text-zinc-500">{count}x</span>}
          <span className="text-[11px] font-mono font-bold" style={{ color: minutes > 0 ? cfg.hex : '#71717a' }}>
            {formatMinutes(minutes) || '—'}
          </span>
        </div>
      </button>
      {minutes > 0 && <div className="h-0.5 bg-zinc-800"><div className="h-full" style={{ width: `${pct}%`, backgroundColor: cfg.hex }} /></div>}
      {expanded && (
        <div className="px-2.5 pb-2 pt-1 space-y-0.5">
          {todos.sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? '')).map(t => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-900/50 text-[10px]">
              <span className="text-zinc-500 w-14 shrink-0 font-mono">{t.completed_at?.split('-').reverse().join('/') ?? ''}</span>
              <span className="flex-1 text-zinc-300 truncate">{t.text}</span>
              {t.completed_min ? <span className="text-emerald-400 font-mono shrink-0">{formatMinutes(t.completed_min)}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Archived month card ───────────────────────────────────────────────────
const ArchivedMonthCard = ({ entry, prev, isOpen, onToggle, customCategories }: {
  entry: ArchiveMonth; prev: ArchiveMonth | null; isOpen: boolean; onToggle: () => void; customCategories?: CategoryConfig[]
}) => {
  const { CATEGORY_CONFIG, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES } = getActiveCategories(customCategories)
  const s = entry.stats

  const groups = useMemo(() => {
    const result: Array<{ group: CategoryGroup; categories: string[]; minutes: number; pct: number; catData: Record<string, { minutes: number; count: number; todos: Todo[] }> }> = []
    for (const [grp, cats] of [['travail', TRAVAIL_CATEGORIES], ['personnel', PERSONNEL_CATEGORIES]] as const) {
      let grpMin = 0
      const catData: Record<string, { minutes: number; count: number; todos: Todo[] }> = {}
      for (const cat of cats) {
        const catTodos = entry.todos.filter(t => t.category === cat)
        const min = catTodos.reduce((s, t) => s + (t.completed_min ?? 0), 0)
        catData[cat] = { minutes: min, count: catTodos.length, todos: catTodos }
        grpMin += min
      }
      result.push({ group: grp, categories: cats, minutes: grpMin, pct: s.total_minutes > 0 ? Math.round((grpMin / s.total_minutes) * 100) : 0, catData })
    }
    return result
  }, [entry, TRAVAIL_CATEGORIES, PERSONNEL_CATEGORIES])

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 hover:bg-zinc-900/70 transition-all">
        {isOpen ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-zinc-200">{fmtMonth(entry.month)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{entry.todos.length} tâches · {formatMinutes(s.total_minutes) || '0'} · {s.days_active}j actifs</p>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold text-violet-300">{formatMinutes(s.travail_minutes) || '0'}</span>
          <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-semibold text-cyan-300">{formatMinutes(s.personnel_minutes) || '0'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
          {prev && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <MiniStat label="Ratio Travail" value={s.total_minutes > 0 ? `${Math.round((s.travail_minutes / s.total_minutes) * 100)}%` : '—'} />
              <MiniStat label="Jour top" value={s.best_day ? `${s.best_day.date.split('-').reverse().join('/')} (${formatMinutes(s.best_day.minutes)})` : '—'} />
              <MiniStat label="Δ Travail" value={`${(s.travail_minutes - (prev.stats?.travail_minutes ?? 0)) >= 0 ? '+' : ''}${formatMinutes(s.travail_minutes - (prev.stats?.travail_minutes ?? 0))}`}
                color={(s.travail_minutes - (prev.stats?.travail_minutes ?? 0)) > 0 ? 'text-emerald-400' : 'text-rose-400'} />
              <MiniStat label="Δ Personnel" value={`${(s.personnel_minutes - (prev.stats?.personnel_minutes ?? 0)) >= 0 ? '+' : ''}${formatMinutes(s.personnel_minutes - (prev.stats?.personnel_minutes ?? 0))}`}
                color={(s.personnel_minutes - (prev.stats?.personnel_minutes ?? 0)) > 0 ? 'text-emerald-400' : 'text-rose-400'} />
            </div>
          )}
          {groups.map(g => (
            <GroupAccordion key={g.group} group={g.group} groupMin={g.minutes} groupPct={g.pct} totalMin={s.total_minutes}
              categories={g.categories} catData={g.catData} config={CATEGORY_CONFIG} />
          ))}
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
