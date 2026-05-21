'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/store/authStore'
import { getToken } from '@/lib/auth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // 订阅 persist hydration 完成事件
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })
    // 如果已经 hydrated（比如快速二次渲染），直接设置
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!getToken() || !user) router.replace('/login')
  }, [hydrated, user, router])

  if (!hydrated) return null
  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
