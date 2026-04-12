// ─────────────────────────────────────────────────────────────────────────────
// GitHub API client — read/write state.json as a single source of truth
// ─────────────────────────────────────────────────────────────────────────────

import type { AppState } from '@/types'
import {
  CONTENTS_API_URL,
  RAW_STATE_URL,
  STATE_FILE_PATH,
  GITHUB_BRANCH,
  TOKEN_STORAGE_KEY,
} from './config'

// ─── Merge helper ────────────────────────────────────────────────────────────
// When SHA conflict on write, merge local + remote. Newest updated_at wins
// per todo. Archive is union by month. Legacy arrays are passed through.

export const mergeStates = (local: AppState, remote: AppState): AppState => {
  // Todos — merge by id, NEWEST updated_at wins
  const localById = new Map((local.todos ?? []).map(t => [t.id, t]))
  const remoteById = new Map((remote.todos ?? []).map(t => [t.id, t]))
  const allTodoIds = new Set([...localById.keys(), ...remoteById.keys()])
  const mergedTodos = Array.from(allTodoIds).map(id => {
    const l = localById.get(id)
    const r = remoteById.get(id)
    if (!l) return r!
    if (!r) return l
    return (l.updated_at ?? '') >= (r.updated_at ?? '') ? l : r
  })

  // Archive — union by month (immutable once created)
  const localArchive = local.archive ?? []
  const remoteArchive = remote.archive ?? []
  const archiveByMonth = new Map(localArchive.map(a => [a.month, a]))
  for (const a of remoteArchive) {
    if (!archiveByMonth.has(a.month)) archiveByMonth.set(a.month, a)
  }
  const mergedArchive = Array.from(archiveByMonth.values()).sort((a, b) => a.month.localeCompare(b.month))

  // next_id
  const allIds = mergedTodos.map(t => t.id).filter(id => typeof id === 'number')
  const maxId = allIds.length > 0 ? Math.max(...allIds) : 0
  const nextId = Math.max(local.todos_next_id ?? 1, remote.todos_next_id ?? 1, maxId + 1)

  // Legacy arrays — keep the longer side (no new writes happen)
  const sessions = (local.sessions?.length ?? 0) >= (remote.sessions?.length ?? 0) ? local.sessions : remote.sessions
  const travail = (local.travail?.length ?? 0) >= (remote.travail?.length ?? 0) ? local.travail : remote.travail
  const routine = (local.routine?.length ?? 0) >= (remote.routine?.length ?? 0) ? local.routine : remote.routine

  // Meta — take the newer side for base, but merge custom fields intelligently
  const localNewer = (local.meta.updated_at ?? '') >= (remote.meta.updated_at ?? '')
  const baseMeta = localNewer ? local.meta : remote.meta
  const otherMeta = localNewer ? remote.meta : local.meta

  // For arrays: keep the longer/more complete side (prevents losing added tabs/categories)
  const pickBest = <T,>(a?: T[] | null, b?: T[] | null): T[] | undefined => {
    const aa = a && a.length > 0 ? a : null
    const bb = b && b.length > 0 ? b : null
    if (!aa && !bb) return undefined
    if (!aa) return bb!
    if (!bb) return aa
    return aa.length >= bb.length ? aa : bb
  }

  const mergedMeta = {
    ...baseMeta,
    version: Math.max(local.meta.version ?? 0, remote.meta.version ?? 0),
    custom_categories: pickBest(local.meta.custom_categories, remote.meta.custom_categories),
    custom_tabs: pickBest(local.meta.custom_tabs, remote.meta.custom_tabs),
    app_name: baseMeta.app_name ?? otherMeta.app_name,
    app_emoji: baseMeta.app_emoji ?? otherMeta.app_emoji,
  }

  return {
    meta: mergedMeta,
    todos: mergedTodos,
    todos_next_id: nextId,
    archive: mergedArchive,
    sessions,
    travail,
    routine,
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'no-token'

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
}
export const setToken = (token: string | null): void => {
  try { if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token); else localStorage.removeItem(TOKEN_STORAGE_KEY) } catch { /* */ }
}
export const hasToken = (): boolean => !!getToken()

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
export interface ReadResult { state: AppState; sha: string | null }

export const readState = async (): Promise<ReadResult> => {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${CONTENTS_API_URL}?ref=${GITHUB_BRANCH}&_=${Date.now()}`, { headers, cache: 'no-store' })
  if (res.status === 404) throw new Error('STATE_NOT_FOUND')
  if (res.status === 403 && !token) {
    const fallback = await fetch(`${RAW_STATE_URL}?_=${Date.now()}`, { cache: 'no-store' })
    if (!fallback.ok) throw new Error(`Raw read failed: ${fallback.status}`)
    return { state: JSON.parse(await fallback.text()) as AppState, sha: null }
  }
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { content: string; encoding: string; sha: string }
  if (json.encoding !== 'base64') throw new Error(`Unexpected encoding: ${json.encoding}`)
  return { state: JSON.parse(fromBase64(json.content)) as AppState, sha: json.sha }
}

// ─── Write ───────────────────────────────────────────────────────────────────
export const writeState = async (state: AppState, previousSha: string | null, retryCount = 0): Promise<string> => {
  const token = getToken()
  if (!token) throw new Error('NO_TOKEN')

  // Before writing, read remote to preserve custom fields that local might not have
  let remoteMeta: AppState['meta'] | null = null
  try {
    if (previousSha) {
      const { state: remoteState } = await readState()
      remoteMeta = remoteState.meta
    }
  } catch { /* ignore — will write local as-is */ }

  // Pick the longer/richer array (prevents losing user-added tabs)
  const best = <T,>(a?: T[] | null, b?: T[] | null): T[] | undefined => {
    const aa = a && a.length > 0 ? a : null
    const bb = b && b.length > 0 ? b : null
    if (!aa) return bb ?? undefined
    if (!bb) return aa
    return aa.length >= bb.length ? aa : bb
  }

  const mergedMeta = {
    ...state.meta,
    updated_at: new Date().toISOString(),
    updated_by: 'web' as const,
    version: (state.meta.version ?? 0) + 1,
    custom_tabs: best(state.meta.custom_tabs, remoteMeta?.custom_tabs),
    custom_categories: best(state.meta.custom_categories, remoteMeta?.custom_categories),
    app_name: state.meta.app_name ?? remoteMeta?.app_name,
    app_emoji: state.meta.app_emoji ?? remoteMeta?.app_emoji,
  }

  const stamped: AppState = { ...state, meta: mergedMeta }

  // JSON.stringify replacer: convert undefined to null so keys are preserved on remote
  const jsonReplacer = (_key: string, value: unknown) => value === undefined ? null : value

  const body = {
    message: `[web] sync state — ${new Date().toISOString()}`,
    content: toBase64(JSON.stringify(stamped, jsonReplacer, 2) + '\n'),
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
    if (retryCount >= 2) throw new Error(`GitHub write conflict after retry: ${res.status}`)
    const fresh = await readState()
    const merged = mergeStates(stamped, fresh.state)
    const reStamped: AppState = {
      ...merged,
      meta: { ...merged.meta, updated_at: new Date().toISOString(), updated_by: 'web', version: (fresh.state.meta.version ?? 0) + 1 },
    }
    return writeState(reStamped, fresh.sha, retryCount + 1)
  }

  if (!res.ok) throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { content: { sha: string } }
  return json.content.sha
}

export { STATE_FILE_PATH }
