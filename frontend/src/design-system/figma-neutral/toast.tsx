'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Toast } from './components/Feedback'

type ToastTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface ToastExtras {
  description?: string
  action?: ReactNode
}

interface ToastRecord extends ToastExtras {
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

function push(tone: ToastTone, title: unknown, extras?: ToastExtras) {
  const record: ToastRecord = {
    id: `cwgsyw-toast-${nextId}`,
    tone,
    title: String(title ?? ''),
    description: extras?.description,
    action: extras?.action,
  }
  nextId += 1
  queue = [...queue, record].slice(-4)
  emit()
  if (typeof window !== 'undefined') window.setTimeout(() => dismiss(record.id), 4200)
  return record.id
}

export const toast = {
  message(title: unknown, extras?: ToastExtras) {
    return push('neutral', title, extras)
  },
  info(title: unknown, extras?: ToastExtras) {
    return push('info', title, extras)
  },
  success(title: unknown, extras?: ToastExtras) {
    return push('success', title, extras)
  },
  warning(title: unknown, extras?: ToastExtras) {
    return push('warning', title, extras)
  },
  error(title: unknown, extras?: ToastExtras) {
    return push('danger', title, extras)
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
          description={item.description}
          showDescription={Boolean(item.description)}
          showDismiss
          action={item.action}
          onDismiss={() => dismiss(item.id)}
        />
      ))}
    </div>
  )
}
