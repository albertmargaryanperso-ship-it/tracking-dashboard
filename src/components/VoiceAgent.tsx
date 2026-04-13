import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, X, Camera, Volume2, Loader2, Send } from 'lucide-react'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import { chat, getAiKey, type ChatMessage, type FunctionCall } from '@/lib/ai'
import { cn } from '@/lib/utils'
import type { AppState, Todo } from '@/types'

interface VoiceAgentProps {
  state: AppState
  onAddTodo: (t: Omit<Todo, 'id' | 'created'>) => void
  onToggleTodo: (id: number, completed_min?: number | null) => void
  onDeleteTodo: (id: number) => void
  onUpdateTodo: (id: number, patch: Partial<Todo>) => void
}

type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking'

export const VoiceAgent = ({ state, onAddTodo, onToggleTodo, onDeleteTodo, onUpdateTodo }: VoiceAgentProps) => {
  const [open, setOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [lastTranscript, setLastTranscript] = useState('')
  const [lastResponse, setLastResponse] = useState('')
  const [error, setError] = useState('')
  const [textInput, setTextInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasKey = !!getAiKey()

  // Execute function calls
  const executeFunctions = useCallback((calls: FunctionCall[]) => {
    for (const fc of calls) {
      const a = fc.arguments
      switch (fc.name) {
        case 'add_task':
          onAddTodo({
            text: a.text,
            category: a.category || state.meta.custom_categories?.[0]?.id || 'admin',
            priority: a.priority || 'normal',
            status: 'open',
            delegated_to: null,
            due: a.due || null,
            duration_min: a.duration_min || null,
            completed_at: null,
          })
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
      }
    }
  }, [state, onAddTodo, onToggleTodo, onDeleteTodo, onUpdateTodo])

  // Process user input (voice transcript, typed text, or image)
  const processInput = useCallback(async (text: string, image?: string) => {
    setLastTranscript(text)
    setLastResponse('')
    setError('')
    setStatus('thinking')

    const chatMsg: ChatMessage = { role: 'user', content: text, image }
    const newHistory = [...chatHistory, chatMsg]
    setChatHistory(newHistory)

    try {
      const response = await chat(newHistory, state, image)

      if (response.functionCalls.length > 0) {
        executeFunctions(response.functionCalls)
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
  const { isListening, isSpeaking, interim, startListening, stopListening, speak, stopSpeaking, isSupported } = useVoiceChat(processInput)

  // Sync status
  useEffect(() => {
    if (isListening) setStatus('listening')
    else if (isSpeaking) setStatus('speaking')
  }, [isListening, isSpeaking])

  // Image capture
  const handleImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => processInput("Analyse cette image et crée les tâches.", reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [processInput])

  // Text submit
  const handleTextSubmit = () => {
    const t = textInput.trim()
    if (!t || status === 'thinking') return
    setTextInput('')
    processInput(t)
  }

  const handleMicTap = () => {
    if (status === 'speaking') { stopSpeaking(); setStatus('idle'); return }
    if (status === 'listening') { stopListening(); return }
    if (status === 'thinking') return
    setError('')
    startListening()
  }

  // ─── Floating button ──────────────────────────────────────────────────

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className={cn(
          'fixed z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95',
          'bg-gradient-to-br from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500',
          'bottom-24 right-4 sm:bottom-20 sm:right-6',
        )}>
        <Mic size={22} className="text-white" />
      </button>
    )
  }

  // ─── Status config ────────────────────────────────────────────────────

  const STATUS_CONFIG = {
    idle: { label: isSupported ? 'Appuie pour parler' : 'Écris ta demande ci-dessous', color: 'from-violet-600 to-cyan-600', icon: Mic },
    listening: { label: 'Écoute...', color: 'from-rose-500 to-pink-600', icon: MicOff },
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
        <button onClick={() => { stopSpeaking(); stopListening(); setOpen(false) }}
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
          ) : interim ? (
            <p className="text-violet-300 text-lg italic animate-pulse">{interim}...</p>
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
