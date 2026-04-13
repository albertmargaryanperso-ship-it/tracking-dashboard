// ─────────────────────────────────────────────────────────────────────────────
// AI — Groq API (free) — text-based action parsing (no native tool calling)
// ─────────────────────────────────────────────────────────────────────────────

import type { Todo, AppState, Stats } from '@/types'
import { getActiveCategories, getActiveTabs, todayISO } from '@/lib/utils'

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

function buildSystemPrompt(state: AppState, stats?: Stats): string {
  const { CATEGORY_CONFIG, CATEGORY_LIST } = getActiveCategories(state.meta.custom_categories)
  const tabs = getActiveTabs(state.meta.custom_tabs)
  const todoTabs = tabs.filter(t => t.type === 'todos')
  const openTodos = state.todos.filter(t => t.status !== 'done')
  const today = todayISO()

  // Build tab → categories mapping
  const tabInfo = todoTabs.map(tab => {
    const cats = (tab.categoryFilter ?? [])
      .map(id => CATEGORY_CONFIG[id])
      .filter(Boolean)
      .map(c => `${c.emoji} ${c.label} (id="${c.id}")`)
    return `${tab.emoji} ${tab.label.toUpperCase()} : ${cats.join(', ')}`
  }).join('\n')

  // Task list grouped by tab
  const tasksByTab = todoTabs.map(tab => {
    const tabTodos = openTodos.filter(t => tab.categoryFilter?.includes(t.category))
    if (tabTodos.length === 0) return `${tab.emoji} ${tab.label} : aucune tâche`
    const list = tabTodos.map(t => {
      const c = CATEGORY_CONFIG[t.category]
      const sub = t.subtasks?.length ? ` [${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} sous-tâches]` : ''
      const due = t.due ? ` (éch: ${t.due}${t.due < today ? ' ⚠RETARD' : t.due === today ? ' ⚠AUJOURD\'HUI' : ''})` : ''
      const dur = t.duration_min ? ` ~${t.duration_min}min` : ''
      const age = t.created ? ` créée ${t.created.slice(0, 10)}` : ''
      const subDetail = t.subtasks?.length
        ? '\n' + t.subtasks.map(s => `    ${s.done ? '✅' : '☐'} "${s.text}" (sid="${s.id}")`).join('\n')
        : ''
      return `  #${t.id} ${c?.emoji ?? ''} ${t.text} | ${t.priority}${due}${dur}${age}${subDetail}`
    }).join('\n')
    return `${tab.emoji} ${tab.label} (${tabTodos.length}) :\n${list}`
  }).join('\n\n')

  // Stats summary for analysis
  const fmtMin = (m: number) => m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
  let statsBlock = ''
  if (stats) {
    const t = stats.tracking
    const tabStats = todoTabs.map(tab => {
      const bt = t.by_tab[tab.id]
      const streak = t.streaks_by_tab[tab.id] ?? 0
      return `  ${tab.emoji} ${tab.label} — aujourd'hui: ${fmtMin(bt?.today ?? 0)}, semaine: ${fmtMin(bt?.week ?? 0)}, mois: ${fmtMin(bt?.month ?? 0)}, streak: ${streak}j`
    }).join('\n')

    const catStats = CATEGORY_LIST.map(id => {
      const bc = t.by_category[id]
      if (!bc || bc.total === 0) return null
      const c = CATEGORY_CONFIG[id]
      return `  ${c.emoji} ${c.label} — ${bc.open} ouvertes, ${bc.done} faites, ${fmtMin(bc.minutes)} logués`
    }).filter(Boolean).join('\n')

    statsBlock = `
PRODUCTIVITÉ :
${tabStats}
  Total mois : ${fmtMin(t.month_minutes)}, total global : ${fmtMin(t.total_minutes)}
  Taux complétion : ${stats.todos.completion_rate}%

PAR CATÉGORIE :
${catStats}`
  }

  const urgentCount = openTodos.filter(t => t.priority === 'urgent').length
  const overdueCount = openTodos.filter(t => t.due && t.due < today).length

  return `Tu es l'assistant vocal d'Albert. Français uniquement.

RÈGLE CRITIQUE : ta réponse est lue À HAUTE VOIX. Tu parles comme un humain, naturellement.
INTERDIT dans tes réponses parlées : IDs techniques (id="pro", #42, sid="xxx"), guillemets, parenthèses techniques, code.
Dis "catégorie Pro" pas "(id=pro)". Dis "la tâche Appeler le comptable" pas "la tâche #42".
Les tags [ADD], [SUB], etc. sont INVISIBLES (retirés avant lecture) — mets-les À LA FIN de ta réponse, après ton texte oral.

ONGLETS ET CATÉGORIES :
${tabInfo}

TÂCHES OUVERTES (${openTodos.length}, ${urgentCount} urgentes, ${overdueCount} en retard) :
${tasksByTab}
${statsBlock}
Date : ${today}

═══ ACTIONS (tags invisibles, à mettre EN FIN de réponse) ═══
- Ajouter : [ADD text="NOM RÉEL DE LA TÂCHE" cat="ID_CATEGORIE" pri="normal" dur="30"]
  ATTENTION : text= doit contenir le VRAI nom donné par l'utilisateur, PAS "la tâche".
  Exemple correct : [ADD text="Rendez-vous avec l'avocat" cat="admin" pri="normal" dur="90"]
- Sous-tâche : [SUB id=TASK_ID text="NOM RÉEL"]
- Terminer : [DONE id=TASK_ID min=TEMPS_REEL]
- Supprimer : [DEL id=TASK_ID]
- Cocher sous-tâche : [CHECK id=TASK_ID sid="SUBTASK_ID"]
- Loguer activité déjà faite : [LOG text="NOM RÉEL" cat="ID" pri="normal" dur="30" min="25"]
  dur = durée estimée, min = temps réellement passé

═══ FLOW AJOUT — UNE SEULE QUESTION PAR RÉPONSE ═══
RÈGLE ABSOLUE : tu poses UNE question, puis tu attends la réponse. JAMAIS deux questions dans le même message.

Étape 1 (si pas précisé) : Dis seulement "C'est pro ou perso ?" — STOP.
Étape 2 : Si PRO → "Quelle catégorie ? ${todoTabs[0]?.categoryFilter?.map(id => CATEGORY_CONFIG[id]?.label).join(', ') ?? ''}" — STOP.
          Si PERSO → "Quelle catégorie ? ${todoTabs[1]?.categoryFilter?.map(id => CATEGORY_CONFIG[id]?.label).join(', ') ?? ''}" — STOP.
Étape 3 : "C'est urgent, normal ou faible ?" — STOP.
Étape 4 : Tu estimes un temps toi-même et tu AFFIRMES : "J'estime que cette tâche prendra environ X minutes, ça te va ?" — STOP. PAS de "estime un temps" ni de question ouverte sur le temps.
Étape 5 : L'utilisateur confirme → crée avec [ADD ...]. Puis : "Tu veux des sous-tâches ?" — STOP.
Étape 6 : Si oui → "Dis-moi la première." — STOP. Ajoute avec [SUB ...]. "Autre sous-tâche ?" — STOP.
Étape 7 : Si non → récap obligatoire (voir ci-dessous).

RACCOURCI : si l'utilisateur donne TOUT d'emblée ("ajoute tâche X, pro, admin, urgent, 30 min"), crée directement et passe au récap.

═══ RÉCAP OBLIGATOIRE APRÈS CRÉATION ═══
Une fois la tâche créée (et les sous-tâches terminées ou refusées), fais un récap NATUREL.
Utilise le VRAI NOM de la tâche donné par l'utilisateur.
Les onglets s'appellent : ${todoTabs.map(t => `"${t.label}"`).join(' et ')} — PAS "onglet Pro" ou "onglet Perso".
Exemple : "C'est fait. J'ai ajouté Rendez-vous avec l'avocat dans l'onglet Travail, catégorie Admin, priorité normale, estimé à 1 heure 30. Avec deux sous-tâches : préparer les documents et envoyer les pièces."
Ce récap est OBLIGATOIRE.

═══ FLOW LOGUER UNE ACTIVITÉ DÉJÀ FAITE — même principe, UNE question à la fois ═══
Quand l'utilisateur dit "j'ai fait X", "logue X", "j'ai terminé X" (et X n'est PAS une tâche existante) :
Étape 1 : "C'est pro ou perso ?" — STOP.
Étape 2 : Catégorie — STOP.
Étape 3 : "Combien de temps ça t'a pris ?" — STOP.
Étape 4 : Crée avec [LOG ...]. Puis "Tu veux des sous-tâches ?" — STOP.
Étape 5 : Sous-tâches comme pour l'ajout, puis récap.
Le récap précise que c'est une activité déjà réalisée : "C'est logué. Rendez-vous avec l'avocat, onglet Travail, catégorie Admin, durée 1 heure 30."

═══ QUAND ON DEMANDE "QU'EST-CE QUE J'AI À FAIRE" ═══
1. "Pro ou perso ?" (si pas précisé)
2. Liste par priorité : urgentes d'abord, puis les retards, puis les plus anciennes
3. Donne un résumé clair et actionnable

═══ ANALYSE / PRODUCTIVITÉ ═══
Quand on te demande un bilan, une analyse, ce que tu penses de la productivité :
- Utilise les données de PRODUCTIVITÉ ci-dessus (temps par jour/semaine/mois, streaks, taux)
- Compare pro vs perso
- Identifie les tendances : progression, régression, catégories délaissées
- Donne des recommandations concrètes et directes
- Signale les tâches oubliées (créées depuis longtemps, jamais terminées)
- Sois honnête et direct, pas de complaisance

═══ TRAVAILLER SUR UNE TÂCHE ═══
Quand l'utilisateur veut discuter d'une tâche précise :
- Identifie-la par nom approximatif, affiche ses détails (sous-tâches, temps, priorité)
- Propose des modifications : ajouter/cocher des sous-tâches, changer la priorité
- Pour cocher une sous-tâche existante : [CHECK id=TASK_ID sid="SUBTASK_ID"]
- Pour en ajouter : [SUB id=TASK_ID text="..."]
- Reste focalisé sur cette tâche jusqu'à ce que l'utilisateur change de sujet

Garde le contexte conversationnel.`
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

  // [LOG text="..." cat="..." pri="..." dur="N" min="N"]
  const logRe = /\[LOG\s+text="([^"]+)"\s*cat="([^"]+)"\s*pri="([^"]+)"\s*dur="(\d+)"\s*min="(\d+)"\s*\]/gi
  while ((match = logRe.exec(text)) !== null) {
    calls.push({
      name: 'log_task',
      arguments: {
        text: match[1],
        category: match[2],
        priority: match[3],
        duration_min: parseInt(match[4], 10),
        completed_min: parseInt(match[5], 10),
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

  // [CHECK id=N sid="..."]
  const checkRe = /\[CHECK\s+id=(\d+)\s+sid="([^"]+)"\s*\]/gi
  while ((match = checkRe.exec(text)) !== null) {
    calls.push({
      name: 'check_subtask',
      arguments: { task_id: parseInt(match[1], 10), subtask_id: match[2] },
    })
  }

  // Remove tags from spoken text
  const cleanText = text
    .replace(/\[ADD[^\]]*\]/gi, '')
    .replace(/\[SUB[^\]]*\]/gi, '')
    .replace(/\[DONE[^\]]*\]/gi, '')
    .replace(/\[DEL[^\]]*\]/gi, '')
    .replace(/\[CHECK[^\]]*\]/gi, '')
    .replace(/\[LOG[^\]]*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { cleanText, calls }
}

// ─── API call ──────────────────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  state: AppState,
  stats?: Stats,
  _image?: string,
): Promise<AiResponse> {
  const apiKey = getAiKey()
  if (!apiKey) throw new Error('Clé API non configurée')

  const systemPrompt = buildSystemPrompt(state, stats)

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
