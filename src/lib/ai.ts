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

  return `Tu es Rocko, un assistant vocal. Réponds en français, tutoie Albert. Sois CONCIS (max 2 phrases). PAS de roleplay, PAS d'actions entre astérisques, PAS de narration. Juste des réponses directes.
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

// Tolerant field extractor: matches text="..." text='...' or text=...
function extractField(tag: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*[:=]?\\s*(?:"([^"]*)"|'([^']*)'|([^\\s\\],]+))`, 'i')
  const m = tag.match(re)
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null
}

function parseActions(text: string): { cleanText: string; calls: FunctionCall[] } {
  const calls: FunctionCall[] = []

  // Log raw text for debug
  if (text) console.log('AI raw:', text.slice(0, 400))

  // Generic tag matcher: [TAG ...]
  const tagRe = /\[(ADD|SUB|DONE|DEL|CHECK|LOG)\b([^\]]*)\]/gi
  let match
  while ((match = tagRe.exec(text)) !== null) {
    const tagName = match[1].toUpperCase()
    const body = match[2]

    if (tagName === 'ADD') {
      const t = extractField(body, 'text')
      const cat = extractField(body, 'cat') || extractField(body, 'category')
      const pri = extractField(body, 'pri') || extractField(body, 'priority') || 'normal'
      const dur = extractField(body, 'dur') || extractField(body, 'duration') || '30'
      if (t) {
        calls.push({ name: 'add_task', arguments: { text: t, category: cat || '', priority: pri, duration_min: parseInt(dur, 10) || 30 } })
      }
    } else if (tagName === 'LOG') {
      const t = extractField(body, 'text')
      const cat = extractField(body, 'cat') || extractField(body, 'category')
      const pri = extractField(body, 'pri') || extractField(body, 'priority') || 'normal'
      const dur = extractField(body, 'dur') || extractField(body, 'duration') || '30'
      const mn = extractField(body, 'min') || dur
      if (t) {
        calls.push({ name: 'log_task', arguments: { text: t, category: cat || '', priority: pri, duration_min: parseInt(dur, 10) || 30, completed_min: parseInt(mn, 10) || 30 } })
      }
    } else if (tagName === 'SUB') {
      const id = extractField(body, 'id')
      const t = extractField(body, 'text')
      if (id && t) calls.push({ name: 'add_subtask', arguments: { task_id: parseInt(id, 10), text: t } })
    } else if (tagName === 'DONE') {
      const id = extractField(body, 'id')
      const mn = extractField(body, 'min')
      if (id) calls.push({ name: 'complete_task', arguments: { task_id: parseInt(id, 10), completed_min: mn ? parseInt(mn, 10) : undefined } })
    } else if (tagName === 'DEL') {
      const id = extractField(body, 'id')
      if (id) calls.push({ name: 'delete_task', arguments: { task_id: parseInt(id, 10) } })
    } else if (tagName === 'CHECK') {
      const id = extractField(body, 'id')
      const sid = extractField(body, 'sid')
      if (id && sid) calls.push({ name: 'check_subtask', arguments: { task_id: parseInt(id, 10), subtask_id: sid } })
    }
  }

  const cleanText = text.replace(/\[(ADD|SUB|DONE|DEL|CHECK|LOG)\b[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim()

  return { cleanText, calls }
}

// ─── API call via Puter.js ─────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  state: AppState,
  _stats?: Stats,
  image?: string,
): Promise<AiResponse> {
  if (typeof puter === 'undefined') throw new Error('Puter.js pas encore chargé — rafraîchis la page')

  const systemPrompt = buildSystemPrompt(state)

  // Check if any message has an image (from history or current)
  const imageInHistory = messages.find(m => m.image)?.image
  const activeImage = image || imageInHistory

  try {
    let response
    if (activeImage) {
      // Vision mode: single-turn prompt + image
      const lastUserMsg = messages[messages.length - 1]
      const userHint = lastUserMsg?.content ? `Albert a précisé oralement : "${lastUserMsg.content}". ` : ''
      const prompt = `${systemPrompt}

═══ MODE ANALYSE D'IMAGE ═══
${userHint}Extrais TOUTES les tâches visibles dans l'image.
Pour CHAQUE tâche, détermine intelligemment d'après le contenu :
- La catégorie la plus pertinente (ex: "appeler banque"=finance, "courir 10km"=cardio, "lire livre"=lecture, "faire admin"=admin, "envoyer devis"=pro, "acheter cadeau"=admin perso, etc.)
- La priorité (urgent/normal/faible selon ce qui est écrit)
- Une durée estimée réaliste en minutes

Si Albert a précisé une catégorie ou priorité oralement, respecte-la (elle prime sur ta déduction).

Crée chaque tâche avec un tag [ADD text="..." cat="ID" pri="..." dur="..."] à la suite.
Finis par un récap oral court : le nombre de tâches ajoutées et où (ex: "J'ai ajouté 4 tâches. 2 en Finance, 1 en Admin, 1 en Cardio.").`
      response = await puter.ai.chat(prompt, activeImage, { model: 'gpt-4o' })
    } else {
      // Text mode: full conversation
      const apiMessages: any[] = [{ role: 'system', content: systemPrompt }]
      for (const msg of messages.slice(-6)) {
        apiMessages.push({ role: msg.role, content: msg.content })
      }
      response = await puter.ai.chat(apiMessages, { model: 'gpt-4o-mini' })
    }
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
