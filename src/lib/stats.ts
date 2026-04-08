import type { AppState, Stats, TodoCategory, HabitStatus } from '@/types'
import { todayISO, startOfWeekISO, startOfMonthISO, addDays, blocsToHours } from './utils'

export const computeStats = (state: AppState): Stats => {
  const today = todayISO()
  const weekStart = startOfWeekISO(today)
  const monthStart = startOfMonthISO(today)

  // ─── Vault stats ──────────────────────────────────────────────────────────
  const vault_today = state.sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.hours, 0)
  const vault_week = state.sessions.filter(s => s.date >= weekStart && s.date <= today).reduce((sum, s) => sum + s.hours, 0)
  const vault_month = state.sessions.filter(s => s.date >= monthStart && s.date <= today).reduce((sum, s) => sum + s.hours, 0)
  const vault_total = state.sessions.reduce((sum, s) => sum + s.hours, 0)

  // Vault streak: consecutive days (back from today) with at least one session
  const sessionDates = new Set(state.sessions.map(s => s.date))
  let vault_streak = 0
  let cursor = today
  while (sessionDates.has(cursor)) {
    vault_streak += 1
    cursor = addDays(cursor, -1)
  }

  // Top project (by total hours)
  const byProject: Record<string, number> = {}
  for (const s of state.sessions) {
    byProject[s.project] = (byProject[s.project] ?? 0) + s.hours
  }
  const projectEntries = Object.entries(byProject).sort((a, b) => b[1] - a[1])
  const top_project = projectEntries[0] ? { name: projectEntries[0][0], hours: projectEntries[0][1] } : null
  const active_projects = projectEntries.length

  // ─── Routine stats ────────────────────────────────────────────────────────
  const routine_today_entry = state.routine.find(r => r.date === today)
  const routine_today = routine_today_entry ? blocsToHours(routine_today_entry.blocs) : 0
  const routine_week = state.routine
    .filter(r => r.date >= weekStart && r.date <= today)
    .reduce((sum, r) => sum + blocsToHours(r.blocs), 0)
  const routine_month = state.routine
    .filter(r => r.date >= monthStart && r.date <= today)
    .reduce((sum, r) => sum + blocsToHours(r.blocs), 0)

  const routineDates = new Set(state.routine.filter(r => r.blocs > 0).map(r => r.date))
  let routine_streak = 0
  cursor = today
  while (routineDates.has(cursor)) {
    routine_streak += 1
    cursor = addDays(cursor, -1)
  }

  const habits_today: Record<string, HabitStatus> = {}
  for (const h of state.meta.habitudes) {
    habits_today[h] = routine_today_entry?.habitudes?.[h] ?? '—'
  }

  const intensityLabels: Array<[number, number, string]> = [
    [0, 0.5, '—'],
    [0.5, 1, 'Légère'],
    [1, 2.5, 'Moyenne'],
    [2.5, 4, 'Productive'],
    [4, 99, 'Hardcore'],
  ]
  let today_intensity = '—'
  for (const [min, max, label] of intensityLabels) {
    if (routine_today >= min && routine_today < max) {
      today_intensity = label
      break
    }
  }

  // ─── Todos stats ──────────────────────────────────────────────────────────
  const total = state.todos.length
  const done = state.todos.filter(t => t.status === 'done').length
  const open = total - done
  const urgent = state.todos.filter(t => t.status === 'open' && t.priority === 'urgent').length
  const completion_rate = total > 0 ? Math.round((done / total) * 100) : 0

  const by_category: Record<TodoCategory, { total: number; open: number }> = {
    pro:     { total: 0, open: 0 },
    finance: { total: 0, open: 0 },
    admin:   { total: 0, open: 0 },
  }
  for (const t of state.todos) {
    by_category[t.category].total += 1
    if (t.status === 'open') by_category[t.category].open += 1
  }

  return {
    vault: {
      today_hours: vault_today,
      week_hours: vault_week,
      month_hours: vault_month,
      total_hours: vault_total,
      streak_days: vault_streak,
      active_projects,
      top_project,
    },
    routine: {
      today_hours: routine_today,
      today_intensity,
      week_hours: routine_week,
      month_hours: routine_month,
      streak_days: routine_streak,
      habits_today,
    },
    todos: {
      total,
      open,
      done,
      urgent,
      completion_rate,
      by_category,
    },
  }
}
