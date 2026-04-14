import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, X, Camera, Volume2, Loader2, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
    unlockTTS() // ← VITAL SUR iOS : Débloque la synthèse vocale immédiatement via l'action utilisateur
    if (status === 'speaking') { stopSpeaking(); setStatus('idle'); return }
    if (status === 'listening') { stopAndSend(); return } // 2nd tap = send
    if (status === 'thinking') return
    setError('')
    startListening() // 1st tap = start listening
  }

  const getStatusConfig = () => {
    switch(status) {
      case 'listening': return { label: 'Parle... envoi auto après silence', color: 'from-rose-500 to-pink-600', icon: Send }
      case 'thinking': return { label: 'Réflexion...', color: 'from-amber-500 to-orange-600', icon: Loader2 }
      case 'speaking': return { label: 'Réponse...', color: 'from-cyan-500 to-blue-600', icon: Volume2 }
      default: return { label: isSupported ? 'Appuie pour parler' : 'Écris ta demande ci-dessous', color: 'from-violet-600 to-cyan-600', icon: Mic }
    }
  }

  const { color: statusColor, icon: StatusIcon, label: statusLabel } = getStatusConfig()

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[48px] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        >
          {/* Subtle gradient glowing mesh background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              animate={{ 
                scale: status === 'speaking' ? [1, 1.2, 1] : status === 'listening' ? [1, 1.1, 1] : 1,
                opacity: status === 'speaking' ? 0.3 : status === 'listening' ? 0.15 : 0.05
              }}
              transition={{ repeat: Infinity, duration: status === 'speaking' ? 1.5 : 3, ease: 'easeInOut' }}
              className={cn("absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[100px]", 
                status === 'listening' ? 'bg-rose-500' : status === 'thinking' ? 'bg-amber-500' : 'bg-cyan-500')} 
            />
          </div>

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-4 relative z-10">
            <button onClick={() => { setChatHistory([]); setLastTranscript(''); setLastResponse(''); setError('') }}
              className="text-[10px] text-zinc-400 font-semibold px-3 py-1.5 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors">
              Effacer
            </button>
            <p className="text-[12px] font-bold tracking-widest uppercase text-zinc-300">Quick Brain</p>
            <button onClick={() => { stopSpeaking(); stopAndSend(); setPendingImage(null); onClose() }}
              className="p-2.5 rounded-full bg-zinc-800/50 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
              <X size={16} strokeWidth={3} />
            </button>
          </div>

          {/* Center — main area */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 overflow-y-auto relative z-10">
            {/* Response / status text */}
            <div className="w-full max-w-sm text-center space-y-4 min-h-[120px] flex flex-col justify-center">
              {!hasKey ? (
                <>
                  <p className="text-amber-400 font-semibold">Clé API requise</p>
                  <p className="text-[11px] text-zinc-400">
                    Réglages → Assistant → colle ta clé<br />
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-cyan-400 underline mt-1 inline-block">
                      Obtenir une clé (Gratuit) →
                    </a>
                  </p>
                </>
              ) : error ? (
                <div className="space-y-2">
                  <p className="text-rose-400 text-sm font-medium">{error}</p>
                </div>
              ) : (transcript || interim) && status === 'listening' ? (
                <div className="space-y-2">
                  {transcript && <p className="text-zinc-100 font-semibold text-lg">{transcript}</p>}
                  {interim && <p className="text-zinc-400 text-base italic">{interim}...</p>}
                </div>
              ) : lastResponse ? (
                <p className="text-zinc-100 font-medium text-lg leading-relaxed">{lastResponse}</p>
              ) : lastTranscript ? (
                <p className="text-zinc-500 text-sm">Toi : {lastTranscript}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-zinc-300 font-medium text-lg">{isSupported ? 'Je vous écoute...' : 'Écris ta demande ci-dessous'}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    "Ajoute une tâche"<br/>
                    "Qu'est-ce que j'ai d'urgent ?"
                  </p>
                </div>
              )}
            </div>

            {/* Big magical orb button */}
            {isSupported && (
              <div className="relative group">
                <button onClick={handleMicTap} disabled={!hasKey}
                  className={cn(
                    'relative w-28 h-28 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-2xl',
                    `bg-gradient-to-br ${statusColor}`,
                    !hasKey && 'opacity-30 cursor-not-allowed',
                    status === 'thinking' && 'animate-magic-spin'
                  )}>
                  
                  {status === 'thinking' ? (
                     <div className="w-full h-full rounded-full border-[6px] border-white/20 border-t-white/80" />
                  ) : (
                    <>
                      {/* Fluid inner glow */}
                      <div className="absolute inset-2 rounded-full bg-white/20 blur-md" />
                      <StatusIcon size={40} strokeWidth={2} className={cn("text-white relative z-10", status === 'listening' && "animate-pulse")} />
                    </>
                  )}
                </button>
                {/* Outer ring animation */}
                {status === 'listening' && <div className="absolute -inset-4 rounded-full border-2 border-white/30 animate-ping opacity-50" style={{ animationDuration: '2s' }}/>}
                {status === 'listening' && <div className="absolute -inset-8 rounded-full border border-white/10 animate-ping opacity-30" style={{ animationDuration: '3s' }}/>}
              </div>
            )}

            {/* Status label */}
            <p className={cn('text-[11px] font-bold tracking-widest uppercase',
              status === 'listening' ? 'text-rose-400' :
              status === 'thinking' ? 'text-amber-400' :
              status === 'speaking' ? 'text-cyan-400' : 'text-zinc-500'
            )}>
              {statusLabel}
            </p>
          </div>

          {/* Bottom — text input + camera */}
          <div className="px-6 pb-6 pt-4 relative z-10 w-full max-w-md mx-auto space-y-4">
            <div className="flex items-center gap-2">
              <input ref={inputRef} value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit() }}
                placeholder="Message (texte ou photo)..."
                disabled={status === 'thinking' || !hasKey}
                enterKeyHint="send"
                className="flex-1 px-5 py-4 bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-2xl text-sm font-medium text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/30 focus:bg-zinc-800/60 transition-all shadow-inner" />
              <button onClick={handleTextSubmit} disabled={!textInput.trim() || status === 'thinking' || !hasKey}
                className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 disabled:opacity-30 transition-all active:scale-95 shadow-lg">
                <Send size={18} strokeWidth={2.5}/>
              </button>
            </div>

            <div className="flex justify-center items-center">
              {pendingImage ? (
                <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-amber-300 shadow-lg pulse">
                  <Camera size={16} />
                  <span className="text-xs font-semibold">Photo prête — demande quoi faire !</span>
                  <button onClick={() => setPendingImage(null)} className="ml-2 bg-amber-500/20 p-1 rounded-full text-amber-200 hover:text-white transition-colors">
                    <X size={14} strokeWidth={3}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  disabled={status === 'thinking' || !hasKey}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-all shadow-sm">
                  <Camera size={18} />
                  <span className="text-xs font-semibold">Partager une photo</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
