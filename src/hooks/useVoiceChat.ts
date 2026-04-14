// ─────────────────────────────────────────────────────────────────────────────
// useVoiceChat — Web Speech API (STT + TTS)
// Mode: continuous listening — tap to start, tap again to send
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceChatReturn {
  isListening: boolean
  isSpeaking: boolean
  interim: string
  transcript: string
  startListening: () => void
  stopAndSend: () => void
  speak: (text: string) => Promise<void>
  stopSpeaking: () => void
  unlockTTS: () => void
  isSupported: boolean
}

export function useVoiceChat(
  onResult: (transcript: string) => void,
): UseVoiceChatReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)

  const SpeechRecognition = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null
  const isSupported = !!SpeechRecognition
  const ttsUnlockedRef = useRef(false)

  // iOS: trigger speechSynthesis on user gesture to unlock it (fully silent)
  const unlockTTS = useCallback(() => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    u.rate = 10
    synthRef.current.speak(u)
    ttsUnlockedRef.current = true
  }, [])

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      recognitionRef.current?.abort()
      synthRef.current?.cancel()
    }
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return

    synthRef.current?.cancel()
    setIsSpeaking(false)

    transcriptRef.current = ''
    setTranscript('')
    setInterim('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    const autoSendAfterSilence = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        const text = transcriptRef.current.trim()
        if (text) {
          recognitionRef.current = null
          try { recognition.stop() } catch { /* */ }
          setIsListening(false)
          setInterim('')
          transcriptRef.current = ''
          setTranscript('')
          onResult(text)
        }
      }, 1800) // 1.8s de silence → envoi auto
    }

    recognition.onstart = () => { setIsListening(true) }

    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript + ' '
        else interimText += result[0].transcript
      }

      if (finalText) {
        transcriptRef.current = (transcriptRef.current + ' ' + finalText).trim()
        setTranscript(transcriptRef.current)
      }
      setInterim(interimText)
      // Reset silence timer whenever we get any speech
      autoSendAfterSilence()
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return
      console.warn('Speech error:', event.error)
      setIsListening(false)
      setInterim('')
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { setIsListening(false) }
        return
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [SpeechRecognition, onResult])

  const stopAndSend = useCallback(() => {
    unlockTTS()
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    try { recognition?.stop() } catch { /* */ }
    setIsListening(false)
    setInterim('')

    const text = transcriptRef.current.trim()
    if (text) {
      onResult(text)
      transcriptRef.current = ''
      setTranscript('')
    }
  }, [onResult, unlockTTS])

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) { resolve(); return }
      // DON'T cancel — iOS needs the speech queue alive to stay unlocked

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = 0.95
      utterance.pitch = 1.05

      // Safari bug: speech stops after ~15s. Workaround: pause/resume.
      let keepAlive: ReturnType<typeof setInterval> | null = null

      utterance.onstart = () => {
        setIsSpeaking(true)
        keepAlive = setInterval(() => {
          if (synthRef.current?.speaking) {
            synthRef.current.pause()
            synthRef.current.resume()
          }
        }, 10000)
      }
      utterance.onend = () => {
        if (keepAlive) clearInterval(keepAlive)
        setIsSpeaking(false); resolve()
      }
      utterance.onerror = (e) => {
        if (keepAlive) clearInterval(keepAlive)
        console.warn('TTS error:', e)
        setIsSpeaking(false); resolve()
      }

      synthRef.current.speak(utterance)
    })
  }, [])

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  return {
    isListening, isSpeaking, interim, transcript,
    startListening, stopAndSend,
    speak, stopSpeaking, unlockTTS,
    isSupported,
  }
}
