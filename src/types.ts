// ─────────────────────────────────────────────────────────────────────────────
// 📊 Tracking Dashboard — Types
// ─────────────────────────────────────────────────────────────────────────────

export type View = 'dashboard' | 'vault' | 'routine' | 'todos' | 'charts'

// ─── Vault sessions (projets) ────────────────────────────────────────────────
export interface VaultSession {
  id: string              // uuid or `${project}-${date}-${idx}`
  project: string         // nom de la note Obsidian (ex: "FTTH CCT 2026 - Partie 1")
  date: string            // ISO YYYY-MM-DD
  hours: number           // float (ex: 2.5)
  note?: string           // description libre
  validated?: boolean     // si "(non validé)" marqué
}

// ─── Routine (activités quantifiées en heures décimales) ────────────────────
export interface RoutineEntry {
  date: string                            // ISO YYYY-MM-DD
  hours: number                           // total heures du jour (float)
  notes?: string
  habit_hours: Record<string, number>     // { Sport: 1.0, Cardio: 0.5, Lecture: 0.25, 'Bien-être': 0.5 }
}

// ─── Todos ───────────────────────────────────────────────────────────────────
export type TodoCategory = 'pro' | 'finance' | 'admin' | 'automatisation'
export type TodoPriority = 'urgent' | 'normal' | 'faible'
export type TodoStatus = 'open' | 'done' | 'waiting' | 'delegated'

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
}

// ─── State global (source de vérité sur GitHub) ─────────────────────────────
export interface AppState {
  meta: {
    version: number
    updated_at: string             // ISO datetime
    updated_by: 'obsidian' | 'web' | 'mobile'
    habitudes: string[]            // liste configurable des habitudes (routine categories)
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
    by_project: Array<{ name: string; hours: number }>  // pour camembert
  }
  routine: {
    today_hours: number
    today_intensity: string
    week_hours: number
    month_hours: number
    total_hours: number
    streak_days: number
    habits_today: Record<string, number>                // heures par habitude aujourd'hui
    by_habit: Array<{ name: string; hours: number }>    // total heures par habitude (pour camembert)
  }
  todos: {
    total: number
    open: number
    done: number
    urgent: number
    completion_rate: number
    by_category: Record<TodoCategory, { total: number; open: number }>
    today_minutes: number      // temps activités cochées aujourd'hui
    week_minutes: number
  }
}
