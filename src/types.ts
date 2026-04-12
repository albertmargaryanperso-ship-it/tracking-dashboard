// ─────────────────────────────────────────────────────────────────────────────
// 📊 Tracking Dashboard — Types
// ─────────────────────────────────────────────────────────────────────────────

export type View = string

export type TabType = 'dashboard' | 'todos' | 'charts' | 'historique' | 'settings'

export interface TabConfig {
  id: string
  label: string
  emoji: string
  type: TabType
  categoryFilter?: string[]
  removable?: boolean
}

// ─── Categories ─────────────────────────────────────────────────────────────
export type TodoCategory = string // previously a union of literals
export type CategoryGroup = 'travail' | 'personnel'
export type TodoPriority = 'urgent' | 'normal' | 'faible'
export type TodoStatus = 'open' | 'done' | 'waiting' | 'delegated'

export interface CategoryConfig {
  id: string
  label: string
  emoji: string
  color: string
  bg: string
  hex: string
  group: CategoryGroup
}

export interface Subtask {
  id: string
  text: string
  done: boolean
}

// ─── Todos ───────────────────────────────────────────────────────────────────
export interface Todo {
  id: number
  text: string
  category: TodoCategory
  priority: TodoPriority
  status: TodoStatus
  delegated_to: string | null
  due: string | null
  created: string                // ISO date
  completed_at: string | null
  done?: boolean
  duration_min?: number | null   // durée estimée (minutes)
  completed_min?: number | null  // temps effectif à la complétion (minutes)
  updated_at?: string            // ISO datetime — for conflict resolution
  orderIndex?: number            // Index au sein de la colonne Kanban
  subtasks?: Subtask[]           // Sous-tâches éventuelles
}

// ─── Archive mensuelle ──────────────────────────────────────────────────────
export interface ArchiveMonth {
  month: string                    // "2026-04"
  archived_at: string              // ISO datetime
  todos: Todo[]
  stats: {
    total_minutes: number
    travail_minutes: number
    personnel_minutes: number
    by_category: Record<string, { count: number; minutes: number }>
    days_active: number
    best_day: { date: string; minutes: number } | null
  }
}

// ─── Legacy types (kept for backward compat with cloud data) ────────────────
export interface VaultSession {
  id: string
  project: string
  date: string
  hours: number
  note?: string
  validated?: boolean
}

export interface TravailEntry {
  date: string
  hours: number
  notes?: string
  category_hours: Record<string, number>
}

export interface RoutineEntry {
  date: string
  hours: number
  notes?: string
  habit_hours: Record<string, number>
}

// ─── State global (source de vérité sur GitHub) ─────────────────────────────
export interface AppState {
  meta: {
    version: number
    updated_at: string
    updated_by: 'obsidian' | 'web' | 'mobile'
    habitudes?: string[]           // legacy
    custom_categories?: CategoryConfig[]
    custom_tabs?: TabConfig[]
    app_name?: string
    app_emoji?: string
  }
  // Active data
  todos: Todo[]
  todos_next_id: number
  archive: ArchiveMonth[]
  // Legacy (preserved, never written to)
  sessions?: VaultSession[]
  travail?: TravailEntry[]
  routine?: RoutineEntry[]
}

// ─── Stats calculées ────────────────────────────────────────────────────────
export interface Stats {
  tracking: {
    today_minutes: number
    week_minutes: number
    month_minutes: number
    total_minutes: number          // active + archived
    travail_today_min: number
    travail_week_min: number
    travail_month_min: number
    personnel_today_min: number
    personnel_week_min: number
    personnel_month_min: number
    streak_travail: number
    streak_personnel: number
    streaks_by_tab: Record<string, number>
    by_tab: Record<string, { today: number; week: number; month: number; total: number }>
    by_category: Record<string, { total: number; open: number; done: number; minutes: number }>
    by_group: Record<string, { total: number; open: number; done: number; minutes: number }>
  }
  todos: {
    total: number
    open: number
    done: number
    urgent: number
    completion_rate: number
  }
}
