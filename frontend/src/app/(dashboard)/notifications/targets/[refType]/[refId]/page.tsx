'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import '@/design-system/figma-neutral/index.css'
import { Button, EmptyState, LoadingState } from '@/design-system/figma-neutral/components'

type TargetResolver = (id: number) => Promise<string>

const targetResolvers: Record<string, TargetResolver> = {
  change_doc: async (id) => {
    await api.get(`/change-docs/${id}`)
    return `/change-docs/${id}`
  },
  task: async (id) => {
    await api.get(`/tasks/${id}`)
    return `/tasks/${id}`
  },
  ci_instance: async (id) => {
    const response = await api.get(`/cmdb/instances/${id}`)
    const instance = response.data.data as { modelCode?: string; modelId?: string }
    const modelCode = instance.modelCode ?? instance.modelId
    if (!modelCode) throw new Error('目标实例缺少模型信息')
    return `/cmdb/instances/by-model/${modelCode}/${id}`
  },
  wiki_page: async (id) => {
    const response = await api.get(`/wiki/pages/${id}`)
    const page = response.data.data as { spaceId?: number }
    if (!page.spaceId) throw new Error('目标 Wiki 页面缺少空间信息')
    return `/wiki/${page.spaceId}/${id}`
  },
}

export default function NotificationTargetPage() {
  const { refType, refId } = useParams<{ refType: string; refId: string }>()
  const router = useRouter()
  const id = Number(refId)
  const resolver = targetResolvers[refType]

  const { data: href, isLoading } = useQuery<string>({
    queryKey: ['notification-target', refType, id],
    queryFn: () => {
      if (!resolver || !Number.isInteger(id) || id <= 0) {
        return Promise.reject(new Error('不支持的通知目标'))
      }
      return resolver(id)
    },
    retry: false,
  })

  useEffect(() => {
    if (href) router.replace(href)
  }, [href, router])

  if (href) {
    return <LoadingState label="正在打开通知目标…" />
  }

  if (isLoading) {
    return <LoadingState label="正在验证通知目标…" />
  }

  return (
    <EmptyState
      title="通知目标不可用"
      description="该目标可能已删除、您没有访问权限，或通知引用类型暂不支持。"
      action={
        <Button type="button" variant="secondary" onClick={() => router.replace('/notifications')}>
          返回通知中心
        </Button>
      }
    />
  )
}
