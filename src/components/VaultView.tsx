import { useMemo, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { AppState, Stats, VaultSession } from '@/types'
import { formatHours, isoToFr, cn, todayISO } from '@/lib/utils'

interface VaultViewProps {
  state: AppState
  stats: Stats
  onDelete: (id: string) => void
  onAdd: (s: Omit<VaultSession, 'id'>) => void
}

export const VaultView = ({ state, stats, onDelete, onAdd }: VaultViewProps) => {
  const [activeProject, setActiveProject] = useState<string | null>(null)

  const byProject = useMemo(() => {
    const map: Record<string, { hours: number; sessions: VaultSession[] }> = {}
    for (const s of state.sessions) {
      if (!map[s.project]) map[s.project] = { hours: 0, sessions: [] }
      map[s.project].hours += s.hours
      map[s.project].sessions.push(s)
    }
    return Object.entries(map).sort((a, b) => b[1].hours - a[1].hours)
  }, [state.sessions])

  const activeSessions = useMemo(() => {
    if (!activeProject) return [...state.sessions].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 30)
    return byProject.find(([p]) => p === activeProject)?.[1].sessions
      .slice()
      .sort((a, b) => (a.date > b.date ? -1 : 1)) ?? []
  }, [byProject, activeProject, state.sessions])

  return (
    <div className="space-y-5">
      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label="Aujourd'hui" value={formatHours(stats.vault.today_hours)} accent="violet" />
        <StatPill label="Semaine"    value={formatHours(stats.vault.week_hours)}  accent="violet" />
        <StatPill label="Mois"       value={formatHours(stats.vault.month_hours)} accent="violet" />
        <StatPill label="Total"      value={formatHours(stats.vault.total_hours)} accent="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Projects list */}
        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 h-fit lg:sticky lg:top-24">
          <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Projets ({byProject.length})
          </p>
          <ul className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin">
            <li>
              <button
                onClick={() => setActiveProject(null)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all',
                  activeProject === null ? 'bg-violet-500/15 text-violet-200 border border-violet-500/30' : 'text-zinc-400 hover:bg-zinc-800/60'
                )}
              >
                <span className="font-medium">Toutes les sessions</span>
                <span className="text-[10px] text-zinc-500 font-mono">{state.sessions.length}</span>
              </button>
            </li>
            {byProject.map(([name, data]) => (
              <li key={name}>
                <button
                  onClick={() => setActiveProject(name)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-xl text-xs transition-all',
                    activeProject === name ? 'bg-violet-500/15 text-violet-200 border border-violet-500/30' : 'text-zinc-400 hover:bg-zinc-800/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{name}</span>
                    <span className="text-[10px] text-violet-400 font-mono shrink-0">{formatHours(data.hours)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Sessions feed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {activeProject ?? 'Sessions récentes'}
            </h3>
            <QuickSessionAdd
              projects={byProject.map(([p]) => p)}
              onAdd={onAdd}
              defaultProject={activeProject ?? undefined}
            />
          </div>

          {activeSessions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-xs text-zinc-500">
              Aucune session. Ajoute la première avec le bouton <span className="text-violet-400">+</span>.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {activeSessions.map(s => (
                <li
                  key={s.id}
                  className="group flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-violet-500/30 transition-all"
                >
                  <div className="shrink-0 w-14 text-center">
                    <p className="text-base font-extrabold text-violet-300">{formatHours(s.hours)}</p>
                    <p className="text-[9px] text-zinc-500 font-mono">{isoToFr(s.date).slice(0, 5)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    {!activeProject && <p className="text-[11px] text-violet-400 font-semibold truncate">{s.project}</p>}
                    <p className="text-xs text-zinc-300 leading-relaxed">{s.note || <span className="text-zinc-500 italic">pas de note</span>}</p>
                  </div>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

const StatPill = ({ label, value, accent }: { label: string; value: string; accent: 'violet' | 'cyan' }) => (
  <div className={cn(
    'rounded-xl p-3 border bg-zinc-900/50',
    accent === 'violet' ? 'border-violet-500/20' : 'border-cyan-500/20'
  )}>
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
    <p className={cn('text-xl font-extrabold mt-0.5', accent === 'violet' ? 'text-violet-300' : 'text-cyan-300')}>{value}</p>
  </div>
)

const QuickSessionAdd = ({
  projects, onAdd, defaultProject,
}: {
  projects: string[]
  onAdd: (s: Omit<VaultSession, 'id'>) => void
  defaultProject?: string
}) => {
  const [open, setOpen] = useState(false)
  const [project, setProject] = useState(defaultProject ?? projects[0] ?? '')
  const [hours, setHours] = useState('1')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())

  const submit = () => {
    const h = parseFloat(hours.replace(',', '.'))
    if (!project.trim() || isNaN(h) || h <= 0) return
    onAdd({ project: project.trim(), hours: h, note: note.trim(), date })
    setOpen(false)
    setHours('1')
    setNote('')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-500/20 transition-all flex items-center gap-1"
      >
        <Plus size={11} /> Ajouter session
      </button>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      <input
        list="projects-list"
        value={project}
        onChange={e => setProject(e.target.value)}
        placeholder="Projet"
        className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500"
      />
      <datalist id="projects-list">
        {projects.map(p => <option key={p} value={p} />)}
      </datalist>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="w-full sm:w-32 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500"
      />
      <input
        value={hours}
        onChange={e => setHours(e.target.value)}
        placeholder="1.5"
        className="w-full sm:w-14 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500 text-center"
      />
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optionnelle)"
        className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500"
      />
      <div className="flex gap-1">
        <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-[11px] font-semibold">OK</button>
        <button onClick={() => setOpen(false)} className="px-2 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 text-[11px]">×</button>
      </div>
    </div>
  )
}
