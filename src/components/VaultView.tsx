import { useMemo, useState } from 'react'
import { Minus, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppState, Stats, VaultSession } from '@/types'
import {
  formatHours,
  isoToFr,
  cn,
  todayISO,
  addDays,
  parseHoursInput,
  colorFromString,
} from '@/lib/utils'

interface VaultViewProps {
  state: AppState
  stats: Stats
  onUpsertDayProject: (date: string, project: string, hours: number, note?: string) => void
  onDeleteDayProject: (date: string, project: string) => void
  onAddSession: (s: Omit<VaultSession, 'id'>) => void
}

const QUICK_HOURS = [0, 0.5, 1, 1.5, 2, 3, 4]

// Generate a violet-ish hue from project name so each row has a distinct tint.
const projectColor = (name: string): string => {
  const base = colorFromString(name)
  return base.replace(/hsl\((\d+),\s*\d+%,\s*\d+%\)/, (_, h) => `hsl(${h}, 60%, 65%)`)
}

export const VaultView = ({
  state,
  stats,
  onUpsertDayProject,
  onDeleteDayProject,
  onAddSession,
}: VaultViewProps) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [newProject, setNewProject] = useState('')

  const sessionsForDate = useMemo(
    () => state.sessions.filter(s => s.date === selectedDate),
    [state.sessions, selectedDate],
  )

  // Aggregate sessions by project for the selected day
  const projectsForDate = useMemo(() => {
    const map = new Map<string, { hours: number; note: string }>()
    for (const s of sessionsForDate) {
      const prev = map.get(s.project) ?? { hours: 0, note: '' }
      prev.hours += s.hours
      if (!prev.note && s.note) prev.note = s.note
      map.set(s.project, prev)
    }
    return Array.from(map.entries())
      .map(([project, data]) => ({
        project,
        hours: Math.round(data.hours * 100) / 100,
        note: data.note,
      }))
      .sort((a, b) => b.hours - a.hours)
  }, [sessionsForDate])

  const totalHours = useMemo(
    () => projectsForDate.reduce((sum, p) => sum + p.hours, 0),
    [projectsForDate],
  )

  const last7Days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6 - i))
      const hours = state.sessions
        .filter(s => s.date === d)
        .reduce((a, s) => a + s.hours, 0)
      return { date: d, hours: Math.round(hours * 100) / 100 }
    })
  }, [state.sessions])

  const allProjects = useMemo(() => {
    const set = new Set<string>()
    for (const s of state.sessions) set.add(s.project)
    return Array.from(set).sort()
  }, [state.sessions])

  const addNewProject = () => {
    const name = newProject.trim()
    if (!name) return
    onUpsertDayProject(selectedDate, name, 1)
    setNewProject('')
  }

  return (
    <div className="space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Aujourd'hui" value={formatHours(stats.vault.today_hours)} />
        <StatTile label="Semaine"     value={formatHours(stats.vault.week_hours)} />
        <StatTile label="Mois"        value={formatHours(stats.vault.month_hours)} />
        <StatTile label="Total"       value={formatHours(stats.vault.total_hours)} sub={`${stats.vault.active_projects} projets`} />
      </div>

      {/* 7 days quick view */}
      <div className="rounded-2xl border border-violet-500/20 bg-zinc-900/50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300 mb-3">7 derniers jours</p>
        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((d) => {
            const dObj = new Date(d.date + 'T12:00:00')
            const isSelected = d.date === selectedDate
            const isToday = d.date === todayISO()
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={cn(
                  'p-2 rounded-xl border text-center transition-all',
                  isSelected ? 'border-violet-400 bg-violet-500/15' :
                  isToday ? 'border-violet-500/30 bg-violet-500/5' :
                  'border-zinc-800 bg-zinc-900/50 hover:border-violet-500/30'
                )}
              >
                <p className="text-[9px] text-zinc-500 uppercase font-semibold">
                  {dObj.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-300">{dObj.getDate()}</p>
                <p className={cn('text-[10px] font-mono mt-1', d.hours > 0 ? 'text-violet-300' : 'text-zinc-600')}>
                  {d.hours > 0 ? formatHours(d.hours) : '—'}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick add form */}
      <QuickSessionAdd projects={allProjects} onAdd={onAddSession} />

      {/* Selected day editor */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Édition du jour</p>
            <p className="text-sm font-bold text-zinc-200 mt-0.5">{isoToFr(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setSelectedDate(todayISO())}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              disabled={selectedDate >= todayISO()}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Total du jour */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Total du jour</p>
            <p className="text-[10px] text-zinc-500">{projectsForDate.length} projet{projectsForDate.length > 1 ? 's' : ''}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-extrabold bg-gradient-to-br from-violet-300 to-violet-100 bg-clip-text text-transparent font-mono">
              {formatHours(totalHours)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{totalHours.toFixed(2)}h décimales — somme des sessions</p>
          </div>
        </div>

        {/* Projects for this day — stepper per project */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Projets du jour</p>
          </div>
          {projectsForDate.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-[11px] text-zinc-500">
              Aucun projet pour cette journée. Ajoute-en un ci-dessous.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {projectsForDate.map(p => (
                <ProjectRow
                  key={p.project}
                  name={p.project}
                  hours={p.hours}
                  note={p.note}
                  color={projectColor(p.project)}
                  onChange={(h) => onUpsertDayProject(selectedDate, p.project, h, p.note)}
                  onChangeNote={(n) => onUpsertDayProject(selectedDate, p.project, p.hours, n)}
                  onRemove={() => onDeleteDayProject(selectedDate, p.project)}
                />
              ))}
            </div>
          )}
          <p className="text-[10px] text-zinc-600 mt-2">
            Astuce : entre une durée comme « 1h30 » ou « 45min ». Les ± ajustent par pas de 0.25h.
          </p>

          {/* Add a new project for the day */}
          <div className="mt-3 flex gap-2">
            <input
              list="vault-projects-list"
              value={newProject}
              onChange={e => setNewProject(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addNewProject() }}
              placeholder="+ nouveau projet pour cette journée"
              className="flex-1 min-w-0 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[11px] focus:outline-none focus:border-violet-500"
            />
            <datalist id="vault-projects-list">
              {allProjects.map(p => <option key={p} value={p} />)}
            </datalist>
            <button
              onClick={addNewProject}
              disabled={!newProject.trim()}
              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ajouter
            </button>
          </div>
        </div>

        {/* Quick quick-hours grid — bulk helpers shown only if a project is selected */}
        {projectsForDate.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 mb-2">Raccourcis — appliquer à tous les projets</p>
            <div className="grid grid-cols-7 gap-1.5">
              {QUICK_HOURS.map(n => (
                <button
                  key={n}
                  onClick={() => {
                    // Bulk: set each project to n hours
                    for (const p of projectsForDate) {
                      onUpsertDayProject(selectedDate, p.project, n, p.note)
                    }
                  }}
                  className="py-1.5 rounded-lg text-[10px] font-semibold border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-violet-500/40"
                >
                  {n === 0 ? '0' : `${n}h`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const StatTile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-violet-500/20 bg-zinc-900/50 p-3">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
    <p className="text-xl font-extrabold text-violet-300 mt-0.5">{value}</p>
    {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
  </div>
)

// ─── Project row with stepper + free input + optional note ───────────────────
const ProjectRow = ({
  name,
  hours,
  note,
  color,
  onChange,
  onChangeNote,
  onRemove,
}: {
  name: string
  hours: number
  note: string
  color: string
  onChange: (hours: number) => void
  onChangeNote: (note: string) => void
  onRemove: () => void
}) => {
  const [draft, setDraft] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const display = draft ?? (hours > 0 ? formatHours(hours) : '')

  const commit = () => {
    if (draft === null) return
    if (draft.trim() === '') {
      onChange(0)
    } else {
      const parsed = parseHoursInput(draft)
      if (parsed !== null && parsed >= 0) onChange(Math.round(parsed * 100) / 100)
    }
    setDraft(null)
  }

  const commitNote = () => {
    if (noteDraft === null) return
    onChangeNote(noteDraft)
    setNoteDraft(null)
  }

  const step = (delta: number) => {
    const next = Math.max(0, Math.round((hours + delta) * 100) / 100)
    onChange(next)
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-1.5 px-3 py-2 rounded-xl border transition-all',
        hours > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30',
      )}
      style={{ borderColor: hours > 0 ? color + '60' : '#27272a' }}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="flex-1 text-xs font-medium text-zinc-200 truncate">{name}</span>
        <button
          onClick={() => step(-0.25)}
          className="w-6 h-6 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center"
        >
          <Minus size={11} />
        </button>
        <input
          value={display}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setDraft(hours > 0 ? formatHours(hours) : '')}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setDraft(null)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder="—"
          className="w-16 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] text-center font-mono focus:outline-none focus:border-violet-500"
          style={{ color: hours > 0 ? color : undefined }}
        />
        <button
          onClick={() => step(0.25)}
          className="w-6 h-6 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Note: visible if present or toggled */}
      {(note || showNote) ? (
        <input
          value={noteDraft ?? note}
          onChange={e => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') { setNoteDraft(null); (e.target as HTMLInputElement).blur() }
          }}
          placeholder="note…"
          className="w-full px-2 py-1 bg-zinc-950/60 border border-zinc-800 rounded-md text-[10px] text-zinc-400 focus:outline-none focus:border-violet-500/60 italic"
        />
      ) : (
        <button
          onClick={() => setShowNote(true)}
          className="text-[9px] text-zinc-600 hover:text-zinc-400 text-left self-start"
        >
          + note
        </button>
      )}

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
      >
        <X size={9} />
      </button>
    </div>
  )
}

// ─── Quick add: log a raw session for any date inline ───────────────────────
const QuickSessionAdd = ({
  projects,
  onAdd,
}: {
  projects: string[]
  onAdd: (s: Omit<VaultSession, 'id'>) => void
}) => {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [project, setProject] = useState(projects[0] ?? '')
  const [hoursStr, setHoursStr] = useState('1h')
  const [note, setNote] = useState('')

  const submit = () => {
    const parsed = parseHoursInput(hoursStr)
    if (parsed === null || parsed <= 0 || !project.trim()) return
    onAdd({ project: project.trim(), date, hours: Math.round(parsed * 100) / 100, note: note.trim() })
    setHoursStr('1h')
    setNote('')
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="flex items-center justify-end">
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-500/20 transition-all flex items-center gap-1"
        >
          <Plus size={11} /> Logger une session
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full sm:w-36 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500"
        />
        <input
          list="quick-session-projects"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Projet"
          className="flex-1 min-w-0 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500"
        />
        <datalist id="quick-session-projects">
          {projects.map(p => <option key={p} value={p} />)}
        </datalist>
        <input
          value={hoursStr}
          onChange={e => setHoursStr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="1h30 / 45min / 1.5"
          className="w-full sm:w-32 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500 font-mono text-center"
        />
        <div className="flex gap-1">
          <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-[11px] font-semibold">OK</button>
          <button onClick={() => setOpen(false)} className="px-2 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 text-[11px]">×</button>
        </div>
      </div>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Note (optionnelle)"
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[11px] focus:outline-none focus:border-violet-500"
      />
      <p className="text-[10px] text-zinc-500">
        Logge une session indépendante. Le total du jour est recalculé automatiquement.
      </p>
    </div>
  )
}
