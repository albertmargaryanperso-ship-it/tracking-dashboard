// ─────────────────────────────────────────────────────────────────────────────
// AI — Google Gemini API for voice agent
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState } from '@/types'
import { getActiveCategories, todayISO } from '@/lib/utils'

export const AI_KEY_STORAGE = 'tracking-ai-key-v1'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export const getAiKey = (): string | null => {
  try { return localStorage.getItem(AI_KEY_STORAGE) } catch { return null }
}
export const setAiKey = (key: string | null): void => {
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key)
    else localStorage.removeItem(AI_KEY_STORAGE)
  } catch { /* */ }
}

// ─── Tool declarations (Gemini format) ─────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'add_task',
    description: "Ajouter une nouvelle tâche.",
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Texte de la tâche' },
        category: { type: 'STRING', description: 'Catégorie (ID)' },
        priority: { type: 'STRING', enum: ['urgent', 'normal', 'faible'], description: 'Priorité' },
        due: { type: 'STRING', description: "Date d'échéance YYYY-MM-DD" },
        duration_min: { type: 'NUMBER', description: 'Durée estimée en minutes' },
      },
      required: ['text', 'category'],
    },
  },
  {
    name: 'complete_task',
    description: "Marquer une tâche comme terminée.",
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'NUMBER', description: 'ID de la tâche' },
        completed_min: { type: 'NUMBER', description: 'Temps réel en minutes' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'delete_task',
    description: "Supprimer une tâche.",
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'NUMBER', description: 'ID de la tâche' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_subtask',
    description: "Ajouter une sous-tâche à une tâche existante.",
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'NUMBER', description: 'ID de la tâche parent' },
        text: { type: 'STRING', description: 'Texte de la sous-tâche' },
      },
      required: ['task_id', 'text'],
    },
  },
]

// ─── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(state: AppState): string {
  const { CATEGORY_CONFIG, CATEGORY_LIST } = getActiveCategories(state.meta.custom_categories)
  const openTodos = state.todos.filter(t => t.status !== 'done')
  const today = todayISO()

  const catList = CATEGORY_LIST.map(id => {
    const c = CATEGORY_CONFIG[id]
    return `- ${c.emoji} ${c.label} (id: "${id}")`
  }).join('\n')

  const taskList = openTodos.length === 0
    ? 'Aucune tâche en cours.'
    : openTodos.map(t => {
        const c = CATEGORY_CONFIG[t.category]
        const sub = t.subtasks?.length ? ` [${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} sous-tâches]` : ''
        const due = t.due ? ` (échéance: ${t.due}${t.due < today ? ' ⚠️EN RETARD' : t.due === today ? ' ⚠️AUJOURD\'HUI' : ''})` : ''
        return `- [#${t.id}] ${c?.emoji ?? ''} ${t.text} | ${t.status} | ${t.priority}${due}${sub}`
      }).join('\n')

  const urgentCount = openTodos.filter(t => t.priority === 'urgent').length
  const overdueCount = openTodos.filter(t => t.due && t.due < today).length

  return `Tu es l'assistant vocal personnel d'Albert. Tu parles TOUJOURS en français, tu es direct et bienveillant.

CATÉGORIES :
${catList}

TÂCHES OUVERTES (${openTodos.length}) :
${taskList}

STATS : ${urgentCount} urgent(es), ${overdueCount} en retard. Date : ${today}

RÈGLES :
1. Ta réponse sera lue à haute voix. Phrases naturelles et orales, concises (2-4 phrases max).
2. Quand tu agis : décris ce que tu fais ET exécute la fonction. Ex: "J'ajoute la tâche X en urgent."
3. Analyse sur demande : priorités, retards, charge, recommandations.
4. Trouve les tâches par nom approximatif. Cite le nom complet.
5. Catégorie par défaut = première de la liste.
6. Image → analyse et ajoute les tâches trouvées via add_task.`
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

// ─── API call with retry on 429 ────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  state: AppState,
  image?: string,
): Promise<AiResponse> {
  const apiKey = getAiKey()
  if (!apiKey) throw new Error('Clé API non configurée')

  const systemPrompt = buildSystemPrompt(state)

  // Build contents — system prompt as first turn (most compatible)
  const contents: any[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Compris, je suis prêt.' }] },
  ]

  for (const msg of messages) {
    const parts: any[] = []
    if (msg.content) parts.push({ text: msg.content })
    if (msg.image) {
      const match = msg.image.match(/^data:([^;]+);base64,(.+)$/)
      if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
    }
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts })
  }

  if (image && !messages.some(m => m.image)) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      contents.push({
        role: 'user',
        parts: [
          { text: "Analyse cette image et crée les tâches que tu vois." },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ],
      })
    }
  }

  const body = {
    contents,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
  }

  const url = `${GEMINI_URL}?key=${apiKey}`

  // Retry once on 429
  let data: any = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      data = await res.json()
      break
    }

    if (res.status === 429 && attempt < 2) {
      // Wait 5s then retry
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    // Other error — extract message
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

  if (!data) throw new Error('Erreur après 3 tentatives')

  // Parse response
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const functionCalls: FunctionCall[] = []
  let text = ''

  for (const part of parts) {
    if (part.text) text += part.text
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      })
    }
  }

  if (functionCalls.length > 0 && !text.trim()) {
    text = functionCalls.map(fc => {
      switch (fc.name) {
        case 'add_task': return `J'ajoute la tâche "${fc.arguments.text}".`
        case 'complete_task': return 'Tâche terminée.'
        case 'delete_task': return 'Tâche supprimée.'
        case 'add_subtask': return `Sous-tâche ajoutée : "${fc.arguments.text}".`
        default: return 'Action effectuée.'
      }
    }).join(' ')
  }

  return { text, functionCalls }
}
