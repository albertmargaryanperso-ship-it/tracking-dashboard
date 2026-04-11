import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { AppState, Todo, TodoCategory, ArchiveMonth } from '@/types'
import { INITIAL_STATE } from '@/lib/initialState'
import { computeStats } from '@/lib/stats'
import { readState, writeState, hasToken, mergeStates, type SyncStatus } from '@/lib/github'
import {
  STATE_CACHE_KEY,
  LAST_SYNC_KEY,
  AUTO_SYNC_INTERVAL_MS,
  PENDING_FLAG_KEY,
  PUSH_DEBOUNCE_MS,
} from '@/lib/config'
import { todayISO, CATEGORY_LIST, categoryGroup } from '@/lib/utils'

// ─── Pending flag ───────────────────────────────────────────────────────────
const setPendingFlag = (on: boolean): void => {
  try { if (on) localStorage.setItem(PENDING_FLAG_KEY, '1'); else localStorage.removeItem(PENDING_FLAG_KEY) } catch { /* */ }
}
const hasPendingFlag = (): boolean => {
  try { return localStorage.getItem(PENDING_FLAG_KEY) === '1' } catch { return false }
}

// ─── Persistence helpers ────────────────────────────────────────────────────
const loadCached = (): AppState | null => {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY)
    return raw ? migrateState(JSON.parse(raw) as AppState) : null
  } catch { return null }
}
const saveCached = (state: AppState): void => {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(state))
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
  } catch { /* */ }
}

// ─── Migration ──────────────────────────────────────────────────────────────
const validCategories = CATEGORY_LIST as string[]

const migrateState = (state: AppState): AppState => {
  const migratedTodos = (state.todos ?? []).map((t: any) => ({
    ...t,
    category: validCategories.includes(t.category) ? t.category : 'admin',
    duration_min: t.duration_min ?? null,
    completed_min: t.completed_min ?? null,
    updated_at: t.updated_at ?? t.completed_at ?? t.created ?? new Date().toISOString(),
  }))
  return {
    ...state,
    todos: migratedTodos,
    archive: state.archive ?? [],
    // Keep legacy arrays as-is
    sessions: state.sessions ?? [],
    travail: state.travail ?? [],
    routine: state.routine ?? [],
  }
}

// ─── Archive helper ─────────────────────────────────────────────────────────
const buildArchiveForMonth = (todos: Todo[], month: string): ArchiveMonth => {
  const monthTodos = todos.filter(t => t.status === 'done' && t.completed_at?.startsWith(month))

  const by_category: Record<string, { count: number; minutes: number }> = {}
  for (const cat of CATEGORY_LIST) by_category[cat] = { count: 0, minutes: 0 }

  let travail_minutes = 0
  let personnel_minutes = 0
  const dayMinutes: Record<string, number> = {}

  for (const t of monthTodos) {
    const min = t.completed_min ?? 0
    const cat = by_category[t.category] ?? by_category.admin
    cat.count += 1
    cat.minutes += min
    if (categoryGroup(t.category) === 'travail') travail_minutes += min
    else personnel_minutes += min
    if (t.completed_at) {
      dayMinutes[t.completed_at] = (dayMinutes[t.completed_at] ?? 0) + min
    }
  }

  const days_active = Object.keys(dayMinutes).length
  const dayEntries = Object.entries(dayMinutes).sort((a, b) => b[1] - a[1])
  const best_day = dayEntries[0] ? { date: dayEntries[0][0], minutes: dayEntries[0][1] } : null

  return {
    month,
    archived_at: new Date().toISOString(),
    todos: monthTodos,
    stats: {
      total_minutes: travail_minutes + personnel_minutes,
      travail_minutes,
      personnel_minutes,
      by_category: by_category as any,
      days_active,
      best_day,
    },
  }
}

// ─── Reducer ────────────────────────────────────────────────────────────────
type Action =
  | { type: 'HYDRATE'; state: AppState }
  // Todos
  | { type: 'ADD_TODO'; todo: Omit<Todo, 'id' | 'created'> }
  | { type: 'ADD_DONE_TODO'; todo: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string } }
  | { type: 'UPDATE_TODO'; id: number; patch: Partial<Todo> }
  | { type: 'TOGGLE_TODO'; id: number; completed_min?: number | null }
  | { type: 'DELETE_TODO'; id: number }
  // Archive
  | { type: 'ARCHIVE_MONTH'; month: string }

