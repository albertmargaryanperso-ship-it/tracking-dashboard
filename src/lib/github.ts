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

  if (token) {
    const res = await fetch(`${CONTENTS_API_URL}?ref=${GITHUB_BRANCH}&_=${Date.now()}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (res.status === 404) {
      throw new Error('STATE_NOT_FOUND')
    }
    if (!res.ok) {
      throw new Error(`GitHub read failed: ${res.status} ${res.statusText}`)
    }
    const json = (await res.json()) as { content: string; encoding: string; sha: string }
    if (json.encoding !== 'base64') throw new Error(`Unexpected encoding: ${json.encoding}`)
    const text = fromBase64(json.content)
    return { state: JSON.parse(text) as AppState, sha: json.sha }
  }

  // Public read via raw URL (no token needed)
  const res = await fetch(`${RAW_STATE_URL}?_=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Raw read failed: ${res.status}`)
  const text = await res.text()
  return { state: JSON.parse(text) as AppState, sha: null }
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
    // SHA conflict — refetch and retry once
    if (retryCount >= 1) throw new Error(`GitHub write conflict after retry: ${res.status}`)
    const fresh = await readState()
    return writeState({ ...stamped, meta: { ...stamped.meta, version: (fresh.state.meta.version ?? 0) + 1 } }, fresh.sha, retryCount + 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub write failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { content: { sha: string } }
  return json.content.sha
}

export { STATE_FILE_PATH }
