// ─────────────────────────────────────────────────────────────────────────────
// Config — GitHub as database
// ─────────────────────────────────────────────────────────────────────────────

export const GITHUB_OWNER = 'albertmargaryanperso-ship-it'
export const GITHUB_REPO = 'tracking-dashboard'
export const GITHUB_BRANCH = 'main'
export const STATE_FILE_PATH = 'data/state.json'

// Raw URL — public read, no auth required, cache-busted
export const RAW_STATE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${STATE_FILE_PATH}`

// Contents API — for writes (requires token) and reads (with fresh sha)
export const CONTENTS_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${STATE_FILE_PATH}`

// localStorage keys
export const TOKEN_STORAGE_KEY = 'tracking-gh-token-v1'
export const STATE_CACHE_KEY = 'tracking-state-cache-v1'
export const LAST_SYNC_KEY = 'tracking-last-sync-v1'

// Sync interval (auto-refresh)
export const AUTO_SYNC_INTERVAL_MS = 60_000 // 1 minute
