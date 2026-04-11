import { useMemo, useState } from 'react'
import { Minus, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppState, Stats } from '@/types'
import {
  formatHours,
  isoToFr,
  cn,
  todayISO,
  addDays,
  parseHoursInput,
  CATEGORY_CONFIG,
  TRAVAIL_CATEGORIES,
} from '@/lib/utils'

interface VaultViewProps {
  state: AppState
  stats: Stats
  onSetTravailHours: (date: string, hours: number) => void
  onSetCategoryHours: (date: string, category: string, hours: number) => void
  onSetTravailNotes: (date: string, notes: string) => void
}

const QUICK_HOURS = [0, 0.5, 1, 1.5, 2, 3, 4]

export const VaultView = ({
  state,
  stats,
  onSetTravailHours,
  onSetCategoryHours,
  onSetTravailNotes,
}: VaultViewProps) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())

  // Find the travail entry for the selected date
  const travailEntries = state.travail ?? []
  const selected = travailEntries.find(r => r.date === selectedDate)
  const totalHours = selected?.hours ?? 0

  const last7Days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6 - i))
      const entry = travailEntries.find(r => r.date === d)
      return { date: d, hours: entry?.hours ?? 0 }
    })
  }, [travailEntries])

  const adjustTotal = (delta: number) => {
    const next = Math.max(0, Math.round((totalHours + delta) * 100) / 100)
    onSetTravailHours(selectedDate, next)
  }

  return (
    <div className="space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Aujourd'hui" value={formatHours(stats.vault.today_hours)} />
        <StatTile label="Semaine" value={formatHours(stats.vault.week_hours)} />
        <StatTile label="Mois" value={formatHours(stats.vault.month_hours)} />
        <StatTile label="Streak" value={`${stats.vault.streak_days}j`} sub="consécutifs" />
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

      {/* Selected day editor */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Édition</p>
            <p className="text-sm font-bold text-zinc-200 mt-0.5">{isoToFr(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setSelectedDate(todayISO())}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200">
              Aujourd'hui
            </button>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              disabled={selectedDate >= todayISO()}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Total heures */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-400">Total du jour</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => adjustTotal(-0.5)}
              className="p-2 rounded-xl border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all">
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-4xl font-extrabold bg-gradient-to-br from-violet-300 to-violet-100 bg-clip-text text-transparent font-mono">
                {formatHours(totalHours)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{totalHours.toFixed(2)}h décimales</p>
            </div>
            <button onClick={() => adjustTotal(0.5)}
              className="p-2 rounded-xl border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all">
              <Plus size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-3">
            {QUICK_HOURS.map(n => (
              <button key={n} onClick={() => onSetTravailHours(selectedDate, n)}
                className={cn(
                  'py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                  totalHours === n ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                )}>
                {n === 0 ? '0' : `${n}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Catégories — heures par catégorie */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 mb-3">Catégories (heures)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TRAVAIL_CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat]
              const value = selected?.category_hours?.[cat] ?? 0
              return (
                <CategoryRow
                  key={cat}
                  name={cfg.label}
                  emoji={cfg.emoji}
                  value={value}
                  color={cfg.hex}
                  onChange={(v) => onSetCategoryHours(selectedDate, cat, v)}
                />
              )
            })}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">
            Astuce : entre une durée comme « 1h30 » ou « 45min ». Le total se met à jour automatiquement.
          </p>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 mb-2">Notes</p>
          <textarea
            value={selected?.notes ?? ''}
            onChange={e => onSetTravailNotes(selectedDate, e.target.value)}
            rows={2}
            placeholder="Commentaire libre sur la journée…"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-violet-500 resize-none"
          />
        </div>
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

// ─── Category row with stepper + free input ───────────────────────────────
const CategoryRow = ({
  name,
  emoji,
  value,
  color,
  onChange,
}: {
  name: string
  emoji: string
  value: number
  color: string
  onChange: (hours: number) => void
}) => {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? (value > 0 ? formatHours(value) : '')

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

  const step = (delta: number) => {
    const next = Math.max(0, Math.round((value + delta) * 100) / 100)
    onChange(next)
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
        value > 0 ? 'bg-zinc-900/70' : 'bg-zinc-900/30',
      )}
      style={{ borderColor: value > 0 ? color + '60' : '#27272a' }}
    >
      <span className="text-base shrink-0">{emoji}</span>
      <span className="flex-1 text-xs font-medium text-zinc-200 truncate">{name}</span>
      <button onClick={() => step(-0.25)}
        className="w-6 h-6 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center">
        <Minus size={11} />
      </button>
      <input
        value={display}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setDraft(value > 0 ? formatHours(value) : '')}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur() }
        }}
        placeholder="—"
        className="w-16 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] text-center font-mono focus:outline-none focus:border-violet-500"
        style={{ color: value > 0 ? color : undefined }}
      />
      <button onClick={() => step(0.25)}
        className="w-6 h-6 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center">
        <Plus size={11} />
      </button>
    </div>
  )
}
