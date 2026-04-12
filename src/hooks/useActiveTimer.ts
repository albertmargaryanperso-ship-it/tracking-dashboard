import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tracking_active_timer'

interface TimerState {
  todoId: number
  startTime: number // Date.now() timestamp
}

export function useActiveTimer() {
  const [activeTimer, setActiveTimer] = useState<TimerState | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Force re-render every second for live countdown
  const [now, setNow] = useState(Date.now())

  const syncState = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      setActiveTimer(stored ? JSON.parse(stored) : null)
    } catch {
      setActiveTimer(null)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('timer_update', syncState)
    return () => window.removeEventListener('timer_update', syncState)
  }, [syncState])

  useEffect(() => {
    if (!activeTimer) {
      return
    }
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeTimer])

  const elapsedMs = activeTimer ? now - activeTimer.startTime : 0
  const elapsedSeconds = activeTimer ? Math.floor(elapsedMs / 1000) : 0
  const elapsedMinutes = activeTimer ? Math.floor(elapsedMs / 60000) : 0

  const startTimer = (todoId: number) => {
    const newState = { todoId, startTime: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    setActiveTimer(newState)
    setNow(Date.now())
    window.dispatchEvent(new Event('timer_update'))
  }

  const stopTimer = () => {
    const elapsed = activeTimer ? Math.floor((Date.now() - activeTimer.startTime) / 60000) : 0
    localStorage.removeItem(STORAGE_KEY)
    setActiveTimer(null)
    window.dispatchEvent(new Event('timer_update'))
    return Math.max(1, elapsed) // At least 1 minute recorded
  }

  const cancelTimer = () => {
    localStorage.removeItem(STORAGE_KEY)
    setActiveTimer(null)
    window.dispatchEvent(new Event('timer_update'))
  }

  return { activeTodoId: activeTimer?.todoId ?? null, elapsedMinutes, elapsedSeconds, startTimer, stopTimer, cancelTimer }
}
