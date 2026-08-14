'use client'

import { useEffect, useState } from 'react'
import { Toast } from './components/Feedback'

type ToastTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface ToastRecord {
  id: string
  tone: ToastTone
  title: string
}

type ToastListener = (toasts: ToastRecord[]) => void

const listeners = new Set<ToastListener>()
let queue: ToastRecord[] = []
let nextId = 1

function emit() {
  const snapshot = queue
  listeners.forEach((listener) => listener(snapshot))
}

function dismiss(id: string) {
  queue = queue.filter((item) => item.id !== id)
  emit()
}

function push(tone: ToastTone, title: unknown) {
  const record: ToastRecord = {
    id: `cwgsyw-toast-${nextId}`,
    tone,
    title: String(title ?? ''),
  }
  nextId += 1
  queue = [...queue, record].slice(-4)
  emit()
  if (typeof window !== 'undefined') window.setTimeout(() => dismiss(record.id), 4200)
  return record.id
}

export const toast = {
  message(title: unknown) {
    return push('neutral', title)
  },
  info(title: unknown) {
    return push('info', title)
  },
  success(title: unknown) {
    return push('success', title)
  },
  warning(title: unknown) {
    return push('warning', title)
  },
  error(title: unknown) {
    return push('danger', title)
  },
  dismiss,
}

export function NeutralToaster() {
  const [toasts, setToasts] = useState<ToastRecord[]>(queue)
  useEffect(() => {
    listeners.add(setToasts)
    setToasts(queue)
    return () => {
      listeners.delete(setToasts)
    }
  }, [])
  if (toasts.length === 0) return null
  return (
    <div className="cwgsyw-toast-viewport" aria-live="polite" aria-relevant="additions text">
      {toasts.map((item) => (
        <Toast
          key={item.id}
          tone={item.tone}
          layout="compact"
          title={item.title}
          showDescription={false}
          showDismiss
          onDismiss={() => dismiss(item.id)}
        />
      ))}
    </div>
  )
}
