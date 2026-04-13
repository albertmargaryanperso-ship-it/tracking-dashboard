import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, X, Camera, Volume2, Loader2 } from 'lucide-react'
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
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Process user input (voice transcript or image)
  const processInput = useCallback(async (text: string, image?: string) => {
    setLastTranscript(text)
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

      // Speak the response
      if (response.text) {
        setStatus('speaking')
        await speak(response.text)
      }
      setStatus('idle')
    } catch (err: any) {
      const msg = err.message?.includes('429')
        ? 'Quota dépassé — réessaie dans 30 secondes'
        : err.message?.includes('API')
          ? 'Erreur API — vérifie ta clé dans Réglages'
          : `Erreur : ${err.message}`
      setError(msg)
      setStatus('idle')
      // Speak the error
      speak(msg)
    }
  }, [chatHistory, state, executeFunctions])

  // Voice hook
  const { isListening, isSpeaking, interim, startListening, stopListening, speak, stopSpeaking, isSupported } = useVoiceChat(processInput)

  // Sync status with voice state
  useEffect(() => {
    if (isListening) setStatus('listening')
    else if (isSpeaking) setStatus('speaking')
  }, [isListening, isSpeaking])

  // Handle image capture
  const handleImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      processInput("Analyse cette image et crée les tâches.", dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [processInput])

  const handleMicTap = () => {
    if (status === 'speaking') { stopSpeaking(); setStatus('idle'); return }
    if (status === 'listening') { stopListening(); return }
    if (status === 'thinking') return
    setError('')
    startListening()
  }

  const clearHistory = () => {
    setChatHistory([])
    setLastTranscript('')
    setLastResponse('')
    setError('')
  }

  // ─── Floating button (closed) ──────────────────────────────────────────

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

  // ─── Status config ─────────────────────────────────────────────────────

  const STATUS_CONFIG = {
    idle: { label: 'Appuie pour parler', color: 'from-violet-600 to-cyan-600', ring: '', pulse: false, icon: Mic },
    listening: { label: 'Écoute...', color: 'from-rose-500 to-pink-600', ring: 'ring-4 ring-rose-500/40', pulse: true, icon: MicOff },
    thinking: { label: 'Réflexion...', color: 'from-amber-500 to-orange-600', ring: 'ring-4 ring-amber-500/30', pulse: true, icon: Loader2 },
    speaking: { label: 'Réponse...', color: 'from-cyan-500 to-blue-600', ring: 'ring-4 ring-cyan-500/30', pulse: false, icon: Volume2 },
  }
  const cfg = STATUS_CONFIG[status]
  const IconComponent = cfg.icon

  // ─── Full-screen voice UI ──────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col animate-fade-in"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={clearHistory} className="text-[10px] text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700">
          Effacer
        </button>
        <p className="text-[10px] text-zinc-500 font-mono">🎙️ Assistant vocal</p>
        <button onClick={() => { stopSpeaking(); stopListening(); setOpen(false) }}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900">
          <X size={18} />
        </button>
      </div>

      {/* Center — status + transcript */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">

        {/* Transcript / Response */}
        <div className="w-full max-w-md text-center space-y-4 min-h-[120px] flex flex-col justify-center">
          {!hasKey ? (
            <>
              <p className="text-amber-400 font-semibold">Clé API requise</p>
              <p className="text-[11px] text-zinc-500">
                Réglages → Assistant vocal → colle ta clé de{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-cyan-400 underline">
                  aistudio.google.com
                </a>
              </p>
            </>
          ) : error ? (
            <p className="text-rose-400 text-sm font-medium">{error}</p>
          ) : interim ? (
            <p className="text-violet-300 text-lg italic animate-pulse">{interim}...</p>
          ) : lastResponse ? (
            <p className="text-zinc-200 text-base leading-relaxed">{lastResponse}</p>
          ) : lastTranscript ? (
            <p className="text-zinc-400 text-sm">{lastTranscript}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-zinc-400 text-sm">Dis quelque chose...</p>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                "Ajoute une tâche..."<br/>
                "Fais-moi un point sur mes urgences"<br/>
                "Qu'est-ce que j'ai en retard ?"
              </p>
            </div>
          )}
        </div>

        {/* Big mic button */}
        <div className="relative">
          {/* Animated rings */}
          {status === 'listening' && (
            <>
              <div className="absolute inset-0 -m-4 rounded-full bg-rose-500/10 animate-ping" />
              <div className="absolute inset-0 -m-8 rounded-full bg-rose-500/5 animate-pulse" />
            </>
          )}
          {status === 'speaking' && (
            <div className="absolute inset-0 -m-4 rounded-full bg-cyan-500/10 animate-pulse" />
          )}

          <button onClick={handleMicTap}
            disabled={!hasKey || !isSupported}
            className={cn(
              'relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-2xl',
              `bg-gradient-to-br ${cfg.color}`,
              cfg.ring,
              cfg.pulse && 'animate-pulse',
              (!hasKey || !isSupported) && 'opacity-30 cursor-not-allowed',
            )}>
            {status === 'thinking' ? (
              <Loader2 size={36} className="text-white animate-spin" />
            ) : (
              <IconComponent size={36} className="text-white" />
            )}
          </button>
        </div>

        {/* Status label */}
        <p className={cn('text-xs font-medium transition-colors',
          status === 'listening' ? 'text-rose-400' :
          status === 'thinking' ? 'text-amber-400' :
          status === 'speaking' ? 'text-cyan-400' : 'text-zinc-500'
        )}>
          {cfg.label}
        </p>
      </div>

      {/* Bottom — camera */}
      <div className="px-5 pb-6 flex justify-center">
        <button onClick={() => fileRef.current?.click()}
          disabled={status === 'thinking' || !hasKey}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 disabled:opacity-30 transition-all">
          <Camera size={16} />
          <span className="text-xs">Photo → Tâches</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
      </div>
    </div>
  )
}
