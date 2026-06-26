'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'

/**
 * 带鉴权的 wiki 图片渲染组件。
 *
 * 背景：wiki 附件接口 `GET /api/wiki/attachments/{id}` 需要 JWT(只走
 * `Authorization` header)，而普通 `<img src>` 请求无法携带该 header，会 401 图裂。
 * 这里用 axios(请求拦截器自动加 token)把附件作为 blob 拉下来，再用
 * `URL.createObjectURL` 生成临时地址显示，正文里存的仍是稳定的 `/api/wiki/attachments/{id}`。
 *
 * 非附件 src(外链 http(s)、data: 等)直接透传，不走鉴权拉取。
 */
export function WikiImage({ src, alt }: { src?: string; alt?: string }) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!src) {
      setResolvedSrc(null)
      return
    }
    // 仅 wiki 附件走鉴权 blob 拉取；其余(外链/data URI)直接透传
    if (!src.startsWith('/api/wiki/attachments/')) {
      setResolvedSrc(src)
      return
    }

    let objectUrl: string | null = null
    let cancelled = false
    // axios baseURL = '/api'，需去掉前缀避免 /api/api 重复
    api
      .get(src.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((r) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(r.data as Blob)
        setResolvedSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed) {
    return <span className="text-xs text-v2-muted">[图片加载失败]</span>
  }
  if (!resolvedSrc) {
    return <span className="text-xs text-v2-subtle">图片加载中…</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt ?? ''}
      style={{ maxWidth: 720, width: '100%', height: 'auto', borderRadius: 6 }}
    />
  )
}
