// ─────────────────────────────────────────────────────────────────────────────
// useVoiceChat — Web Speech API (STT + TTS)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVoiceChatReturn {
  /** Whether the browser is currently listening to speech */
  isListening: boolean
  /** Whether TTS is currently speaking */
  isSpeaking: boolean
  /** Interim transcript (partial recognition) */
  interim: string
  /** Start listening */
  startListening: () => void
  /** Stop listening */
  stopListening: () => void
  /** Speak text aloud */
  speak: (text: string) => Promise<void>
  /** Stop speaking */
  stopSpeaking: () => void
  /** Whether speech recognition is supported */
  isSupported: boolean
}

export function useVoiceChat(
  onResult: (transcript: string) => void,
): UseVoiceChatReturn {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)

  // Check support
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null
  const isSupported = !!SpeechRecognition

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      synthRef.current?.cancel()
    }
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return

    // Stop TTS if playing
    synthRef.current?.cancel()
    setIsSpeaking(false)

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setInterim('')
    }

    recognition.onresult = (event: any) => {
      let final = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (final) {
        setInterim('')
        setIsListening(false)
        onResult(final.trim())
      } else {
        setInterim(interimText)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)
      setIsListening(false)
      setInterim('')
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [SpeechRecognition, onResult])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    setInterim('')
  }, [])

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) { resolve(); return }

      // Cancel any ongoing speech
      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = 1.1
      utterance.pitch = 1.0

      // Try to find a French voice
      const voices = synthRef.current.getVoices()
      const frVoice = voices.find((v: SpeechSynthesisVoice) =>
        v.lang.startsWith('fr') && v.localService
      ) || voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith('fr'))
      if (frVoice) utterance.voice = frVoice

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => { setIsSpeaking(false); resolve() }
      utterance.onerror = () => { setIsSpeaking(false); resolve() }

      synthRef.current.speak(utterance)
    })
  }, [])

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  return {
    isListening, isSpeaking, interim,
    startListening, stopListening,
    speak, stopSpeaking,
    isSupported,
  }
}
