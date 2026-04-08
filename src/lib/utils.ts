import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

// ─── Date helpers ────────────────────────────────────────────────────────────

export const todayISO = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const isoToFr = (iso: string): string => {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayISOFromDate(d)
}

export const todayISOFromDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Start of ISO week (Monday)
export const startOfWeekISO = (iso: string): string => {
  const d = new Date(iso + 'T12:00:00')
  const dow = d.getDay() // 0=Sun, 1=Mon, ...
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return todayISOFromDate(d)
}

export const startOfMonthISO = (iso: string): string => iso.slice(0, 7) + '-01'

export const daysBetween = (a: string, b: string): number => {
  const da = new Date(a + 'T12:00:00')
  const db = new Date(b + 'T12:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

// ─── Format helpers ─────────────────────────────────────────────────────────

export const formatHours = (hours: number): string => {
  if (hours === 0) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export const blocsToHours = (blocs: number): number => blocs * 0.5

export const hoursToBlocs = (hours: number): number => Math.round(hours * 2)

// ─── Routine intensity ──────────────────────────────────────────────────────

const INTENSITY_MAP: Array<[number, number, string, string]> = [
  [0, 0.5, '—', 'text-zinc-500'],
  [0.5, 1, 'Légère', 'text-sky-400'],
  [1, 2.5, 'Moyenne', 'text-cyan-400'],
  [2.5, 4, 'Productive', 'text-emerald-400'],
  [4, 99, 'Hardcore', 'text-violet-400'],
]

export const intensityLabel = (hours: number): { label: string; className: string } => {
  for (const [min, max, label, className] of INTENSITY_MAP) {
    if (hours >= min && hours < max) return { label, className }
  }
  return { label: '—', className: 'text-zinc-500' }
}

// ─── Category config ────────────────────────────────────────────────────────

export const CATEGORY_CONFIG = {
  pro:     { label: 'Pro',     emoji: '💼', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  finance: { label: 'Finance', emoji: '💰', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  admin:   { label: 'Admin',   emoji: '📋', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
} as const

export const HABIT_ICONS: Record<string, string> = {
  Sport: '🏋️',
  Cardio: '🏃',
  Lecture: '📖',
  'Bien-être': '🧘',
  Méditation: '🧘',
  Hydratation: '💧',
  Nutrition: '🥗',
  Sommeil: '😴',
}

export const habitIcon = (name: string): string => HABIT_ICONS[name] ?? '✨'
