import type { AppState, Stats, TodoCategory, CategoryGroup } from '@/types'
import { todayISO, startOfWeekISO, startOfMonthISO, addDays, CATEGORY_LIST, TRAVAIL_CATEGORIES, CATEGORY_CONFIG, categoryGroup } from './utils'

export const computeStats = (state: AppState): Stats => {
  const today = todayISO()
  const weekStart = startOfWeekISO(today)
  const monthStart = startOfMonthISO(today)

  // ─── Vault / Travail stats ─────────────────────────────────────────────────
  const travail = state.travail ?? []
  const vault_today = travail.find(t => t.date === today)?.hours ?? 0
  const vault_week = travail
    .filter(t => t.date >= weekStart && t.date <= today)
    .reduce((sum, t) => sum + (t.hours ?? 0), 0)
  const vault_month = travail
    .filter(t => t.date >= monthStart && t.date <= today)
    .reduce((sum, t) => sum + (t.hours ?? 0), 0)
  const vault_total = travail.reduce((sum, t) => sum + (t.hours ?? 0), 0)

  // Vault streak: consecutive days with travail hours > 0
  const travailDates = new Set(travail.filter(t => (t.hours ?? 0) > 0).map(t => t.date))
  let vault_streak = 0
  let cursor = today
  while (travailDates.has(cursor)) {
    vault_streak += 1
    cursor = addDays(cursor, -1)
  }

  // Per category aggregate for travail
  const byCatMap: Record<string, number> = {}
  for (const cat of TRAVAIL_CATEGORIES) byCatMap[cat] = 0
  for (const t of travail) {
    for (const [cat, hrs] of Object.entries(t.category_hours ?? {})) {
      byCatMap[cat] = (byCatMap[cat] ?? 0) + (hrs ?? 0)
    }
  }
  const vault_by_category = TRAVAIL_CATEGORIES.map(cat => ({
    name: CATEGORY_CONFIG[cat].label,
    hours: byCatMap[cat] ?? 0,
    emoji: CATEGORY_CONFIG[cat].emoji,
    color: CATEGORY_CONFIG[cat].hex,
  }))

  // ─── Routine stats ────────────────────────────────────────────────────────
  const routine_today_entry = state.routine.find(r => r.date === today)
  const routine_today = routine_today_entry?.hours ?? 0
  const routine_week = state.routine
    .filter(r => r.date >= weekStart && r.date <= today)
    .reduce((sum, r) => sum + (r.hours ?? 0), 0)
  const routine_month = state.routine
    .filter(r => r.date >= monthStart && r.date <= today)
    .reduce((sum, r) => sum + (r.hours ?? 0), 0)
  const routine_total = state.routine.reduce((sum, r) => sum + (r.hours ?? 0), 0)

  const routineDates = new Set(state.routine.filter(r => (r.hours ?? 0) > 0).map(r => r.date))
  let routine_streak = 0
  cursor = today
  while (routineDates.has(cursor)) {
    routine_streak += 1
    cursor = addDays(cursor, -1)
  }

  // Per habit today
  const habits_today: Record<string, number> = {}
  for (const h of state.meta.habitudes) {
    habits_today[h] = routine_today_entry?.habit_hours?.[h] ?? 0
  }

  // Per habit total (for pie chart)
  const byHabitMap: Record<string, number> = {}
  for (const h of state.meta.habitudes) byHabitMap[h] = 0
  for (const r of state.routine) {
    for (const [name, hrs] of Object.entries(r.habit_hours ?? {})) {
      byHabitMap[name] = (byHabitMap[name] ?? 0) + (hrs ?? 0)
    }
  }
  const by_habit = Object.entries(byHabitMap)
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)

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

  const by_category = Object.fromEntries(
    CATEGORY_LIST.map(c => [c, { total: 0, open: 0, minutes: 0 }])
  ) as Record<TodoCategory, { total: number; open: number; minutes: number }>
  const by_group: Record<CategoryGroup, { total: number; open: number; minutes: number }> = {
    travail:   { total: 0, open: 0, minutes: 0 },
    personnel: { total: 0, open: 0, minutes: 0 },
  }
  for (const t of state.todos) {
    const bucket = by_category[t.category] ?? by_category.admin
    bucket.total += 1
    if (t.status === 'open') bucket.open += 1
    if (t.status === 'done' && t.completed_min) bucket.minutes += t.completed_min
    const grp = by_group[categoryGroup(t.category)]
    grp.total += 1
    if (t.status === 'open') grp.open += 1
    if (t.status === 'done' && t.completed_min) grp.minutes += t.completed_min
  }

  const todos_today_minutes = state.todos
    .filter(t => t.status === 'done' && t.completed_at === today)
    .reduce((sum, t) => sum + (t.completed_min ?? 0), 0)
  const todos_week_minutes = state.todos
    .filter(t => t.status === 'done' && t.completed_at && t.completed_at >= weekStart && t.completed_at <= today)
    .reduce((sum, t) => sum + (t.completed_min ?? 0), 0)

  return {
    vault: {
      today_hours: vault_today,
      week_hours: vault_week,
      month_hours: vault_month,
      total_hours: vault_total,
      streak_days: vault_streak,
      by_category: vault_by_category,
    },
    routine: {
      today_hours: routine_today,
      today_intensity,
      week_hours: routine_week,
      month_hours: routine_month,
      total_hours: routine_total,
      streak_days: routine_streak,
      habits_today,
      by_habit,
    },
    todos: {
      total,
      open,
      done,
      urgent,
      completion_rate,
      by_category,
      by_group,
      today_minutes: todos_today_minutes,
      week_minutes: todos_week_minutes,
    },
  }
}
