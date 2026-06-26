'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { getToken } from '@/lib/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) router.replace('/login')
    else setChecked(true)
  }, [router])

  if (!checked) return null

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="w-full max-w-none">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}