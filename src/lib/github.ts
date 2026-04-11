// ─────────────────────────────────────────────────────────────────────────────
// GitHub API client — read/write state.json as a single source of truth
// ─────────────────────────────────────────────────────────────────────────────

import type { AppState, VaultSession } from '@/types'
import {
  CONTENTS_API_URL,
  RAW_STATE_URL,
  STATE_FILE_PATH,
  GITHUB_BRANCH,
  TOKEN_STORAGE_KEY,
} from './config'

// ─── Merge helper ────────────────────────────────────────────────────────────
// When we hit a SHA conflict on write, another writer pushed since we last
// read. We merge by picking the NEWEST version of each item (by updated_at
// for todos, by content key for sessions). This prevents stale local state
// from overwriting fresh remote changes.
const sessionKey = (s: VaultSession): string =>
  `${s.project}|${s.date}|${Math.round((s.hours ?? 0) * 100) / 100}|${(s.note ?? '').trim()}`

export const mergeStates = (local: AppState, remote: AppState): AppState => {
  // Todos — merge by id, NEWEST updated_at wins. Items only in one side are kept.
  const localById = new Map(local.todos.map(t => [t.id, t]))
  const remoteById = new Map(remote.todos.map(t => [t.id, t]))
  const allTodoIds = new Set([...localById.keys(), ...remoteById.keys()])
  const mergedTodos = Array.from(allTodoIds).map(id => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (!l) return r!
    if (!r) return l
    // Both exist — pick the one with the newest updated_at
    const lAt = l.updated_at ?? ''
    const rAt = r.updated_at ?? ''
    return lAt >= rAt ? l : r
  })

  // Sessions — union by content key (ids are unstable across writers)
  const localSessionKeys = new Set(local.sessions.map(sessionKey))
  const preservedSessions = remote.sessions.filter(s => !localSessionKeys.has(sessionKey(s)))
  const mergedSessions = [...local.sessions, ...preservedSessions]

  // Routine — union by date, newest wins (compare hours — higher = more data)
  const localRoutineMap = new Map(local.routine.map(r => [r.date, r]))
  const remoteRoutineMap = new Map(remote.routine.map(r => [r.date, r]))
  const allRoutineDates = new Set([...localRoutineMap.keys(), ...remoteRoutineMap.keys()])
  const mergedRoutine = Array.from(allRoutineDates).map(date => {
    const l = localRoutineMap.get(date)
    const r = remoteRoutineMap.get(date)
    if (!l) return r!
    if (!r) return l
    // Keep the one with more habit data (proxy for "more complete")
    const lHabits = Object.keys(l.habit_hours ?? {}).length
    const rHabits = Object.keys(r.habit_hours ?? {}).length
    if (lHabits !== rHabits) return lHabits > rHabits ? l : r
    return (l.hours ?? 0) >= (r.hours ?? 0) ? l : r
  })

  // Habitudes — union, preserving order from local first
  const mergedHabits = [...local.meta.habitudes]
  for (const h of remote.meta.habitudes ?? []) {
    if (!mergedHabits.includes(h)) mergedHabits.push(h)
  }

  // next_id — must exceed every known id on both sides
  const allIds = mergedTodos.map(t => t.id).filter(id => typeof id === 'number')
  const maxId = allIds.length > 0 ? Math.max(...allIds) : 0
  const nextId = Math.max(
    local.todos_next_id ?? 1,
    remote.todos_next_id ?? 1,
    maxId + 1,
  )

  return {
    ...local,
    meta: {
      ...local.meta,
      habitudes: mergedHabits,
    },
    sessions: mergedSessions,
    routine: mergedRoutine,
    todos: mergedTodos,
    todos_next_id: nextId,
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'no-token'

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export const setToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const hasToken = (): boolean => !!getToken()

// Base64 helpers — GitHub Contents API needs base64-encoded content.
// We use TextEncoder/Decoder to safely handle UTF-8 (emojis, accents).
const toBase64 = (input: string): string => {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

const fromBase64 = (b64: string): string => {
  const binary = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// ─── Read ────────────────────────────────────────────────────────────────────
// Strategy:
//   1. If token → use Contents API (always fresh, includes sha for writes)
//   2. Else → fetch raw URL with cache-busting (public, no auth)

export interface ReadResult {
  state: AppState
  sha: string | null
}

export const readState = async (): Promise<ReadResult> => {
  const token = getToken()

  // Always use Contents API — fresher than raw.githubusercontent CDN and
  // returns the current sha needed for conflict-free writes. Works without
  // token for public repos (subject to 60 req/h unauth rate limit).
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${CONTENTS_API_URL}?ref=${GITHUB_BRANCH}&_=${Date.now()}`, {
    headers,
    cache: 'no-store',
  })
  if (res.status === 404) throw new Error('STATE_NOT_FOUND')
  if (res.status === 403 && !token) {
    // Rate-limited without token — fall back to raw URL
    const fallback = await fetch(`${RAW_STATE_URL}?_=${Date.now()}`, { cache: 'no-store' })
    if (!fallback.ok) throw new Error(`Raw read failed: ${fallback.status}`)
    return { state: JSON.parse(await fallback.text()) as AppState, sha: null }
  }
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { content: string; encoding: string; sha: string }
  if (json.encoding !== 'base64') throw new Error(`Unexpected encoding: ${json.encoding}`)
  const text = fromBase64(json.content)
  return { state: JSON.parse(text) as AppState, sha: json.sha }
}

// ─── Write ───────────────────────────────────────────────────────────────────
// Requires a token. Uses PUT on contents API. Handles sha collision by
// refetching the latest sha and retrying once.

export const writeState = async (state: AppState, previousSha: string | null, retryCount = 0): Promise<string> => {
  const token = getToken()
  if (!token) throw new Error('NO_TOKEN')

  const stamped: AppState = {
    ...state,
    meta: {
      ...state.meta,
      updated_at: new Date().toISOString(),
      updated_by: 'web',
      version: (state.meta.version ?? 0) + 1,
    },
  }

  const body = {
    message: `[web] sync state — ${new Date().toISOString()}`,
    content: toBase64(JSON.stringify(stamped, null, 2) + '\n'),
    branch: GITHUB_BRANCH,
    ...(previousSha ? { sha: previousSha } : {}),
  }

  const res = await fetch(CONTENTS_API_URL, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 409 || res.status === 422) {
    // SHA conflict — someone pushed since we last read. Merge local onto
    // the fresh remote (preserving both sides' additions) and retry.
    if (retryCount >= 2) throw new Error(`GitHub write conflict after retry: ${res.status}`)
    const fresh = await readState()
    const merged = mergeStates(stamped, fresh.state)
    const reStamped: AppState = {
      ...merged,
      meta: {
        ...merged.meta,
        updated_at: new Date().toISOString(),
        updated_by: 'web',
        version: (fresh.state.meta.version ?? 0) + 1,
      },
    }
    return writeState(reStamped, fresh.sha, retryCount + 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub write failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { content: { sha: string } }
  return json.content.sha
}

export { STATE_FILE_PATH }
