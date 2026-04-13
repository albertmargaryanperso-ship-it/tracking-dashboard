// ─────────────────────────────────────────────────────────────────────────────
// AI — Google Gemini integration for voice agent
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState } from '@/types'
import { getActiveCategories, todayISO } from '@/lib/utils'

export const AI_KEY_STORAGE = 'tracking-ai-key-v1'
// Try models in order on quota errors
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest']
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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
    description: "Ajouter une nouvelle tâche APRÈS confirmation orale de l'utilisateur.",
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
    description: "Marquer une tâche comme terminée APRÈS confirmation.",
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
    description: "Supprimer une tâche APRÈS confirmation.",
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
    description: "Ajouter une sous-tâche APRÈS confirmation.",
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
        const sub = t.subtasks?.length ? ` [sous-tâches: ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}]` : ''
        const due = t.due ? ` (échéance: ${t.due}${t.due < today ? ' ⚠️EN RETARD' : t.due === today ? ' ⚠️AUJOURD\'HUI' : ''})` : ''
        const dur = t.duration_min ? ` ~${t.duration_min}min` : ''
        const del = t.delegated_to ? ` → délégué à ${t.delegated_to}` : ''
        return `- [#${t.id}] ${c?.emoji ?? ''} ${t.text} | ${t.status} | ${t.priority}${due}${dur}${del}${sub}`
      }).join('\n')

  const urgentCount = openTodos.filter(t => t.priority === 'urgent').length
  const overdueCount = openTodos.filter(t => t.due && t.due < today).length
  const todayCount = openTodos.filter(t => t.due === t.due && t.due === today).length
  const doneThisWeek = doneTodos.filter(t => {
    if (!t.completed_at) return false
    const d = new Date(t.completed_at)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return d >= weekAgo
  }).length

  return `Tu es l'assistant vocal personnel d'Albert. Tu parles TOUJOURS en français, tu es direct et bienveillant.

Tu connais toutes ses tâches et tu peux les analyser, donner des conseils, et agir dessus.

CATÉGORIES :
${catList}

TÂCHES OUVERTES (${openTodos.length}) :
${taskList}

STATS RAPIDES :
- 🔴 ${urgentCount} urgent(es)
- ⚠️ ${overdueCount} en retard
- 📅 ${todayCount} pour aujourd'hui
- ✅ ${doneThisWeek} terminée(s) cette semaine
- Date du jour : ${today}

═══ RÈGLES DE COMPORTEMENT ═══

1. TOUJOURS PARLER — Ta réponse sera lue à haute voix. Formule des phrases naturelles et orales, pas du texte écrit. Sois concis (2-4 phrases).

2. CONFIRMER AVANT D'AGIR — Quand l'utilisateur demande une action (ajouter, supprimer, terminer) :
   - D'abord DÉCRIS ce que tu vas faire dans ta réponse textuelle
   - ET exécute la fonction en même temps
   Exemple : "J'ajoute la tâche 'Appeler le comptable' en urgent dans admin."

3. ANALYSER SUR DEMANDE — Si l'utilisateur demande un point, un bilan, ou pose une question sur ses tâches :
   - Analyse les priorités, les retards, la charge
   - Donne des recommandations concrètes
   - Propose des actions
   Exemple : "Tu as 3 tâches en retard dont 2 urgentes. Je te recommande de commencer par..."

4. ÊTRE PROACTIF — Si tu vois des anomalies (beaucoup de retard, tâches urgentes non traitées), mentionne-le.

5. IDENTIFIER LES TÂCHES — Quand l'utilisateur mentionne une tâche par son nom (même approximatif), trouve la correspondance la plus proche dans la liste. Cite toujours le nom complet.

6. CATÉGORIE PAR DÉFAUT — Si pas claire, utilise la première catégorie de la liste.

7. IMAGE → TÂCHES — Si une image est fournie, analyse-la, liste les tâches trouvées, et propose de les ajouter. Utilise add_task pour chacune.`
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
      const match = msg.image.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
      }
    }
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts })
  }

  if (image && !messages.some(m => m.image)) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      contents.push({
        role: 'user',
        parts: [
          { text: "Analyse cette image. Si tu vois des tâches ou une liste, extrais-les et propose de les ajouter." },
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
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  }

  // Try each model until one works (handles 429 quota per-model)
  let lastError = ''
  let data: any = null

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        data = await res.json()
        break
      }
      if (res.status === 429 || res.status === 404) {
        lastError = res.status === 429 ? `Quota dépassé sur ${model}` : `Modèle ${model} non trouvé`
        continue // try next model
      }
      const errBody = await res.text().catch(() => '')
      lastError = `Erreur ${res.status}${errBody ? ` — ${errBody.slice(0, 100)}` : ''}`
      break // non-retryable error
    } catch (e: any) {
      lastError = e.message
      continue
    }
  }

  if (!data) throw new Error(lastError || 'Tous les modèles sont indisponibles')
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

  // If only function calls and no text, generate spoken confirmation
  if (functionCalls.length > 0 && !text.trim()) {
    text = functionCalls.map(fc => {
      switch (fc.name) {
        case 'add_task': return `J'ajoute la tâche "${fc.arguments.text}".`
        case 'complete_task': return 'Tâche marquée comme terminée.'
        case 'delete_task': return 'Tâche supprimée.'
        case 'add_subtask': return `Sous-tâche ajoutée : "${fc.arguments.text}".`
        default: return 'Action effectuée.'
      }
    }).join(' ')
  }

  return { text, functionCalls }
}