const reducer = (state: AppState, action: Action): AppState => {
  const now = new Date().toISOString()
  const today = todayISO()

  switch (action.type) {
    case 'HYDRATE':
      return migrateState(action.state)

    case 'ADD_TODO': {
      const id = state.todos_next_id
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: [...state.todos, {
          ...action.todo,
          id,
          created: today,
          completed_at: null,
          delegated_to: action.todo.delegated_to ?? null,
          due: action.todo.due ?? null,
          duration_min: action.todo.duration_min ?? null,
          completed_min: null,
          updated_at: now,
        }],
        todos_next_id: id + 1,
      }
    }

    case 'ADD_DONE_TODO': {
      const id = state.todos_next_id
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: [...state.todos, {
          ...action.todo,
          id,
          created: today,
          status: 'done' as const,
          done: true,
          completed_at: action.todo.completed_at ?? today,
          delegated_to: null,
          due: null,
          duration_min: action.todo.completed_min,
          completed_min: action.todo.completed_min,
          updated_at: now,
        }],
        todos_next_id: id + 1,
      }
    }

    case 'UPDATE_TODO':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: state.todos.map(t => (t.id === action.id ? { ...t, ...action.patch, updated_at: now } : t)),
      }

    case 'TOGGLE_TODO':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: state.todos.map(t => {
          if (t.id !== action.id) return t
          const isDone = t.status === 'done'
          if (isDone) return { ...t, status: 'open' as const, done: false, completed_at: null, completed_min: null, updated_at: now }
          const completed_min = action.completed_min ?? t.duration_min ?? null
          return { ...t, status: 'done' as const, done: true, completed_at: today, completed_min, updated_at: now }
        }),
      }

    case 'DELETE_TODO':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: state.todos.filter(t => t.id !== action.id),
      }

    case 'ARCHIVE_MONTH': {
      const existing = (state.archive ?? []).find(a => a.month === action.month)
      if (existing) return state // already archived

      const archiveEntry = buildArchiveForMonth(state.todos, action.month)
      if (archiveEntry.todos.length === 0) return state // nothing to archive

      const remainingTodos = state.todos.filter(
        t => !(t.status === 'done' && t.completed_at?.startsWith(action.month))
      )
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: remainingTodos,
        archive: [...(state.archive ?? []), archiveEntry],
      }
    }

    default:
      return state
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export const useAppState = () => {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadCached() ?? INITIAL_STATE)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSync, setLastSync] = useState<string | null>(() => {
    try { return localStorage.getItem(LAST_SYNC_KEY) } catch { return null }
  })
  const shaRef = useRef<string | null>(null)
  const pendingWriteRef = useRef<number | null>(null)
  const dirtyRef = useRef(hasPendingFlag())
  const stateRef = useRef(state)
  const pushInFlightRef = useRef<Promise<void> | null>(null)
  const initialPullDoneRef = useRef(false)

  useEffect(() => { stateRef.current = state; saveCached(state) }, [state])

  // ── Push to GitHub ───────────────────────────────────────────────────────
  const pushNow = useCallback(async (current: AppState) => {
    if (!hasToken()) { setSyncStatus('no-token'); return }
    setSyncStatus('syncing')
    try {
      const newSha = await writeState(current, shaRef.current)
      shaRef.current = newSha
      dirtyRef.current = false
      setPendingFlag(false)
      const ts = new Date().toISOString()
      setLastSync(ts)
      localStorage.setItem(LAST_SYNC_KEY, ts)
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 1500)
    } catch (e) {
      console.error('[tracking] push failed', e)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 4000)
    }
  }, [])

  const flushPendingPush = useCallback(async () => {
    if (pendingWriteRef.current !== null) { window.clearTimeout(pendingWriteRef.current); pendingWriteRef.current = null }
    if (pushInFlightRef.current) { try { await pushInFlightRef.current } catch { /* */ } }
    if (dirtyRef.current) {
      const p = pushNow(stateRef.current)
      pushInFlightRef.current = p.finally(() => { pushInFlightRef.current = null })
      try { await pushInFlightRef.current } catch { /* */ }
    }
  }, [pushNow])

  // ── Pull from GitHub ──────────────────────────────────────────────────────
  const pull = useCallback(async (silent = false) => {
    await flushPendingPush()
    if (!silent) setSyncStatus('syncing')
    try {
      const { state: remote, sha } = await readState()
      shaRef.current = sha

      if (dirtyRef.current) {
        const merged = mergeStates(stateRef.current, remote)
        dispatch({ type: 'HYDRATE', state: merged })
        setPendingFlag(true)
        void pushNow(merged)
      } else {
        dispatch({ type: 'HYDRATE', state: remote })
      }

      initialPullDoneRef.current = true
      const ts = new Date().toISOString()
      setLastSync(ts)
      localStorage.setItem(LAST_SYNC_KEY, ts)
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 1500)
    } catch (e) {
      console.warn('[tracking] pull failed', e)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
  }, [flushPendingPush, pushNow])

  const schedulePush = useCallback(() => {
    if (pendingWriteRef.current) window.clearTimeout(pendingWriteRef.current)
    pendingWriteRef.current = window.setTimeout(() => {
      pendingWriteRef.current = null
      const p = pushNow(stateRef.current)
      pushInFlightRef.current = p.finally(() => { pushInFlightRef.current = null })
    }, PUSH_DEBOUNCE_MS)
  }, [pushNow])

  useEffect(() => { if (!dirtyRef.current) return; schedulePush() }, [state, schedulePush])

  // Flush on tab hide / beforeunload
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return
      if (pendingWriteRef.current !== null) { window.clearTimeout(pendingWriteRef.current); pendingWriteRef.current = null }
      const p = pushNow(stateRef.current)
      pushInFlightRef.current = p.finally(() => { pushInFlightRef.current = null })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else if (document.visibilityState === 'visible' && (dirtyRef.current || hasPendingFlag())) {
        dirtyRef.current = true
        void pushNow(stateRef.current)
      }
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pushNow])

  // Initial pull + auto-refresh
  useEffect(() => {
    void pull(true)
    const id = window.setInterval(() => void pull(true), AUTO_SYNC_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [pull])

  // ── Auto-archive: move completed todos from past months ──────────────────
  useEffect(() => {
    if (!initialPullDoneRef.current) return
    const currentMonth = todayISO().slice(0, 7)
    const staleMonths = new Set<string>()
    for (const t of stateRef.current.todos) {
      if (t.status === 'done' && t.completed_at) {
        const m = t.completed_at.slice(0, 7)
        if (m < currentMonth) staleMonths.add(m)
      }
    }
    for (const m of staleMonths) {
      dispatch({ type: 'ARCHIVE_MONTH', month: m })
      dirtyRef.current = true
      setPendingFlag(true)
    }
  }, [state.meta.version]) // re-check after each sync

  // ── Action creators ──────────────────────────────────────────────────────
  const userDispatch = useCallback((action: Action) => {
    dirtyRef.current = true
    setPendingFlag(true)
    dispatch(action)
  }, [])

  const actions = useMemo(() => ({
    addTodo: (t: Omit<Todo, 'id' | 'created'>) => userDispatch({ type: 'ADD_TODO', todo: t }),
    addDoneTodo: (t: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string }) =>
      userDispatch({ type: 'ADD_DONE_TODO', todo: t }),
    updateTodo: (id: number, patch: Partial<Todo>) => userDispatch({ type: 'UPDATE_TODO', id, patch }),
    toggleTodo: (id: number, completed_min?: number | null) => userDispatch({ type: 'TOGGLE_TODO', id, completed_min }),
    deleteTodo: (id: number) => userDispatch({ type: 'DELETE_TODO', id }),
    archiveMonth: (month: string) => userDispatch({ type: 'ARCHIVE_MONTH', month }),
  }), [userDispatch])

  const stats = useMemo(() => computeStats(state), [state])

  return { state, stats, actions, syncStatus, lastSync, pull, pushNow: () => pushNow(state) }
}
