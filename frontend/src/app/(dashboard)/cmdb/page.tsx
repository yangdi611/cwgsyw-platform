'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CmdbPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/cmdb/models') }, [router])
  return null
}
