// ─────────────────────────────────────────────────────────────────────────────
// AI — Puter.js (free, no API key, no rate limit)
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState, Stats } from '@/types'
import { getActiveCategories, getActiveTabs, todayISO } from '@/lib/utils'

// Legacy key storage (kept for backward compat, not needed with Puter)
export const AI_KEY_STORAGE = 'tracking-ai-key-v1'
export const getAiKey = (): string | null => 'puter' // always "configured"
export const setAiKey = (_key: string | null): void => {}

declare const puter: any

// ─── System prompt (COMPACT) ───────────────────────────────────────────────

function buildSystemPrompt(state: AppState): string {
  const { CATEGORY_CONFIG } = getActiveCategories(state.meta.custom_categories)
  const tabs = getActiveTabs(state.meta.custom_tabs)
  const todoTabs = tabs.filter(t => t.type === 'todos')
  const openTodos = state.todos.filter(t => t.status !== 'done')
  const today = todayISO()

  const tabCats = todoTabs.map(tab => {
    const cats = (tab.categoryFilter ?? []).map(id => CATEGORY_CONFIG[id]).filter(Boolean)
    return `${tab.label}: ${cats.map(c => `${c.label}(${c.id})`).join(',')}`
  }).join(' | ')

  const taskLines = openTodos.slice(0, 12).map(t => {
    const c = CATEGORY_CONFIG[t.category]
    const due = t.due && t.due <= today ? '!RETARD' : ''
    const sub = t.subtasks?.length ? ` ${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}st` : ''
    return `#${t.id} ${c?.emoji??''}${t.text}|${t.priority}${due}${sub}`
  }).join('\n')

  const proCats = todoTabs[0]?.categoryFilter?.map(id => CATEGORY_CONFIG[id]?.label).join('/') ?? ''
  const persoCats = todoTabs[1]?.categoryFilter?.map(id => CATEGORY_CONFIG[id]?.label).join('/') ?? ''

  return `Rocko, assistant vocal d'Albert. FR. Tutoie. TIMIDE CONCIS — max 1-2 phrases. Albert mène.
${tabCats}
Tâches(${openTodos.length}):
${taskLines || 'Aucune'}
Date:${today}

TAGS fin de réponse: [ADD text="NOM" cat="ID" pri="normal" dur="30"] [SUB id=N text="NOM"] [DONE id=N min=N] [DEL id=N] [CHECK id=N sid="SID"] [LOG text="NOM" cat="ID" pri="normal" dur="30" min="25"]
Tous les champs=valeurs réelles de la conversation.

AJOUT 1 question/réponse: "Pro ou perso?"→"Quelle catégorie?"→"Urgent/normal/faible?"→"Je dirais Xmin, ok?"→[ADD]→"Des sous-tâches?"→[SUB]→"Une autre?"→récap court.
Catégories si erreur: pro=${proCats}, perso=${persoCats}. Onglets=${todoTabs.map(t=>t.label).join('/')}.
LOG=même flow+demander temps passé. Analyse=si demandé, lister retards/urgences.`
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

export interface FunctionCall {
  name: string
  arguments: Record<string, any>
}

export interface AiResponse {
  text: string
  functionCalls: FunctionCall[]
}

// ─── Parse action tags ─────────────────────────────────────────────────────

function parseActions(text: string): { cleanText: string; calls: FunctionCall[] } {
  const calls: FunctionCall[] = []
  let match

  const addRe = /\[ADD\s+text="([^"]+)"\s*cat="([^"]+)"\s*pri="([^"]+)"\s*dur="(\d+)"\s*\]/gi
  while ((match = addRe.exec(text)) !== null) {
    calls.push({ name: 'add_task', arguments: { text: match[1], category: match[2], priority: match[3], duration_min: parseInt(match[4], 10) } })
  }

  const logRe = /\[LOG\s+text="([^"]+)"\s*cat="([^"]+)"\s*pri="([^"]+)"\s*dur="(\d+)"\s*min="(\d+)"\s*\]/gi
  while ((match = logRe.exec(text)) !== null) {
    calls.push({ name: 'log_task', arguments: { text: match[1], category: match[2], priority: match[3], duration_min: parseInt(match[4], 10), completed_min: parseInt(match[5], 10) } })
  }

  const subRe = /\[SUB\s+id=(\d+)\s+text="([^"]+)"\s*\]/gi
  while ((match = subRe.exec(text)) !== null) {
    calls.push({ name: 'add_subtask', arguments: { task_id: parseInt(match[1], 10), text: match[2] } })
  }

  const doneRe = /\[DONE\s+id=(\d+)(?:\s+min=(\d+))?\s*\]/gi
  while ((match = doneRe.exec(text)) !== null) {
    calls.push({ name: 'complete_task', arguments: { task_id: parseInt(match[1], 10), completed_min: match[2] ? parseInt(match[2], 10) : undefined } })
  }

  const delRe = /\[DEL\s+id=(\d+)\s*\]/gi
  while ((match = delRe.exec(text)) !== null) {
    calls.push({ name: 'delete_task', arguments: { task_id: parseInt(match[1], 10) } })
  }

  const checkRe = /\[CHECK\s+id=(\d+)\s+sid="([^"]+)"\s*\]/gi
  while ((match = checkRe.exec(text)) !== null) {
    calls.push({ name: 'check_subtask', arguments: { task_id: parseInt(match[1], 10), subtask_id: match[2] } })
  }

  const cleanText = text
    .replace(/\[ADD[^\]]*\]/gi, '').replace(/\[SUB[^\]]*\]/gi, '').replace(/\[DONE[^\]]*\]/gi, '')
    .replace(/\[DEL[^\]]*\]/gi, '').replace(/\[CHECK[^\]]*\]/gi, '').replace(/\[LOG[^\]]*\]/gi, '')
    .replace(/\s{2,}/g, ' ').trim()

  return { cleanText, calls }
}

// ─── API call via Puter.js ─────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  state: AppState,
  _stats?: Stats,
  _image?: string,
): Promise<AiResponse> {
  if (typeof puter === 'undefined') throw new Error('Puter.js pas encore chargé — rafraîchis la page')

  const systemPrompt = buildSystemPrompt(state)

  // Build messages for Puter (OpenAI format)
  const apiMessages: any[] = [{ role: 'system', content: systemPrompt }]
  for (const msg of messages.slice(-6)) {
    apiMessages.push({ role: msg.role, content: msg.content })
  }

  try {
    const response = await puter.ai.chat(apiMessages, { model: 'claude-sonnet-4-20250514' })
    // Debug: log full response structure
    console.log('PUTER RESPONSE:', JSON.stringify(response, null, 2))
    // Extract text from whatever Puter returns
    let rawText = ''
    if (typeof response === 'string') rawText = response
    else if (typeof response?.message?.content === 'string') rawText = response.message.content
    else if (Array.isArray(response?.message?.content)) rawText = response.message.content.map((b: any) => b.text || '').join('')
    else if (typeof response?.content === 'string') rawText = response.content
    else if (Array.isArray(response?.content)) rawText = response.content.map((b: any) => b.text || '').join('')
    else if (typeof response?.text === 'string') rawText = response.text
    else if (typeof response?.choices?.[0]?.message?.content === 'string') rawText = response.choices[0].message.content
    else rawText = 'Erreur: réponse inattendue. Ouvre la console (F12) pour voir les détails.'
    const { cleanText, calls } = parseActions(rawText)
    return { text: cleanText, functionCalls: calls }
  } catch (e: any) {
    throw new Error(e.message || 'Erreur Puter.js')
  }
}
