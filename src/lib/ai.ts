// ─────────────────────────────────────────────────────────────────────────────
// AI — Groq API (free) — text-based action parsing (no native tool calling)
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState } from '@/types'
import { getActiveCategories, todayISO } from '@/lib/utils'

export const AI_KEY_STORAGE = 'tracking-ai-key-v1'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

export const getAiKey = (): string | null => {
  try { return localStorage.getItem(AI_KEY_STORAGE) } catch { return null }
}
export const setAiKey = (key: string | null): void => {
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key)
    else localStorage.removeItem(AI_KEY_STORAGE)
  } catch { /* */ }
}

// ─── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(state: AppState): string {
  const { CATEGORY_CONFIG, CATEGORY_LIST } = getActiveCategories(state.meta.custom_categories)
  const openTodos = state.todos.filter(t => t.status !== 'done')
  const today = todayISO()

  const catList = CATEGORY_LIST.map(id => {
    const c = CATEGORY_CONFIG[id]
    return `${c.emoji} ${c.label} (id="${id}")`
  }).join(', ')

  const taskList = openTodos.length === 0
    ? 'Aucune tâche en cours.'
    : openTodos.map(t => {
        const c = CATEGORY_CONFIG[t.category]
        const sub = t.subtasks?.length ? ` [${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} sous-tâches]` : ''
        const due = t.due ? ` (éch: ${t.due}${t.due < today ? ' RETARD' : ''})` : ''
        const dur = t.duration_min ? ` ~${t.duration_min}min` : ''
        return `#${t.id} ${c?.emoji ?? ''} ${t.text} | ${t.priority}${due}${dur}${sub}`
      }).join('\n')

  const urgentCount = openTodos.filter(t => t.priority === 'urgent').length
  const overdueCount = openTodos.filter(t => t.due && t.due < today).length

  return `Tu es l'assistant vocal d'Albert. Français uniquement, concis (voix).

CATÉGORIES : ${catList}
TÂCHES (${openTodos.length}, ${urgentCount} urgentes, ${overdueCount} en retard) :
${taskList}
Date : ${today}

ACTIONS — quand tu veux agir, inclus UN tag par action dans ta réponse :
- Ajouter : [ADD text="${'la tâche'}" cat="${CATEGORY_LIST[0]}" pri="normal" dur="30"]
- Sous-tâche : [SUB id=TASK_ID text="la sous-tâche"]
- Terminer : [DONE id=TASK_ID min=TEMPS_REEL]
- Supprimer : [DEL id=TASK_ID]

EXEMPLES de réponse correcte :
"J'ajoute la tâche en pro urgent. [ADD text="Appeler le comptable" cat="pro" pri="urgent" dur="15"] Tu veux des sous-tâches ?"
"Sous-tâche ajoutée. [SUB id=42 text="Retrouver le numéro"] Autre sous-tâche ?"
"Tâche terminée. [DONE id=42 min=20]"

FLOW AJOUT :
1. L'utilisateur veut ajouter → demande catégorie (si pas précisée)
2. Demande priorité (si pas précisée)
3. Estime un temps et demande confirmation
4. Crée avec le tag [ADD ...]
5. Propose 2-3 sous-tâches pertinentes
6. Si oui → [SUB ...] puis "Autre sous-tâche ?"
7. Si non → "C'est noté."

RACCOURCI : si tout est précisé d'emblée, crée directement.
Garde le contexte : après un ADD, les SUB suivants utilisent l'ID de cette tâche.
Pour analyse/discussion : réponds normalement sans tag.`
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

// ─── Parse action tags from text ───────────────────────────────────────────

function parseActions(text: string): { cleanText: string; calls: FunctionCall[] } {
  const calls: FunctionCall[] = []

  // [ADD text="..." cat="..." pri="..." dur="..."]
  const addRe = /\[ADD\s+text="([^"]+)"\s*cat="([^"]+)"\s*pri="([^"]+)"\s*dur="(\d+)"\s*\]/gi
  let match
  while ((match = addRe.exec(text)) !== null) {
    calls.push({
      name: 'add_task',
      arguments: {
        text: match[1],
        category: match[2],
        priority: match[3],
        duration_min: parseInt(match[4], 10),
      },
    })
  }

  // [SUB id=N text="..."]
  const subRe = /\[SUB\s+id=(\d+)\s+text="([^"]+)"\s*\]/gi
  while ((match = subRe.exec(text)) !== null) {
    calls.push({
      name: 'add_subtask',
      arguments: { task_id: parseInt(match[1], 10), text: match[2] },
    })
  }

  // [DONE id=N min=N]
  const doneRe = /\[DONE\s+id=(\d+)(?:\s+min=(\d+))?\s*\]/gi
  while ((match = doneRe.exec(text)) !== null) {
    calls.push({
      name: 'complete_task',
      arguments: { task_id: parseInt(match[1], 10), completed_min: match[2] ? parseInt(match[2], 10) : undefined },
    })
  }

  // [DEL id=N]
  const delRe = /\[DEL\s+id=(\d+)\s*\]/gi
  while ((match = delRe.exec(text)) !== null) {
    calls.push({
      name: 'delete_task',
      arguments: { task_id: parseInt(match[1], 10) },
    })
  }

  // Remove tags from spoken text
  const cleanText = text
    .replace(/\[ADD[^\]]*\]/gi, '')
    .replace(/\[SUB[^\]]*\]/gi, '')
    .replace(/\[DONE[^\]]*\]/gi, '')
    .replace(/\[DEL[^\]]*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { cleanText, calls }
}

// ─── API call ──────────────────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  state: AppState,
  _image?: string,
): Promise<AiResponse> {
  const apiKey = getAiKey()
  if (!apiKey) throw new Error('Clé API non configurée')

  const systemPrompt = buildSystemPrompt(state)

  const apiMessages: any[] = [
    { role: 'system', content: systemPrompt },
  ]
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content })
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: apiMessages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    let msg = `[${res.status}]`
    try {
      const parsed = JSON.parse(errBody)
      msg += ` ${parsed?.error?.message?.slice(0, 150) || ''}`
    } catch {
      msg += ` ${errBody.slice(0, 150)}`
    }
    throw new Error(msg)
  }

  const data = await res.json()
  const rawText = data.choices?.[0]?.message?.content ?? ''

  // Parse action tags
  const { cleanText, calls } = parseActions(rawText)

  return { text: cleanText, functionCalls: calls }
}
