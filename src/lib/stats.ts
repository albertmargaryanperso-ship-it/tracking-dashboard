import type { AppState, Stats, TodoCategory, CategoryGroup } from '@/types'
import { todayISO, startOfWeekISO, startOfMonthISO, addDays, categoryGroup, getActiveCategories, getTodoTabs } from './utils'

export const computeStats = (state: AppState): Stats => {
  const today = todayISO()
  const weekStart = startOfWeekISO(today)
  const monthStart = startOfMonthISO(today)
  const todos = state.todos ?? []
  const archive = state.archive ?? []
  const todoTabs = getTodoTabs(state.meta?.custom_tabs)

  // ─── Todos task stats ─────────────────────────────────────────────────────
  const total = todos.length
  const done = todos.filter(t => t.status === 'done').length
  const open = total - done
  const urgent = todos.filter(t => t.status === 'open' && t.priority === 'urgent').length
  const completion_rate = total > 0 ? Math.round((done / total) * 100) : 0

  // ─── Tracking stats (from todos completed_min) ───────────────────────────
  const doneTodos = todos.filter(t => t.status === 'done' && t.completed_at)

  const sumMinByCats = (list: typeof doneTodos, dateFilter?: (d: string) => boolean, cats?: string[]) =>
    list
      .filter(t => (!dateFilter || dateFilter(t.completed_at!)) && (!cats || cats.includes(t.category)))
      .reduce((sum, t) => sum + (t.completed_min ?? 0), 0)

  const isToday = (d: string) => d === today
  const isWeek = (d: string) => d >= weekStart && d <= today
  const isMonth = (d: string) => d >= monthStart && d <= today

  const today_minutes = sumMinByCats(doneTodos, isToday)
  const week_minutes = sumMinByCats(doneTodos, isWeek)
  const month_minutes = sumMinByCats(doneTodos, isMonth)

  // Per-tab breakdown (replaces hardcoded travail/personnel)
  const by_tab: Record<string, { today: number; week: number; month: number; total: number }> = {}
  for (const tab of todoTabs) {
    const cats = tab.categoryFilter?.length ? tab.categoryFilter : undefined
    by_tab[tab.id] = {
      today: sumMinByCats(doneTodos, isToday, cats),
      week: sumMinByCats(doneTodos, isWeek, cats),
      month: sumMinByCats(doneTodos, isMonth, cats),
      total: sumMinByCats(doneTodos, undefined, cats),
    }
  }

  // Legacy compat — look up by known ID, not by position
  const travailTab = todoTabs.find(t => t.id === 'todo-travail')
  const personnelTab = todoTabs.find(t => t.id === 'todo-personnel')
  const travail_today_min = by_tab[travailTab?.id ?? '']?.today ?? 0
  const travail_week_min = by_tab[travailTab?.id ?? '']?.week ?? 0
  const travail_month_min = by_tab[travailTab?.id ?? '']?.month ?? 0
  const personnel_today_min = by_tab[personnelTab?.id ?? '']?.today ?? 0
  const personnel_week_min = by_tab[personnelTab?.id ?? '']?.week ?? 0
  const personnel_month_min = by_tab[personnelTab?.id ?? '']?.month ?? 0

  // Total = active done + all archived
  const archiveTotal = archive.reduce((sum, a) => sum + (a.stats?.total_minutes ?? 0), 0)
  const activeTotal = doneTodos.reduce((sum, t) => sum + (t.completed_min ?? 0), 0)
  const total_minutes = activeTotal + archiveTotal

  // ─── Streaks per tab ──────────────────────────────────────────────────────
  const streaks_by_tab: Record<string, number> = {}
  for (const tab of todoTabs) {
    const cats = tab.categoryFilter?.length ? new Set(tab.categoryFilter) : null
    const dates = new Set(
      doneTodos.filter(t => !cats || cats.has(t.category)).map(t => t.completed_at!)
    )
    let streak = 0
    // Start from today; if no activity today, start from yesterday (day not over yet)
    let cursor = dates.has(today) ? today : addDays(today, -1)
    while (dates.has(cursor)) { streak += 1; cursor = addDays(cursor, -1) }
    streaks_by_tab[tab.id] = streak
  }

  // Legacy — by known ID
  const streak_travail = streaks_by_tab[travailTab?.id ?? ''] ?? 0
  const streak_personnel = streaks_by_tab[personnelTab?.id ?? ''] ?? 0

  // ─── By category ──────────────────────────────────────────────────────────
  const { CATEGORY_LIST } = getActiveCategories(state.meta?.custom_categories)

  const by_category = Object.fromEntries(
    CATEGORY_LIST.map((c: string) => [c, { total: 0, open: 0, done: 0, minutes: 0 }])
  ) as Record<string, { total: number; open: number; done: number; minutes: number }>

  const by_group: Record<string, { total: number; open: number; done: number; minutes: number }> = {}
  for (const tab of todoTabs) by_group[tab.id] = { total: 0, open: 0, done: 0, minutes: 0 }

  for (const t of todos) {
    if (!by_category[t.category]) by_category[t.category] = { total: 0, open: 0, done: 0, minutes: 0 }
    const cat = by_category[t.category]
    cat.total += 1
    if (t.status !== 'done') cat.open += 1
    if (t.status === 'done') { cat.done += 1; cat.minutes += t.completed_min ?? 0 }

    // Assign to tab group
    for (const tab of todoTabs) {
      if (!tab.categoryFilter?.length || tab.categoryFilter.includes(t.category)) {
        const grp = by_group[tab.id]
        if (grp) {
          grp.total += 1
          if (t.status !== 'done') grp.open += 1
          if (t.status === 'done') { grp.done += 1; grp.minutes += t.completed_min ?? 0 }
        }
        break // assign to first matching tab only
      }
    }
  }

  return {
    tracking: {
      today_minutes, week_minutes, month_minutes, total_minutes,
      travail_today_min, travail_week_min, travail_month_min,
      personnel_today_min, personnel_week_min, personnel_month_min,
      streak_travail, streak_personnel,
      streaks_by_tab,
      by_tab,
      by_category, by_group,
    },
    todos: { total, open, done, urgent, completion_rate },
  }
}
