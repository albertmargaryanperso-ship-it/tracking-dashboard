import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { AppState, VaultSession, RoutineEntry, Todo } from '@/types'
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
import { todayISO } from '@/lib/utils'

// ─── Pending flag ───────────────────────────────────────────────────────────
// We persist a "dirty" bit to localStorage so that if iOS Safari kills the
// tab while a push is debounced or in flight, the next load knows to flush
// the cached state before pulling. Without this, mobile users lose edits.
const setPendingFlag = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(PENDING_FLAG_KEY, '1')
    else localStorage.removeItem(PENDING_FLAG_KEY)
  } catch {
    /* ignore */
  }
}

const hasPendingFlag = (): boolean => {
  try {
    return localStorage.getItem(PENDING_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

// ─── Persistence helpers ────────────────────────────────────────────────────

const loadCached = (): AppState | null => {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY)
    return raw ? migrateState(JSON.parse(raw) as AppState) : null
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

// Migrate old-format state (blocs + habitudes Oui/Non) to new format
// (hours + habit_hours). Idempotent.
const migrateState = (state: AppState): AppState => {
  const migratedRoutine: RoutineEntry[] = (state.routine ?? []).map((r: any) => {
    if ('hours' in r && r.habit_hours) return r as RoutineEntry
    const blocs = (r as any).blocs ?? 0
    const hours = (r as any).hours ?? blocs * 0.5
    const old_hab = (r as any).habitudes ?? {}
    const habit_hours: Record<string, number> = {}
    if (r.habit_hours) {
      Object.assign(habit_hours, r.habit_hours)
    } else {
      const oui = Object.entries(old_hab).filter(([, v]) => v === 'Oui').map(([k]) => k)
      if (oui.length > 0 && hours > 0) {
        const share = Math.round((hours / oui.length) * 100) / 100
        for (const h of oui) habit_hours[h] = share
      }
    }
    return {
      date: r.date,
      hours,
      notes: r.notes ?? '',
      habit_hours,
    }
  })
  const migratedTodos = (state.todos ?? []).map((t: any) => ({
    ...t,
    category: ['pro', 'finance', 'admin', 'automatisation'].includes(t.category) ? t.category : 'admin',
    duration_min: t.duration_min ?? null,
    completed_min: t.completed_min ?? null,
  }))
  return {
    ...state,
    routine: migratedRoutine,
    todos: migratedTodos,
  }
}

// ─── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: 'HYDRATE'; state: AppState }
  // Sessions
  | { type: 'ADD_SESSION'; session: Omit<VaultSession, 'id'> }
  | { type: 'DELETE_SESSION'; id: string }
  | { type: 'UPSERT_DAY_PROJECT'; date: string; project: string; hours: number; note?: string }
  | { type: 'DELETE_DAY_PROJECT'; date: string; project: string }
  // Routine
  | { type: 'SET_ROUTINE_HOURS'; date: string; hours: number }
  | { type: 'SET_HABIT_HOURS'; date: string; habit: string; hours: number }
  | { type: 'ADD_HABIT'; name: string }
  | { type: 'REMOVE_HABIT'; name: string }
  | { type: 'SET_ROUTINE_NOTES'; date: string; notes: string }
  // Todos
  | { type: 'ADD_TODO'; todo: Omit<Todo, 'id' | 'created'> }
  | { type: 'UPDATE_TODO'; id: number; patch: Partial<Todo> }
  | { type: 'TOGGLE_TODO'; id: number; completed_min?: number | null }
  | { type: 'DELETE_TODO'; id: number }

const upsertRoutine = (
  routine: RoutineEntry[],
  date: string,
  patch: (entry: RoutineEntry) => RoutineEntry,
): RoutineEntry[] => {
  const existing = routine.find(r => r.date === date)
  const base: RoutineEntry = existing ?? { date, hours: 0, habit_hours: {}, notes: '' }
  const next = patch(base)
  return existing ? routine.map(r => (r.date === date ? next : r)) : [...routine, next]
}

const reducer = (state: AppState, action: Action): AppState => {
  const now = new Date().toISOString()
  const today = todayISO()

  switch (action.type) {
    case 'HYDRATE':
      return migrateState(action.state)

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

    case 'UPSERT_DAY_PROJECT': {
      // Replace all sessions for (project, date) with a single merged one.
      // hours <= 0 → delete all sessions for that (project, date).
      const hours = Math.max(0, Math.round(action.hours * 100) / 100)
      const matching = state.sessions.filter(
        s => s.project === action.project && s.date === action.date,
      )
      const others = state.sessions.filter(
        s => !(s.project === action.project && s.date === action.date),
      )
      if (hours <= 0) {
        return {
          ...state,
          meta: { ...state.meta, updated_at: now, updated_by: 'web' },
          sessions: others,
        }
      }
      const id = matching[0]?.id ?? `${action.project}-${action.date}-${Date.now()}`
      const noteSource = action.note !== undefined ? action.note : (matching[0]?.note ?? '')
      const merged: VaultSession = {
        id,
        project: action.project,
        date: action.date,
        hours,
        note: noteSource,
      }
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        sessions: [...others, merged],
      }
    }

    case 'DELETE_DAY_PROJECT':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        sessions: state.sessions.filter(
          s => !(s.project === action.project && s.date === action.date),
        ),
      }

    case 'SET_ROUTINE_HOURS': {
      const newHours = Math.max(0, Math.round(action.hours * 100) / 100)
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        routine: upsertRoutine(state.routine, action.date, entry => ({
          ...entry,
          hours: newHours,
        })),
      }
    }

    case 'SET_HABIT_HOURS': {
      const newHabitHours = Math.max(0, Math.round(action.hours * 100) / 100)
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        routine: upsertRoutine(state.routine, action.date, entry => {
          const habit_hours = { ...entry.habit_hours, [action.habit]: newHabitHours }
          if (newHabitHours === 0) delete habit_hours[action.habit]
          // Recompute total = sum of habit hours if it was the sole driver
          // Otherwise keep max(current_total, sum_of_habits)
          const sumHabits = Object.values(habit_hours).reduce((a, b) => a + b, 0)
          const hours = Math.max(sumHabits, entry.hours ?? 0)
          return { ...entry, habit_hours, hours: Math.round(hours * 100) / 100 }
        }),
      }
    }

    case 'SET_ROUTINE_NOTES':
      return {
        ...state,
        meta: { ...state.meta, updated_at: now, updated_by: 'web' },
        routine: upsertRoutine(state.routine, action.date, entry => ({ ...entry, notes: action.notes })),
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
          {
            ...action.todo,
            id,
            created: today,
            completed_at: null,
            delegated_to: action.todo.delegated_to ?? null,
            due: action.todo.due ?? null,
            duration_min: action.todo.duration_min ?? null,
            completed_min: null,
          },
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
          if (isDone) {
            return { ...t, status: 'open', done: false, completed_at: null, completed_min: null }
          }
          // marking as done — capture completed_min
          const completed_min = action.completed_min ?? t.duration_min ?? null
          return {
            ...t,
            status: 'done',
            done: true,
            completed_at: today,
            completed_min,
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
  // dirtyRef is seeded from the persisted pending flag so that edits made
  // in a previous tab-life (iOS kill) still get flushed on next open.
  const dirtyRef = useRef(hasPendingFlag())
  const stateRef = useRef(state)
  const pushInFlightRef = useRef<Promise<void> | null>(null)
  const initialPullDoneRef = useRef(false)

  // Keep a ref to the latest state so async callbacks can always read it
  // without stale-closure bugs.
  useEffect(() => {
    stateRef.current = state
    saveCached(state)
  }, [state])

  // ── Push to GitHub ───────────────────────────────────────────────────────
  const pushNow = useCallback(async (current: AppState) => {
    if (!hasToken()) {
      setSyncStatus('no-token')
      return
    }
    setSyncStatus('syncing')
    try {
      const newSha = await writeState(current, shaRef.current)
      shaRef.current = newSha
      dirtyRef.current = false
      setPendingFlag(false)
      const now = new Date().toISOString()
      setLastSync(now)
      localStorage.setItem(LAST_SYNC_KEY, now)
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 1500)
    } catch (e) {
      console.error('[tracking] push failed', e)
      // Leave PENDING_FLAG set so we retry on next load / visibility change.
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 4000)
    }
  }, [])

  // Flush any pending debounced push RIGHT NOW and wait for it to finish.
  // Used before every pull to guarantee local edits are never overwritten.
  const flushPendingPush = useCallback(async () => {
    if (pendingWriteRef.current !== null) {
      window.clearTimeout(pendingWriteRef.current)
      pendingWriteRef.current = null
    }
    if (pushInFlightRef.current) {
      try { await pushInFlightRef.current } catch { /* ignore */ }
    }
    if (dirtyRef.current) {
      const p = pushNow(stateRef.current)
      pushInFlightRef.current = p.finally(() => { pushInFlightRef.current = null })
      try { await pushInFlightRef.current } catch { /* ignore */ }
    }
  }, [pushNow])

  // ── Pull from GitHub ──────────────────────────────────────────────────────
  const pull = useCallback(async (silent = false) => {
    // CRITICAL: flush any pending local edits BEFORE pulling, otherwise a
    // pull (manual or auto) can overwrite what the user just typed but
    // which hasn't hit the debounce timer yet.
    await flushPendingPush()

    // If push failed above, dirtyRef is still true — abort pull to preserve
    // local state (we don't want to clobber the user's work with stale cloud).
    // EXCEPTION: on the very first pull, there is no SHA yet, so writes were
    // never possible. We instead merge local onto remote and let the merged
    // state be pushed back.
    if (dirtyRef.current && initialPullDoneRef.current) {
      if (!silent) {
        setSyncStatus('error')
        setTimeout(() => setSyncStatus('idle'), 3000)
      }
      return
    }

    if (!silent) setSyncStatus('syncing')
    try {
      const { state: remote, sha } = await readState()
      shaRef.current = sha

      // Initial pull with a persisted dirty flag: merge local onto remote
      // (preserves both sides' additions) then mark dirty so the merged
      // result gets pushed. This is the iOS-kill recovery path.
      if (dirtyRef.current && !initialPullDoneRef.current) {
        const merged = mergeStates(stateRef.current, remote)
        dispatch({ type: 'HYDRATE', state: merged })
        // Keep dirtyRef / pending flag set — the mutation effect below will
        // observe the state change and schedule a push.
        setPendingFlag(true)
      } else {
        // Extra safety: if local happens to have a newer updated_at than
        // remote (shouldn't happen after the flush, but handles clock skew
        // or race conditions), keep local and trigger a reconciling push.
        const localAt = stateRef.current.meta?.updated_at ?? ''
        const remoteAt = remote.meta?.updated_at ?? ''
        if (localAt && remoteAt && localAt > remoteAt && !dirtyRef.current) {
          dirtyRef.current = true
          setPendingFlag(true)
          void pushNow(stateRef.current)
        } else {
          // HYDRATE from remote does NOT mark dirty — we explicitly skip push.
          dispatch({ type: 'HYDRATE', state: remote })
        }
      }

      initialPullDoneRef.current = true
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
  }, [flushPendingPush, pushNow])

  // Debounced push: called from the mutation effect when dirtyRef is true.
  // Debounce is short (PUSH_DEBOUNCE_MS) because iOS Safari aggressively
  // throttles/kills timers when the tab backgrounds — a long debounce
  // effectively means "lost on mobile".
  const schedulePush = useCallback(() => {
    if (pendingWriteRef.current) window.clearTimeout(pendingWriteRef.current)
    pendingWriteRef.current = window.setTimeout(() => {
      pendingWriteRef.current = null
      const p = pushNow(stateRef.current)
      pushInFlightRef.current = p.finally(() => { pushInFlightRef.current = null })
    }, PUSH_DEBOUNCE_MS)
  }, [pushNow])

  // Trigger push only when the mutation was marked dirty by a user action.
  // HYDRATE / initial cache load / strict-mode remount do NOT set dirtyRef,
  // so no spurious push fires on same-state rerenders.
  useEffect(() => {
    if (!dirtyRef.current) return
    schedulePush()
  }, [state, schedulePush])

  // Flush pending writes when the tab is about to go away.
  //
  // iOS Safari is the hard case:
  //   - beforeunload almost never fires
  //   - pagehide fires only sometimes
  //   - visibilitychange → 'hidden' is the only reliable signal when the
  //     user swipes away, locks the phone, or switches apps
  //
  // We fire on all three. PENDING_FLAG stays set until pushNow confirms
  // success, so if the browser kills our request mid-flight we recover on
  // next load.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return
      if (pendingWriteRef.current !== null) {
        window.clearTimeout(pendingWriteRef.current)
        pendingWriteRef.current = null
      }
      // Fire-and-forget: browser may kill it, but it often reaches GitHub
      const p = pushNow(stateRef.current)
      pushInFlightRef.current = p.finally(() => { pushInFlightRef.current = null })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else if (document.visibilityState === 'visible') {
        // Coming back: if we still have a pending flag, retry now.
        if (dirtyRef.current || hasPendingFlag()) {
          dirtyRef.current = true
          void pushNow(stateRef.current)
        }
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

  // ── Action creators ──────────────────────────────────────────────────────
  // Every user action goes through userDispatch, which marks the state as
  // dirty BEFORE dispatching and persists the pending flag to localStorage.
  // The mutation effect then observes dirtyRef and schedules a push.
  // HYDRATE bypasses this and never sets dirty.
  const userDispatch = useCallback((action: Action) => {
    dirtyRef.current = true
    setPendingFlag(true)
    dispatch(action)
  }, [])

  const actions = useMemo(() => ({
    addSession: (s: Omit<VaultSession, 'id'>) => userDispatch({ type: 'ADD_SESSION', session: s }),
    deleteSession: (id: string) => userDispatch({ type: 'DELETE_SESSION', id }),
    upsertDayProject: (date: string, project: string, hours: number, note?: string) =>
      userDispatch({ type: 'UPSERT_DAY_PROJECT', date, project, hours, note }),
    deleteDayProject: (date: string, project: string) =>
      userDispatch({ type: 'DELETE_DAY_PROJECT', date, project }),
    setRoutineHours: (date: string, hours: number) => userDispatch({ type: 'SET_ROUTINE_HOURS', date, hours }),
    setHabitHours: (date: string, habit: string, hours: number) => userDispatch({ type: 'SET_HABIT_HOURS', date, habit, hours }),
    setRoutineNotes: (date: string, notes: string) => userDispatch({ type: 'SET_ROUTINE_NOTES', date, notes }),
    addHabit: (name: string) => userDispatch({ type: 'ADD_HABIT', name }),
    removeHabit: (name: string) => userDispatch({ type: 'REMOVE_HABIT', name }),
    addTodo: (t: Omit<Todo, 'id' | 'created'>) => userDispatch({ type: 'ADD_TODO', todo: t }),
    updateTodo: (id: number, patch: Partial<Todo>) => userDispatch({ type: 'UPDATE_TODO', id, patch }),
    toggleTodo: (id: number, completed_min?: number | null) => userDispatch({ type: 'TOGGLE_TODO', id, completed_min }),
    deleteTodo: (id: number) => userDispatch({ type: 'DELETE_TODO', id }),
  }), [userDispatch])

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
