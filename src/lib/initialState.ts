import type { AppState } from '@/types'
import { DEFAULT_TABS } from './utils'

export const INITIAL_STATE: AppState = {
  meta: {
    version: 0,
    updated_at: new Date().toISOString(),
    updated_by: 'web',
    custom_tabs: DEFAULT_TABS,
  },
  todos: [],
  todos_next_id: 1,
  archive: [],
  sessions: [],
  travail: [],
  routine: [],
}
