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

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      synthRef.current?.cancel()
    }
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return

    // Stop TTS
    synthRef.current?.cancel()
    setIsSpeaking(false)

    // Reset
    transcriptRef.current = ''
    setTranscript('')
    setInterim('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript + ' '
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalText) {
        transcriptRef.current = finalText.trim()
        setTranscript(finalText.trim())
      }
      setInterim(interimText)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return // Ignore, keep listening
      console.warn('Speech error:', event.error)
      setIsListening(false)
      setInterim('')
    }

    recognition.onend = () => {
      // If still supposed to be listening, restart (iOS kills it sometimes)
      if (isListening && recognitionRef.current) {
        try { recognition.start() } catch { setIsListening(false) }
        return
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [SpeechRecognition, isListening])

  const stopAndSend = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null // prevent auto-restart in onend
    recognition?.stop()
    setIsListening(false)
    setInterim('')

    const text = transcriptRef.current.trim()
    if (text) {
      onResult(text)
      transcriptRef.current = ''
      setTranscript('')
    }
  }, [onResult])

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) { resolve(); return }
      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = 0.95  // Légèrement plus lent = plus naturel
      utterance.pitch = 1.05

      // Use the system's preferred French voice (respects user's iPhone/Mac settings)
      const voices = synthRef.current.getVoices()
      const frVoices = voices.filter((v: SpeechSynthesisVoice) => v.lang.startsWith('fr'))
      // Just pick the first French voice — iOS returns the user's preferred voice first
      if (frVoices.length > 0) utterance.voice = frVoices[0]

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
    isListening, isSpeaking, interim, transcript,
    startListening, stopAndSend,
    speak, stopSpeaking,
    isSupported,
  }
}
