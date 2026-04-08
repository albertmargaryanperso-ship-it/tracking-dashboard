import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { AppState, VaultSession, RoutineEntry, Todo, HabitStatus } from '@/types'
import { INITIAL_STATE } from '@/lib/initialState'
import { computeStats } from '@/lib/stats'
import { readState, writeState, hasToken, type SyncStatus } from '@/lib/github'
import { STATE_CACHE_KEY, LAST_SYNC_KEY, AUTO_SYNC_INTERVAL_MS } from '@/lib/config'
import { todayISO } from '@/lib/utils'

// ─── Persistence helpers ────────────────────────────────────────────────────

const loadCached = (): AppState | null => {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AppState) : null
  } catch {
    return null
  }
}

const saveCached = (state: AppState): void => {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(state))
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
  } catch {
    /* ignore */
  }
}

// ─── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: 'HYDRATE'; state: AppState }
  // Sessions
  | { type: 'ADD_SESSION'; session: Omit<VaultSession, 'id'> }
  | { type: 'DELETE_SESSION'; id: string }
  // Routine
  | { type: 'UPSERT_ROUTINE'; date: string; patch: Partial<RoutineEntry> }
  | { type: 'TOGGLE_HABIT'; date: string; habit: string }
  | { type: 'SET_BLOCS'; date: string; blocs: number }
  | { type: 'ADD_HABIT'; name: string }
  | { type: 'REMOVE_HABIT'; name: string }
  // Todos
  | { type: 'ADD_TODO'; todo: Omit<Todo, 'id' | 'created'> }
  | { type: 'UPDATE_TODO'; id: number; patch: Partial<Todo> }
  | { type: 'TOGGLE_TODO'; id: number }
  | { type: 'DELETE_TODO'; id: number }

