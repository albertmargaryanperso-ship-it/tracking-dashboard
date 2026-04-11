import type { AppState, Stats, TodoCategory, CategoryGroup } from '@/types'
import { todayISO, startOfWeekISO, startOfMonthISO, addDays, CATEGORY_LIST, categoryGroup } from './utils'

export const computeStats = (state: AppState): Stats => {
  const today = todayISO()
  const weekStart = startOfWeekISO(today)
  const monthStart = startOfMonthISO(today)
  const todos = state.todos ?? []
  const archive = state.archive ?? []

  // ─── Todos task stats ─────────────────────────────────────────────────────
  const total = todos.length
  const done = todos.filter(t => t.status === 'done').length
  const open = total - done
  const urgent = todos.filter(t => t.status === 'open' && t.priority === 'urgent').length
  const completion_rate = total > 0 ? Math.round((done / total) * 100) : 0

  // ─── Tracking stats (from todos completed_min) ───────────────────────────
  const doneTodos = todos.filter(t => t.status === 'done' && t.completed_at)

  const sumMin = (list: typeof doneTodos, dateFilter?: (d: string) => boolean, groupFilter?: CategoryGroup) =>
    list
      .filter(t => (!dateFilter || dateFilter(t.completed_at!)) && (!groupFilter || categoryGroup(t.category) === groupFilter))
      .reduce((sum, t) => sum + (t.completed_min ?? 0), 0)

  const isToday = (d: string) => d === today
  const isWeek = (d: string) => d >= weekStart && d <= today
  const isMonth = (d: string) => d >= monthStart && d <= today

  const today_minutes = sumMin(doneTodos, isToday)
  const week_minutes = sumMin(doneTodos, isWeek)
  const month_minutes = sumMin(doneTodos, isMonth)

  const travail_today_min = sumMin(doneTodos, isToday, 'travail')
  const travail_week_min = sumMin(doneTodos, isWeek, 'travail')
  const travail_month_min = sumMin(doneTodos, isMonth, 'travail')
  const personnel_today_min = sumMin(doneTodos, isToday, 'personnel')
  const personnel_week_min = sumMin(doneTodos, isWeek, 'personnel')
  const personnel_month_min = sumMin(doneTodos, isMonth, 'personnel')

  // Total = active done + all archived
  const archiveTotal = archive.reduce((sum, a) => sum + (a.stats?.total_minutes ?? 0), 0)
  const activeTotal = doneTodos.reduce((sum, t) => sum + (t.completed_min ?? 0), 0)
  const total_minutes = activeTotal + archiveTotal

  // ─── Streaks ──────────────────────────────────────────────────────────────
  const computeStreak = (group: CategoryGroup): number => {
    const dates = new Set(
      doneTodos.filter(t => categoryGroup(t.category) === group).map(t => t.completed_at!)
    )
    let streak = 0
    let cursor = today
    while (dates.has(cursor)) {
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return streak
  }

  // ─── By category ──────────────────────────────────────────────────────────
  const by_category = Object.fromEntries(
    CATEGORY_LIST.map(c => [c, { total: 0, open: 0, done: 0, minutes: 0 }])
  ) as Record<TodoCategory, { total: number; open: number; done: number; minutes: number }>

  const by_group: Record<CategoryGroup, { total: number; open: number; done: number; minutes: number }> = {
    travail: { total: 0, open: 0, done: 0, minutes: 0 },
    personnel: { total: 0, open: 0, done: 0, minutes: 0 },
  }

  for (const t of todos) {
    const cat = by_category[t.category] ?? by_category.admin
    cat.total += 1
    if (t.status === 'open') cat.open += 1
    if (t.status === 'done') { cat.done += 1; cat.minutes += t.completed_min ?? 0 }

    const grp = by_group[categoryGroup(t.category)]
    grp.total += 1
    if (t.status === 'open') grp.open += 1
    if (t.status === 'done') { grp.done += 1; grp.minutes += t.completed_min ?? 0 }
  }

  return {
    tracking: {
      today_minutes,
      week_minutes,
      month_minutes,
      total_minutes,
      travail_today_min,
      travail_week_min,
      travail_month_min,
      personnel_today_min,
      personnel_week_min,
      personnel_month_min,
      streak_travail: computeStreak('travail'),
      streak_personnel: computeStreak('personnel'),
      by_category,
      by_group,
    },
    todos: { total, open, done, urgent, completion_rate },
  }
}
