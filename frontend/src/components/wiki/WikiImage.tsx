'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
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
 *
 * `lightbox`：仅阅读页传 true 开启点击放大遮罩，编辑器预览默认关闭。
 */
export function WikiImage({ src, alt, lightbox = false }: { src?: string; alt?: string; lightbox?: boolean }) {
  const [attachment, setAttachment] = useState<{
    source: string
    resolvedSrc: string | null
    failed: boolean
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    if (!src?.startsWith('/api/wiki/attachments/')) return

    let objectUrl: string | null = null
    let cancelled = false
    // axios baseURL = '/api'，需去掉前缀避免 /api/api 重复
    api
      .get(src.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((r) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(r.data as Blob)
        setAttachment({ source: src, resolvedSrc: objectUrl, failed: false })
      })
      .catch(() => {
        if (!cancelled) setAttachment({ source: src, resolvedSrc: null, failed: true })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  const isAttachment = src?.startsWith('/api/wiki/attachments/') ?? false
  const currentAttachment = isAttachment && attachment?.source === src ? attachment : null
  const resolvedSrc = isAttachment ? currentAttachment?.resolvedSrc ?? null : src ?? null
  const failed = currentAttachment?.failed ?? false

  // 打开遮罩时重置缩放/位移；ESC 关闭
  const openLightbox = () => {
    if (!lightbox) return
    setScale(1)
    setPos({ x: 0, y: 0 })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const handleWheel = (e: React.WheelEvent) => {
    setScale((s) => Math.min(6, Math.max(0.5, s - e.deltaY * 0.0015 * s)))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    setDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { startX, startY, origX, origY } = dragRef.current
    setPos({ x: origX + (e.clientX - startX), y: origY + (e.clientY - startY) })
  }

  const stopDragging = () => {
    dragRef.current = null
    setDragging(false)
  }

  if (failed) {
    return <span className="text-xs text-v2-muted">[图片加载失败]</span>
  }
  if (!resolvedSrc) {
    return <span className="text-xs text-v2-subtle">图片加载中…</span>
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt ?? ''}
        onClick={openLightbox}
        style={{
          maxWidth: 720,
          width: '100%',
          height: 'auto',
          borderRadius: 6,
          cursor: lightbox ? 'zoom-in' : undefined,
        }}
      />
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80"
            onClick={() => setOpen(false)}
            onWheel={handleWheel}
          >
            <button
              type="button"
              aria-label="关闭"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
              }}
              className="fixed right-6 top-6 z-[1001] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedSrc}
              alt={alt ?? ''}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerLeave={stopDragging}
              draggable={false}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                cursor: dragging ? 'grabbing' : 'grab',
                transition: dragging ? 'none' : 'transform 0.05s ease-out',
                userSelect: 'none',
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
