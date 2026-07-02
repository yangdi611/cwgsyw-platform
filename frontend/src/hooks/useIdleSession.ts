'use client'

import { useEffect, useRef } from 'react'
import api from '@/lib/api'
import { getToken } from '@/lib/auth'
import { subscribeAuthBroadcast } from '@/lib/auth-broadcast'
import { useAuth } from '@/hooks/useAuth'

/**
 * 1 小时无真实操作自动退出（SPEC 13.5）。只在真实用户交互后节流调用
 * /auth/session/touch；后台轮询、路由跳转产生的请求不算真实操作。
 */
const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const TOUCH_THROTTLE_MS = 5 * 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000

const REAL_INTERACTION_EVENTS: (keyof WindowEventMap)[] = ['click', 'keydown', 'touchstart']

export function useIdleSession() {
  const { logout } = useAuth()
  const lastInteractionAt = useRef(0)
  const lastTouchAt = useRef(0)

  useEffect(() => {
    if (!getToken()) return
    lastInteractionAt.current = Date.now()

    const markInteraction = () => {
      lastInteractionAt.current = Date.now()
      const now = Date.now()
      if (now - lastTouchAt.current >= TOUCH_THROTTLE_MS) {
        lastTouchAt.current = now
        api.post('/auth/session/touch').catch(() => {
          // touch 失败不主动登出，由下一次业务请求的 401 拦截器处理
        })
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markInteraction()
      }
      // 页面隐藏时不 touch（SPEC 13.5 第 3 点）
    }

    REAL_INTERACTION_EVENTS.forEach((evt) => window.addEventListener(evt, markInteraction))
    document.addEventListener('visibilitychange', onVisibilityChange)

    const checkTimer = window.setInterval(() => {
      if (Date.now() - lastInteractionAt.current > IDLE_TIMEOUT_MS) {
        logout('SESSION_TIMEOUT')
      }
    }, CHECK_INTERVAL_MS)

    const unsubscribe = subscribeAuthBroadcast((msg) => {
      if (msg.type === 'logout') {
        window.location.href = '/login'
      }
    })

    return () => {
      REAL_INTERACTION_EVENTS.forEach((evt) => window.removeEventListener(evt, markInteraction))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(checkTimer)
      unsubscribe()
    }
  }, [logout])
}
