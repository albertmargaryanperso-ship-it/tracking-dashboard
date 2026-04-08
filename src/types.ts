// ─────────────────────────────────────────────────────────────────────────────
// 📊 Tracking Dashboard — Types
// ─────────────────────────────────────────────────────────────────────────────

export type View = 'dashboard' | 'vault' | 'routine' | 'todos'

// ─── Vault sessions (projets) ────────────────────────────────────────────────
export interface VaultSession {
  id: string              // uuid or `${project}-${date}-${idx}`
  project: string         // nom de la note Obsidian (ex: "FTTH CCT 2026 - Partie 1")
  date: string            // ISO YYYY-MM-DD
  hours: number           // float (ex: 2.5)
  note?: string           // description libre
  validated?: boolean     // si "(non validé)" marqué
}

// ─── Routine (habitudes + blocs de temps) ────────────────────────────────────
export type HabitStatus = 'Oui' | 'Non' | '—'

export interface RoutineEntry {
  date: string                               // ISO YYYY-MM-DD
  blocs: number                              // blocs de 30 min (ex: 6 = 3h)
  notes?: string
  habitudes: Record<string, HabitStatus>     // { Sport: 'Oui', Cardio: 'Non', ... }
}

// ─── Todos ───────────────────────────────────────────────────────────────────
export type TodoCategory = 'pro' | 'finance' | 'admin'
export type TodoPriority = 'urgent' | 'normal'
export type TodoStatus = 'open' | 'done'

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
}

// ─── State global (source de vérité sur GitHub) ─────────────────────────────
export interface AppState {
  meta: {
    version: number
    updated_at: string             // ISO datetime
    updated_by: 'obsidian' | 'web' | 'mobile'
    habitudes: string[]            // liste configurable des habitudes
  }
  sessions: VaultSession[]
  routine: RoutineEntry[]
  todos: Todo[]
  todos_next_id: number
}

// ─── Stats calculées ────────────────────────────────────────────────────────
export interface Stats {
  vault: {
    today_hours: number
    week_hours: number
    month_hours: number
    total_hours: number
    streak_days: number
    active_projects: number
    top_project: { name: string; hours: number } | null
  }
  routine: {
    today_hours: number
    today_intensity: string
    week_hours: number
    month_hours: number
    streak_days: number
    habits_today: Record<string, HabitStatus>
  }
  todos: {
    total: number
    open: number
    done: number
    urgent: number
    completion_rate: number
    by_category: Record<TodoCategory, { total: number; open: number }>
  }
}
