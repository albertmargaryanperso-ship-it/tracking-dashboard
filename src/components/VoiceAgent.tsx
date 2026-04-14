import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, X, Camera, Volume2, Loader2, Send } from 'lucide-react'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import { chat, getAiKey, type ChatMessage, type FunctionCall } from '@/lib/ai'
import { cn } from '@/lib/utils'
import type { AppState, Todo } from '@/types'

import type { Stats } from '@/types'

interface VoiceAgentProps {
  open: boolean
  onClose: () => void
  state: AppState
  stats: Stats
  onAddTodo: (t: Omit<Todo, 'id' | 'created'>) => void
  onAddDoneTodo: (t: Omit<Todo, 'id' | 'created' | 'status' | 'completed_at'> & { completed_min: number; completed_at?: string }) => void
  onToggleTodo: (id: number, completed_min?: number | null) => void
  onDeleteTodo: (id: number) => void
  onUpdateTodo: (id: number, patch: Partial<Todo>) => void
}

type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking'

export const VoiceAgent = ({ open, onClose, state, stats, onAddTodo, onAddDoneTodo, onToggleTodo, onDeleteTodo, onUpdateTodo }: VoiceAgentProps) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastResponse, setLastResponse] = useState('')
  const [error, setError] = useState('')
  const [textInput, setTextInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasKey = !!getAiKey()

  // Track last created task ID for subtask follow-ups
  const [lastCreatedId, setLastCreatedId] = useState<number | null>(null)

  // Execute function calls
  // Validate category ID — model often returns "Pro" instead of "pro"
  const validCategory = useCallback((raw: string): string => {
    const cats = (state.meta.custom_categories ?? []).map(c => c.id)
    if (!raw) return cats[0] || 'admin'
    const lower = raw.toLowerCase().trim()
    // Exact match
    if (cats.includes(lower)) return lower
    if (cats.includes(raw)) return raw
    // Fuzzy: find category whose id or label starts with the input
    const found = (state.meta.custom_categories ?? []).find(c =>
      c.id.toLowerCase() === lower || c.label.toLowerCase() === lower
    )
    return found?.id || cats[0] || 'admin'
  }, [state.meta.custom_categories])

  const executeFunctions = useCallback((calls: FunctionCall[]) => {
    for (const fc of calls) {
      const a = fc.arguments
      switch (fc.name) {
        case 'add_task':
          onAddTodo({
            text: a.text,
            category: validCategory(a.category),
            priority: ['urgent', 'normal', 'faible'].includes(a.priority) ? a.priority : 'normal',
            status: 'open',
            delegated_to: null,
            due: a.due || null,
            duration_min: a.duration_min || null,
            completed_at: null,
          })
          // Track the ID (will be todos_next_id since it just got incremented)
          setLastCreatedId(state.todos_next_id)
          break
        case 'log_task':
          onAddDoneTodo({
            text: a.text,
            category: validCategory(a.category),
            priority: ['urgent', 'normal', 'faible'].includes(a.priority) ? a.priority : 'normal',
            delegated_to: null,
            due: null,
            duration_min: a.duration_min || null,
            completed_min: a.completed_min || a.duration_min || 0,
            completed_at: a.date || new Date().toISOString(),
          })
          setLastCreatedId(state.todos_next_id)
          break
        case 'complete_task':
          if (a.task_id) onToggleTodo(a.task_id, a.completed_min ?? null)
          break
        case 'delete_task':
          if (a.task_id) onDeleteTodo(a.task_id)
          break
        case 'add_subtask':
          if (a.task_id && a.text) {
            const todo = state.todos.find(t => t.id === a.task_id)
            if (todo) {
              const subs = [...(todo.subtasks ?? []), {
                id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                text: a.text,
                done: false,
              }]
              onUpdateTodo(a.task_id, { subtasks: subs })
            }
          }
          break
        case 'check_subtask':
          if (a.task_id && a.subtask_id) {
            const todo = state.todos.find(t => t.id === a.task_id)
            if (todo && todo.subtasks) {
              const subs = todo.subtasks.map(s =>
                s.id === a.subtask_id ? { ...s, done: !s.done } : s
              )
              onUpdateTodo(a.task_id, { subtasks: subs })
            }
          }
          break
      }
    }
  }, [state, validCategory, onAddTodo, onAddDoneTodo, onToggleTodo, onDeleteTodo, onUpdateTodo])

  // Process user input (voice transcript, typed text, or image)
  const processInput = useCallback(async (text: string, image?: string) => {
    setLastTranscript(text)
    setLastResponse('')
    setError('')
    setStatus('thinking')

    // Consume pending image if voice input arrives
    const effectiveImage = image || pendingImage
    if (effectiveImage && pendingImage) setPendingImage(null)

    const chatMsg: ChatMessage = { role: 'user', content: text, image: effectiveImage ?? undefined }
    const newHistory = [...chatHistory, chatMsg]
    setChatHistory(newHistory)

    try {
      const response = await chat(newHistory, state, stats, effectiveImage ?? undefined)

      if (response.functionCalls.length > 0) {
        // Enrich function calls from conversation history
        const history = chatHistory.map(m => m.content.toLowerCase()).join(' ')
        const fixedCalls = response.functionCalls.map(fc => {
          // Fix subtask IDs
          if (fc.name === 'add_subtask' && lastCreatedId && (!fc.arguments.task_id || fc.arguments.task_id === 0)) {
            return { ...fc, arguments: { ...fc.arguments, task_id: lastCreatedId } }
          }
          // Enrich ADD/LOG with conversation context if fields are missing/default
          if ((fc.name === 'add_task' || fc.name === 'log_task') && chatHistory.length >= 4) {
            const a = { ...fc.arguments }
            // Extract category from history if missing
            if (!a.category || a.category === 'admin') {
              const cats = (state.meta.custom_categories ?? []).map(c => c.id)
              for (const cat of cats) {
                if (history.includes(cat)) { a.category = cat; break }
              }
            }
            // Extract priority from history
            if (!a.priority || a.priority === 'normal') {
              if (history.includes('urgent')) a.priority = 'urgent'
              else if (history.includes('faible')) a.priority = 'faible'
            }
            return { ...fc, arguments: a }
          }
          return fc
        })
        executeFunctions(fixedCalls)
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: response.text }])
      setLastResponse(response.text)

      // TTS — speak the response
      if (response.text) {
        setStatus('speaking')
        await speak(response.text)
      }
      setStatus('idle')
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue')
      setStatus('idle')
    }
  }, [chatHistory, state, executeFunctions])

  // Voice hook
  const { isListening, isSpeaking, interim, transcript, startListening, stopAndSend, speak, stopSpeaking, unlockTTS, isSupported } = useVoiceChat(processInput)

  // Sync status
  useEffect(() => {
    if (isListening) setStatus('listening')
    else if (isSpeaking) setStatus('speaking')
  }, [isListening, isSpeaking])

  // Image capture
  // Pending image — waits for user's voice/text instruction before sending
  const handleImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPendingImage(reader.result as string)
      // Speak prompt to user
      unlockTTS()
      speak("Photo reçue. Dis-moi quoi en faire ou tape envoyer.")
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [speak, unlockTTS])

  // Text submit — uses pending image if any
  const handleTextSubmit = () => {
    const t = textInput.trim()
    if ((!t && !pendingImage) || status === 'thinking') return
    unlockTTS()
    setTextInput('')
    const img = pendingImage
    setPendingImage(null)
    processInput(t || "Analyse cette image et crée les tâches avec les bonnes catégories.", img || undefined)
  }

  const handleMicTap = () => {
    if (status === 'speaking') { stopSpeaking(); setStatus('idle'); return }
    if (status === 'listening') { stopAndSend(); return } // 2nd tap = send
    if (status === 'thinking') return
    setError('')
    startListening() // 1st tap = start listening
  }

  if (!open) return null

  // ─── Status config ────────────────────────────────────────────────────

  const STATUS_CONFIG = {
    idle: { label: isSupported ? 'Appuie pour parler' : 'Écris ta demande ci-dessous', color: 'from-violet-600 to-cyan-600', icon: Mic },
    listening: { label: 'Appuie pour envoyer', color: 'from-rose-500 to-pink-600', icon: Send },
    thinking: { label: 'Réflexion...', color: 'from-amber-500 to-orange-600', icon: Loader2 },
    speaking: { label: 'Réponse...', color: 'from-cyan-500 to-blue-600', icon: Volume2 },
  }
  const cfg = STATUS_CONFIG[status]
  const IconComponent = cfg.icon

  // ─── Full-screen voice UI ─────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col animate-fade-in"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={() => { setChatHistory([]); setLastTranscript(''); setLastResponse(''); setError('') }}
          className="text-[10px] text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700">
          Effacer
        </button>
        <p className="text-[10px] text-zinc-500 font-mono">🎙️ Assistant</p>
        <button onClick={() => { stopSpeaking(); stopAndSend(); onClose() }}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900">
          <X size={18} />
        </button>
      </div>

      {/* Center — main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 overflow-y-auto">

        {/* Response / status text */}
        <div className="w-full max-w-md text-center space-y-3 min-h-[100px] flex flex-col justify-center">
          {!hasKey ? (
            <>
              <p className="text-amber-400 font-semibold">Clé API requise</p>
              <p className="text-[11px] text-zinc-500">
                Réglages → Assistant vocal → colle ta clé<br />
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-cyan-400 underline">
                  Obtenir une clé gratuite →
                </a>
              </p>
            </>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-rose-400 text-sm font-medium break-words">{error}</p>
              <p className="text-[10px] text-zinc-600">Si "quota dépassé" → crée une nouvelle clé dans un <b>nouveau projet</b> sur AI Studio</p>
            </div>
          ) : (transcript || interim) && status === 'listening' ? (
            <div className="space-y-2">
              {transcript && <p className="text-zinc-200 text-base">{transcript}</p>}
              {interim && <p className="text-violet-300 text-sm italic animate-pulse">{interim}...</p>}
              <p className="text-[10px] text-violet-400 mt-2">Appuie sur le micro quand tu as fini ↓</p>
            </div>
          ) : lastResponse ? (
            <p className="text-zinc-200 text-base leading-relaxed">{lastResponse}</p>
          ) : lastTranscript ? (
            <p className="text-zinc-500 text-xs">Toi : {lastTranscript}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-zinc-400 text-sm">{isSupported ? 'Appuie sur le micro pour parler' : 'Écris ta demande ci-dessous'}</p>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                "Ajoute une tâche..."<br/>
                "Fais-moi un point sur mes urgences"<br/>
                "Qu'est-ce que j'ai en retard ?"
              </p>
            </div>
          )}
        </div>

        {/* Big mic button — only if speech recognition supported */}
        {isSupported && (
          <div className="relative">
            {status === 'listening' && (
              <>
                <div className="absolute inset-0 -m-4 rounded-full bg-rose-500/10 animate-ping" />
                <div className="absolute inset-0 -m-8 rounded-full bg-rose-500/5 animate-pulse" />
              </>
            )}
            {status === 'speaking' && (
              <div className="absolute inset-0 -m-4 rounded-full bg-cyan-500/10 animate-pulse" />
            )}

            <button onClick={handleMicTap} disabled={!hasKey}
              className={cn(
                'relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-2xl',
                `bg-gradient-to-br ${cfg.color}`,
                status === 'listening' && 'ring-4 ring-rose-500/40',
                status === 'speaking' && 'ring-4 ring-cyan-500/30',
                !hasKey && 'opacity-30 cursor-not-allowed',
              )}>
              {status === 'thinking'
                ? <Loader2 size={36} className="text-white animate-spin" />
                : <IconComponent size={36} className="text-white" />}
            </button>
          </div>
        )}

        {/* Status label */}
        <p className={cn('text-xs font-medium',
          status === 'listening' ? 'text-rose-400' :
          status === 'thinking' ? 'text-amber-400' :
          status === 'speaking' ? 'text-cyan-400' : 'text-zinc-500'
        )}>
          {cfg.label}
        </p>
      </div>

      {/* Bottom — text input + camera */}
      <div className="px-4 pb-4 space-y-3">
        {/* Text input (always visible — fallback for iOS + convenience) */}
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit() }}
            placeholder="Ou écris ta demande ici..."
            disabled={status === 'thinking' || !hasKey}
            enterKeyHint="send"
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-40" />
          <button onClick={handleTextSubmit} disabled={!textInput.trim() || status === 'thinking' || !hasKey}
            className="p-3 rounded-xl bg-violet-600 text-white disabled:opacity-30 transition-all active:scale-95">
            <Send size={16} />
          </button>
        </div>

        {/* Camera */}
        <div className="flex justify-center">
          <button onClick={() => fileRef.current?.click()}
            disabled={status === 'thinking' || !hasKey}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-all">
            <Camera size={16} />
            <span className="text-xs">Photo → Tâches</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
        </div>
      </div>
    </div>
  )
}
