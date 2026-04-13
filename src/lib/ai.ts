// ─────────────────────────────────────────────────────────────────────────────
// AI — Google Gemini integration for voice agent
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState } from '@/types'
import { getActiveCategories } from '@/lib/utils'

export const AI_KEY_STORAGE = 'tracking-ai-key-v1'
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

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
    description: "Ajouter une nouvelle tâche. Utiliser quand l'utilisateur demande d'ajouter, créer, noter une tâche.",
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Texte de la tâche' },
        category: { type: 'STRING', description: 'Catégorie (ID)' },
        priority: { type: 'STRING', enum: ['urgent', 'normal', 'faible'], description: 'Priorité' },
        due: { type: 'STRING', description: "Date d'échéance YYYY-MM-DD (optionnel)" },
        duration_min: { type: 'NUMBER', description: 'Durée estimée en minutes (optionnel)' },
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
        completed_min: { type: 'NUMBER', description: 'Temps réel en minutes (optionnel)' },
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

  const catList = CATEGORY_LIST.map(id => {
    const c = CATEGORY_CONFIG[id]
    return `- ${c.emoji} ${c.label} (id: "${id}")`
  }).join('\n')

  const taskList = openTodos.length === 0
    ? 'Aucune tâche en cours.'
    : openTodos.map(t => {
        const c = CATEGORY_CONFIG[t.category]
        const sub = t.subtasks?.length ? ` [${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} sous-tâches]` : ''
        const due = t.due ? ` (échéance: ${t.due})` : ''
        return `- [#${t.id}] ${c?.emoji ?? ''} ${t.text} | ${t.status}${t.priority === 'urgent' ? ' 🔴URGENT' : ''}${due}${sub}`
      }).join('\n')

  return `Tu es l'assistant vocal du dashboard de productivité d'Albert. Tu parles français, tu es concis et direct.

CATÉGORIES DISPONIBLES :
${catList}

TÂCHES EN COURS :
${taskList}

RÈGLES :
- Réponds toujours en français
- Sois ultra-concis (2-3 phrases max, c'est de la voix pas du texte)
- Quand l'utilisateur mentionne une tâche par son nom, trouve la plus proche dans la liste
- Si la catégorie n'est pas claire, utilise la première catégorie
- Pour les priorités : urgent = critique/important/aujourd'hui, normal = par défaut, faible = optionnel/plus tard
- Ne liste pas toutes les tâches sauf si demandé explicitement
- Si une image est fournie, analyse-la pour extraire les tâches et utilise add_task pour chacune
- Exécute les actions via les fonctions disponibles, puis confirme brièvement`
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  image?: string // base64 data URL
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
  if (!apiKey) throw new Error('Clé API Gemini non configurée')

  const systemPrompt = buildSystemPrompt(state)

  // Build Gemini contents
  const contents: any[] = []

  for (const msg of messages) {
    const parts: any[] = []

    if (msg.content) parts.push({ text: msg.content })

    if (msg.image) {
      // Extract base64 from data URL
      const match = msg.image.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        parts.push({
          inlineData: { mimeType: match[1], data: match[2] },
        })
      }
    }

    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts })
  }

  // If standalone image
  if (image && !messages.some(m => m.image)) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      contents.push({
        role: 'user',
        parts: [
          { text: "Analyse cette image et extrait les tâches visibles. Utilise add_task pour chacune." },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ],
      })
    }
  }

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${res.status} — ${err}`)
  }

  const data = await res.json()
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

  // Auto-generate confirmation if only function calls, no text
  if (functionCalls.length > 0 && !text.trim()) {
    text = functionCalls.map(fc => {
      switch (fc.name) {
        case 'add_task': return `Tâche ajoutée : ${fc.arguments.text}`
        case 'complete_task': return 'Tâche terminée.'
        case 'delete_task': return 'Tâche supprimée.'
        case 'add_subtask': return `Sous-tâche ajoutée : ${fc.arguments.text}`
        default: return 'Action effectuée.'
      }
    }).join(' ')
  }

  return { text, functionCalls }
}
