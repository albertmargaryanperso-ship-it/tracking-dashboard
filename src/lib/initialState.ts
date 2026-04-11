import type { AppState } from '@/types'

export const INITIAL_STATE: AppState = {
  meta: {
    version: 0,
    updated_at: new Date().toISOString(),
    updated_by: 'web',
  },
  todos: [],
  todos_next_id: 1,
  archive: [],
  sessions: [],
  travail: [],
  routine: [],
}
