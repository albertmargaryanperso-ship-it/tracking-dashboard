import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, X, Camera, Volume2, VolumeX, Loader2, Trash2 } from 'lucide-react'
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

interface UIMessage {
  role: 'user' | 'assistant'
  text: string
  ts: number
}

export const VoiceAgent = ({ state, onAddTodo, onToggleTodo, onDeleteTodo, onUpdateTodo }: VoiceAgentProps) => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const hasKey = !!getAiKey()

  // Execute function calls from AI response
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

  // Handle user message (text from speech or typed)
  const handleUserMessage = useCallback(async (text: string, image?: string) => {
    const userMsg: UIMessage = { role: 'user', text, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])

    const chatMsg: ChatMessage = { role: 'user', content: text, image }
    const newHistory = [...chatHistory, chatMsg]
    setChatHistory(newHistory)

    setLoading(true)
    try {
      const response = await chat(newHistory, state, image)

      // Execute functions
      if (response.functionCalls.length > 0) {
        executeFunctions(response.functionCalls)
      }

      const assistantMsg: UIMessage = { role: 'assistant', text: response.text, ts: Date.now() }
      setMessages(prev => [...prev, assistantMsg])
      setChatHistory(prev => [...prev, { role: 'assistant', content: response.text }])

      // TTS
      if (ttsEnabled && response.text) {
        speak(response.text)
      }
    } catch (err: any) {
      const errMsg: UIMessage = { role: 'assistant', text: `Erreur : ${err.message}`, ts: Date.now() }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }, [chatHistory, state, executeFunctions, ttsEnabled])

  // Voice chat hook
  const { isListening, isSpeaking, interim, startListening, stopListening, speak, stopSpeaking, isSupported } = useVoiceChat(handleUserMessage)

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, interim, loading])

  // Handle image capture
  const handleImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      handleUserMessage("Analyse cette image et crée les tâches.", dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [handleUserMessage])

  const clearChat = () => {
    setMessages([])
    setChatHistory([])
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { stopSpeaking(); stopListening(); setOpen(false) }} />

      <div className="relative w-full max-w-lg bg-zinc-950 rounded-t-3xl sm:rounded-3xl border border-zinc-800 flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 pt-2 sm:pt-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
              <Mic size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Assistant vocal</h2>
              <p className="text-[9px] text-zinc-500">Parle pour gérer tes tâches</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setTtsEnabled(!ttsEnabled)}
              className={cn('p-2 rounded-lg transition-all', ttsEnabled ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-500')}>
              {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button onClick={clearChat} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300">
              <Trash2 size={14} />
            </button>
            <button onClick={() => { stopSpeaking(); stopListening(); setOpen(false) }}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
          {!hasKey && (
            <div className="text-center py-6">
              <p className="text-sm text-amber-400 font-semibold mb-2">Clé API Gemini requise</p>
              <p className="text-[11px] text-zinc-500">
                Va dans Réglages pour configurer ta clé.<br />
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"
                  className="text-cyan-400 underline">Obtenir une clé gratuite →</a>
              </p>
            </div>
          )}

          {messages.length === 0 && hasKey && (
            <div className="text-center py-8">
              <p className="text-2xl mb-3">🎙️</p>
              <p className="text-sm text-zinc-400">Appuie sur le micro pour parler</p>
              <p className="text-[10px] text-zinc-600 mt-2">
                "Ajoute une tâche..." • "Supprime la tâche..." • "Quelles sont mes tâches urgentes ?"
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={msg.ts + i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600/20 border border-violet-500/30 text-violet-100'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200',
              )}>
                {msg.text}
              </div>
            </div>
          ))}

          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-violet-600/10 border border-violet-500/20 text-violet-300 italic">
                {interim}...
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 bg-zinc-900 border border-zinc-800">
                <Loader2 size={16} className="text-cyan-400 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-center gap-4">
            {/* Camera button */}
            <button onClick={() => fileRef.current?.click()} disabled={loading || !hasKey}
              className="p-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-30 transition-all">
              <Camera size={18} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />

            {/* Mic button */}
            <button
              onClick={() => {
                if (isSpeaking) { stopSpeaking(); return }
                if (isListening) { stopListening(); return }
                startListening()
              }}
              disabled={loading || !hasKey || !isSupported}
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl',
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40'
                  : isSpeaking
                    ? 'bg-cyan-500 text-white shadow-cyan-500/40'
                    : 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-violet-500/30 hover:shadow-violet-500/50',
                (loading || !hasKey || !isSupported) && 'opacity-40 cursor-not-allowed',
              )}>
              {loading ? <Loader2 size={24} className="animate-spin" /> :
                isListening ? <MicOff size={24} /> :
                isSpeaking ? <Volume2 size={24} /> :
                <Mic size={24} />}
            </button>

            {/* Spacer for symmetry */}
            <div className="w-[50px]" />
          </div>

          <p className="text-center text-[9px] text-zinc-600 mt-3">
            {isListening ? '🔴 Écoute en cours...' :
              isSpeaking ? '🔊 Réponse...' :
              loading ? '⏳ Réflexion...' :
              !isSupported ? 'Reconnaissance vocale non supportée' :
              'Appuie pour parler'}
          </p>
        </div>
      </div>
    </div>
  )
}
