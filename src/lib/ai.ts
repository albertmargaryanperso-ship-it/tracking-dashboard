// ─────────────────────────────────────────────────────────────────────────────
// AI — Groq API (free, fast) for voice agent
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

// ─── Tool definitions (OpenAI format — Groq compatible) ────────────────────

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_task',
      description: "Ajouter une nouvelle tâche.",
      parameters: {
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
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete_task',
      description: "Marquer une tâche comme terminée.",
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID de la tâche' },
          completed_min: { type: 'number', description: 'Temps réel en minutes' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_task',
      description: "Supprimer une tâche.",
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID de la tâche' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_subtask',
      description: "Ajouter une sous-tâche à une tâche existante.",
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'number', description: 'ID de la tâche parent' },
          text: { type: 'string', description: 'Texte de la sous-tâche' },
        },
        required: ['task_id', 'text'],
      },
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
        const due = t.due ? ` (échéance: ${t.due}${t.due < today ? ' EN RETARD' : t.due === today ? ' AUJOURD\'HUI' : ''})` : ''
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

RÈGLES ABSOLUES :
1. Ta réponse sera lue à haute voix. Phrases naturelles, concises.
2. OBLIGATION : quand l'utilisateur veut ajouter/supprimer/terminer une tâche, tu DOIS appeler la fonction correspondante (add_task, delete_task, complete_task, add_subtask). NE DÉCRIS PAS l'action sans appeler la fonction.
3. Appelle TOUJOURS la fonction ET réponds avec du texte de confirmation.
4. Analyse sur demande : priorités, retards, charge, recommandations.
5. Trouve les tâches par nom approximatif. Cite le nom complet.
6. Catégorie par défaut = première de la liste ("${CATEGORY_LIST[0]}").
7. Priorité par défaut = normal.

FLOW D'AJOUT DE TÂCHE (conversation guidée, étape par étape) :
1. L'utilisateur dit "ajoute une tâche X" → tu NE crées PAS encore. D'abord tu demandes :
   "Dans quelle catégorie ? [liste les catégories disponibles avec emoji]"
2. L'utilisateur répond la catégorie → tu demandes :
   "C'est urgent, normal ou faible priorité ?"
3. L'utilisateur répond → tu ESTIMES un temps réaliste et demandes :
   "Je dirais environ X minutes, ça te va ?"
4. L'utilisateur confirme ou corrige le temps → tu appelles add_task avec tous les paramètres.
5. Puis tu PROPOSES des sous-tâches pertinentes :
   "Tu veux des sous-tâches ? Par exemple : [2-3 suggestions contextuelles]"
6. Si oui → appelle add_subtask, puis demande "Autre sous-tâche ?"
7. Si non → "C'est noté, la tâche est prête."

RACCOURCI : Si l'utilisateur donne déjà la catégorie/priorité/temps dans sa demande, saute les étapes correspondantes et passe directement à la création.

Tu gardes le contexte : si on vient d'ajouter la tâche #42, les sous-tâches suivantes vont dessus sans redemander.`
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
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 400,
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
  const choice = data.choices?.[0]

  const functionCalls: FunctionCall[] = []
  let text = choice?.message?.content ?? ''

  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      if (tc.type === 'function') {
        try {
          functionCalls.push({
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })
        } catch { /* skip malformed */ }
      }
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

  // FALLBACK: if model described an add action in text but didn't call the tool
  if (functionCalls.length === 0 && text) {
    const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? ''
    const addMatch = text.match(/(?:j'ajoute|ajouté|ajouter|créé|je crée).*?[«""](.+?)[»""]/i)
      || text.match(/(?:tâche|task)\s*[:\-]\s*(.+?)(?:\.|$)/i)

    if (addMatch && (lastUserMsg.includes('ajoute') || lastUserMsg.includes('créer') || lastUserMsg.includes('crée') || lastUserMsg.includes('note') || lastUserMsg.includes('tâche'))) {
      const { CATEGORY_LIST: cats } = getActiveCategories(state.meta.custom_categories)
      functionCalls.push({
        name: 'add_task',
        arguments: {
          text: addMatch[1].trim(),
          category: cats[0] || 'admin',
          priority: lastUserMsg.includes('urgent') ? 'urgent' : 'normal',
        },
      })
    }
  }

  return { text, functionCalls }
}