const reducer = (state: AppState, action: Action): AppState => {
  const now = new Date().toISOString()
  const today = todayISO()

  switch (action.type) {
    case 'HYDRATE':
      return action.state

    case 'ADD_SESSION': {
      const id = `${action.session.project}-${action.session.date}-${Date.now()}`
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        sessions: [...state.sessions, { ...action.session, id }],
      }
    }

    case 'DELETE_SESSION':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        sessions: state.sessions.filter(s => s.id !== action.id),
      }

    case 'UPSERT_ROUTINE': {
      const existing = state.routine.find(r => r.date === action.date)
      const merged: RoutineEntry = existing
        ? { ...existing, ...action.patch, date: action.date }
        : { date: action.date, blocs: 0, habitudes: {}, ...action.patch }
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        routine: existing
          ? state.routine.map(r => (r.date === action.date ? merged : r))
          : [...state.routine, merged],
      }
    }

    case 'TOGGLE_HABIT': {
      const existing = state.routine.find(r => r.date === action.date)
      const current: HabitStatus = existing?.habitudes?.[action.habit] ?? '—'
      const next: HabitStatus = current === 'Oui' ? 'Non' : current === 'Non' ? '—' : 'Oui'
      const habitudes = { ...(existing?.habitudes ?? {}), [action.habit]: next }
      // Cleanup neutral values
      if (next === '—') delete habitudes[action.habit]

      const merged: RoutineEntry = existing
        ? { ...existing, habitudes }
        : { date: action.date, blocs: 0, habitudes }
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        routine: existing
          ? state.routine.map(r => (r.date === action.date ? merged : r))
          : [...state.routine, merged],
      }
    }

    case 'SET_BLOCS': {
      const existing = state.routine.find(r => r.date === action.date)
      const merged: RoutineEntry = existing
        ? { ...existing, blocs: Math.max(0, action.blocs) }
        : { date: action.date, blocs: Math.max(0, action.blocs), habitudes: {} }
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        routine: existing
          ? state.routine.map(r => (r.date === action.date ? merged : r))
          : [...state.routine, merged],
      }
    }

    case 'ADD_HABIT': {
      if (!action.name.trim() || state.meta.habitudes.includes(action.name)) return state
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web', habitudes: [...state.meta.habitudes, action.name.trim()] },
      }
    }

    case 'REMOVE_HABIT':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web', habitudes: state.meta.habitudes.filter(h => h !== action.name) },
      }

    case 'ADD_TODO': {
      const id = state.todos_next_id
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: [
          ...state.todos,
          { ...action.todo, id, created: today, completed_at: null, delegated_to: null, due: null },
        ],
        todos_next_id: id + 1,
      }
    }

    case 'UPDATE_TODO':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: state.todos.map(t => (t.id === action.id ? { ...t, ...action.patch } : t)),
      }

    case 'TOGGLE_TODO':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: state.todos.map(t => {
          if (t.id !== action.id) return t
          const isDone = t.status === 'done'
          return {
            ...t,
            status: isDone ? 'open' : 'done',
            done: !isDone,
            completed_at: isDone ? null : today,
          }
        }),
      }

    case 'DELETE_TODO':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        todos: state.todos.filter(t => t.id !== action.id),
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
    try {
      return localStorage.getItem(LAST_SYNC_KEY)
    } catch {
      return null
    }
  })
  const shaRef = useRef<string | null>(null)
  const pendingWriteRef = useRef<number | null>(null)
  const firstLoadRef = useRef(true)

  // Persist locally on every state change
  useEffect(() => {
    saveCached(state)
  }, [state])

  // ── Pull from GitHub ──────────────────────────────────────────────────────
  const pull = useCallback(async (silent = false) => {
    if (!silent) setSyncStatus('syncing')
    try {
      const { state: remote, sha } = await readState()
      shaRef.current = sha
      dispatch({ type: 'HYDRATE', state: remote })
      const now = new Date().toISOString()
      setLastSync(now)
      localStorage.setItem(LAST_SYNC_KEY, now)
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 1500)
    } catch (e) {
      console.warn('[tracking] pull failed', e)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
  }, [])

  // ── Push to GitHub (debounced) ───────────────────────────────────────────
  const pushNow = useCallback(async (current: AppState) => {
    if (!hasToken()) {
      setSyncStatus('no-token')
      return
    }
    setSyncStatus('syncing')
    try {
      const newSha = await writeState(current, shaRef.current)
      shaRef.current = newSha
      const now = new Date().toISOString()
      setLastSync(now)
      localStorage.setItem(LAST_SYNC_KEY, now)
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 1500)
    } catch (e) {
      console.error('[tracking] push failed', e)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 4000)
    }
  }, [])

  const schedulePush = useCallback((current: AppState) => {
    if (pendingWriteRef.current) window.clearTimeout(pendingWriteRef.current)
    pendingWriteRef.current = window.setTimeout(() => {
      void pushNow(current)
    }, 1500)
  }, [pushNow])

  // Trigger push on mutations (but not on initial hydrate)
  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false
      return
    }
    schedulePush(state)
  }, [state, schedulePush])

  // Initial pull + auto-refresh every 60s
  useEffect(() => {
    void pull(true)
    const id = window.setInterval(() => void pull(true), AUTO_SYNC_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [pull])

  // ── Action creators ──────────────────────────────────────────────────────
  const actions = useMemo(() => ({
    addSession: (s: Omit<VaultSession, 'id'>) => dispatch({ type: 'ADD_SESSION', session: s }),
    deleteSession: (id: string) => dispatch({ type: 'DELETE_SESSION', id }),
    toggleHabit: (date: string, habit: string) => dispatch({ type: 'TOGGLE_HABIT', date, habit }),
    setBlocs: (date: string, blocs: number) => dispatch({ type: 'SET_BLOCS', date, blocs }),
    addHabit: (name: string) => dispatch({ type: 'ADD_HABIT', name }),
    removeHabit: (name: string) => dispatch({ type: 'REMOVE_HABIT', name }),
    addTodo: (t: Omit<Todo, 'id' | 'created'>) => dispatch({ type: 'ADD_TODO', todo: t }),
    updateTodo: (id: number, patch: Partial<Todo>) => dispatch({ type: 'UPDATE_TODO', id, patch }),
    toggleTodo: (id: number) => dispatch({ type: 'TOGGLE_TODO', id }),
    deleteTodo: (id: number) => dispatch({ type: 'DELETE_TODO', id }),
  }), [])

  const stats = useMemo(() => computeStats(state), [state])

  return {
    state,
    stats,
    actions,
    syncStatus,
    lastSync,
    pull,
    pushNow: () => pushNow(state),
  }
}
