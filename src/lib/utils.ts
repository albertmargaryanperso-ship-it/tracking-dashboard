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
  if (!hours || hours === 0) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export const formatMinutes = (minutes: number | null | undefined): string => {
  if (!minutes || minutes <= 0) return ''
  const m = Math.round(minutes)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`
}

export const hoursToMinutes = (hours: number): number => Math.round(hours * 60)
export const minutesToHours = (minutes: number): number => minutes / 60

// Parse "1h30", "45min", "1.5", "0.75" → hours (float)
export const parseHoursInput = (raw: string): number | null => {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(',', '.')
  // "1h30" or "1h"
  const hm = s.match(/^(\d+)h(\d{1,2})?$/)
  if (hm) {
    const h = parseInt(hm[1], 10)
    const m = hm[2] ? parseInt(hm[2], 10) : 0
    return h + m / 60
  }
  // "45min"
  const mm = s.match(/^(\d+)\s*min$/)
  if (mm) return parseInt(mm[1], 10) / 60
  // decimal
  const n = parseFloat(s)
  if (isNaN(n)) return null
  return n
}

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

// ─── Category config — 4 work categories ───────────────────────────────────

export const CATEGORY_CONFIG = {
  pro:            { label: 'Pro',            emoji: '💼', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30',       hex: '#60a5fa' },
  finance:        { label: 'Finance',        emoji: '💰', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', hex: '#34d399' },
  admin:          { label: 'Admin',          emoji: '📋', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     hex: '#fbbf24' },
  automatisation: { label: 'Automatisation', emoji: '⚙️',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/30',   hex: '#a78bfa' },
} as const

export const CATEGORY_LIST: Array<keyof typeof CATEGORY_CONFIG> = ['pro', 'finance', 'admin', 'automatisation']

// ─── Habit config — 4 routine categories ──────────────────────────────────

export const HABIT_ICONS: Record<string, string> = {
  Sport:       '🏋️',
  Cardio:      '🏃',
  Lecture:     '📖',
  'Bien-être': '🧘',
  Méditation:  '🧘',
  Hydratation: '💧',
  Nutrition:   '🥗',
  Sommeil:     '😴',
}

export const HABIT_COLORS: Record<string, string> = {
  Sport:       '#f472b6',
  Cardio:      '#fb923c',
  Lecture:     '#60a5fa',
  'Bien-être': '#34d399',
}

export const habitIcon = (name: string): string => HABIT_ICONS[name] ?? '✨'
export const habitColor = (name: string): string => HABIT_COLORS[name] ?? '#94a3b8'

// Generate a stable color from a string (for unknown projects/habits in pies)
export const colorFromString = (s: string): string => {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 60%)`
}
