import type { AppState } from '@/types'

// Fallback state used when GitHub read fails and no cache exists.
// Real state is fetched from data/state.json in the repo.
export const INITIAL_STATE: AppState = {
  meta: {
    version: 0,
    updated_at: new Date().toISOString(),
    updated_by: 'web',
    habitudes: ['Sport', 'Cardio', 'Lecture', 'Bien-être'],
  },
  sessions: [],
  travail: [],
  routine: [],
  todos: [],
  todos_next_id: 1,
}
