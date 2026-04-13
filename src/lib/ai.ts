// ─────────────────────────────────────────────────────────────────────────────
// AI — Anthropic Claude API for voice agent
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState } from '@/types'
import { getActiveCategories, todayISO } from '@/lib/utils'

export const AI_KEY_STORAGE = 'tracking-ai-key-v1'

export const getAiKey = (): string | null => {
  try { return localStorage.getItem(AI_KEY_STORAGE) } catch { return null }
}
export const setAiKey = (key: string | null): void => {
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key)
    else localStorage.removeItem(AI_KEY_STORAGE)
  } catch { /* */ }
}

// ─── Tool definitions (Claude format) ──────────────────────────────────────

const TOOLS = [
  {
    name: 'add_task',
    description: "Ajouter une nouvelle tâche.",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texte de la tâche' },
        category: { type: 'string', description: 'Catégorie (ID)' },
        priority: { type: 'string', enum: ['urgent', 'normal', 'faible'], description: 'Priorité' },
        due: { type: 'string', description: "Date d'échéance YYYY-MM-DD" },
        duration_min: { type: 'number', description: 'Durée estimée en minutes' },
      },
      required: ['text', 'category'],
    },
  },
  {
    name: 'complete_task',
    description: "Marquer une tâche comme terminée.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'ID de la tâche' },
        completed_min: { type: 'number', description: 'Temps réel en minutes' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'delete_task',
    description: "Supprimer une tâche.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'ID de la tâche' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_subtask',
    description: "Ajouter une sous-tâche à une tâche existante.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'ID de la tâche parent' },
        text: { type: 'string', description: 'Texte de la sous-tâche' },
      },
      required: ['task_id', 'text'],
    },
  },
]

// ─── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(state: AppState): string {
  const { CATEGORY_CONFIG, CATEGORY_LIST } = getActiveCategories(state.meta.custom_categories)
  const openTodos = state.todos.filter(t => t.status !== 'done')
  const doneTodos = state.todos.filter(t => t.status === 'done')
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
        const dur = t.duration_min ? ` ~${t.duration_min}min` : ''
        return `- [#${t.id}] ${c?.emoji ?? ''} ${t.text} | ${t.status} | ${t.priority}${due}${dur}${sub}`
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
6. Image → analyse et propose d'ajouter les tâches trouvées via add_task.`
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

// ─── API call ──────────────────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  state: AppState,
  image?: string,
): Promise<AiResponse> {
  const apiKey = getAiKey()
  if (!apiKey) throw new Error('Clé API Claude non configurée')

  const systemPrompt = buildSystemPrompt(state)

  // Build Claude messages
  const apiMessages: any[] = []

  for (const msg of messages) {
    const content: any[] = []

    if (msg.image) {
      const match = msg.image.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: match[1], data: match[2] },
        })
      }
    }

    if (msg.content) {
      content.push({ type: 'text', text: msg.content })
    }

    apiMessages.push({ role: msg.role, content })
  }

  // Standalone image
  if (image && !messages.some(m => m.image)) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      apiMessages.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } },
          { type: 'text', text: "Analyse cette image et crée les tâches que tu vois." },
        ],
      })
    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: systemPrompt,
      messages: apiMessages,
      tools: TOOLS,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    let msg = `[${res.status}]`
    try {
      const parsed = JSON.parse(errBody)
      msg += ` ${parsed?.error?.message || errBody.slice(0, 150)}`
    } catch {
      msg += ` ${errBody.slice(0, 150)}`
    }
    throw new Error(msg)
  }

  const data = await res.json()
  const blocks = data.content ?? []

  const functionCalls: FunctionCall[] = []
  let text = ''

  for (const block of blocks) {
    if (block.type === 'text') text += block.text
    if (block.type === 'tool_use') {
      functionCalls.push({ name: block.name, arguments: block.input ?? {} })
    }
  }

  // Auto-generate spoken confirmation if only tool calls
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
