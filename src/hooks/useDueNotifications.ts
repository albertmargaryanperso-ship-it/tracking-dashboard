// Local notifications for due tasks — triggers on dashboard load + every 5 min
// No server needed. iOS limitation: only fires when dashboard tab is open/visible.

import { useEffect, useRef } from 'react'
import type { AppState } from '@/types'
import { todayISO } from '@/lib/utils'

const NOTIFIED_KEY = 'tracking-notified-due-v1'

function getNotifiedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]')) }
  catch { return new Set() }
}
function saveNotifiedSet(s: Set<string>) {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...s])) } catch { /* */ }
}

export function useDueNotifications(state: AppState) {
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!('Notification' in window)) return

    // Request permission once on first load (after user interaction)
    const requestPermissionOnInteraction = () => {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => { /* */ })
      }
      document.removeEventListener('click', requestPermissionOnInteraction)
    }
    document.addEventListener('click', requestPermissionOnInteraction, { once: true })

    const checkDue = () => {
      if (Notification.permission !== 'granted') return
      const today = todayISO()
      const notified = getNotifiedSet()
      const newNotifications: { id: number; title: string; body: string }[] = []

      for (const t of stateRef.current.todos) {
        if (t.status === 'done' || !t.due) continue
        const key = `${t.id}-${t.due}` // per-task-per-due-date

        if (t.due < today && !notified.has(`late-${key}`)) {
          newNotifications.push({
            id: t.id,
            title: `⚠️ En retard : ${t.text}`,
            body: `Échéance du ${t.due} dépassée`,
          })
          notified.add(`late-${key}`)
        } else if (t.due === today && !notified.has(`today-${key}`)) {
          newNotifications.push({
            id: t.id,
            title: `📅 Aujourd'hui : ${t.text}`,
            body: t.priority === 'urgent' ? 'Tâche urgente à faire aujourd\'hui' : 'À faire aujourd\'hui',
          })
          notified.add(`today-${key}`)
        }
      }

      if (newNotifications.length > 0) {
        // Throttle to max 3 notifs per check
        for (const n of newNotifications.slice(0, 3)) {
          try {
            new Notification(n.title, { body: n.body, tag: `task-${n.id}`, icon: './favicon.svg' })
          } catch { /* */ }
        }
        saveNotifiedSet(notified)
      }
    }

    // Initial check after 2s (let UI settle)
    const initialTimer = setTimeout(checkDue, 2000)
    // Then every 5 minutes
    const interval = setInterval(checkDue, 5 * 60 * 1000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
      document.removeEventListener('click', requestPermissionOnInteraction)
    }
  }, [])
}
