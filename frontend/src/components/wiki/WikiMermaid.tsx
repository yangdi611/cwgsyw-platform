'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { createPortal } from 'react-dom'
import { Code2, Copy, Maximize2 } from 'lucide-react'
import { Alert, Button, Icon, IconButton, LoadingState, Skeleton } from '@/design-system/figma-neutral/components'
import { CANVAS_NEUTRAL } from '@/design-system/figma-neutral/canvas-tokens'
import './WikiMermaid.css'

export interface WikiMermaidProps {
  chart: string
  className?: string
  enableSourceToggle?: boolean
  enableFullscreen?: boolean
  lazy?: boolean
  debounceMs?: number
  renderMode?: 'read' | 'preview'
}

type MermaidRenderStatus = 'idle' | 'waiting' | 'rendering' | 'success' | 'error'

interface MermaidRenderResult {
  key: string
  status: 'rendering' | 'success' | 'error'
  svg: string
  errorMessage: string
}

export function WikiMermaid({
  chart,
  className = '',
  enableSourceToggle = true,
  enableFullscreen = true,
  lazy = true,
  debounceMs = 180,
  renderMode = 'read',
}: WikiMermaidProps) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'dark' : 'default'

  const [renderResult, setRenderResult] = useState<MermaidRenderResult | null>(null)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasEnteredViewport, setHasEnteredViewport] = useState(!lazy)

  const containerRef = useRef<HTMLDivElement>(null)
  const renderSeq = useRef(0)
  const reactId = useId()
  const mermaidId = `wiki-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  // Intersection Observer for lazy rendering
  useEffect(() => {
    if (!lazy || hasEnteredViewport) return
    if (!containerRef.current) return

    const container = containerRef.current

    // Check if already in viewport
    const rect = container.getBoundingClientRect()
    const isInViewport = rect.top < window.innerHeight + 240 && rect.bottom > -240

    if (isInViewport) {
      setHasEnteredViewport(true)
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: render immediately if IntersectionObserver is not available
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizes an external browser capability fallback
      setHasEnteredViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px' },
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [lazy, hasEnteredViewport])

  // Main render effect
  useEffect(() => {
    const source = chart.trim()
    if (!source || (lazy && !hasEnteredViewport)) return

    let cancelled = false
    const renderKey = `${theme}:${source}`
    const timer = window.setTimeout(async () => {
      setRenderResult({ key: renderKey, status: 'rendering', svg: '', errorMessage: '' })
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: theme === 'dark'
            ? {
                background: CANVAS_NEUTRAL[900],
                primaryColor: CANVAS_NEUTRAL[800],
                primaryTextColor: CANVAS_NEUTRAL[0],
                primaryBorderColor: CANVAS_NEUTRAL[600],
                lineColor: CANVAS_NEUTRAL[400],
                secondaryColor: CANVAS_NEUTRAL[700],
                tertiaryColor: CANVAS_NEUTRAL[800],
                fontFamily: 'Inter, sans-serif',
              }
            : {
                background: CANVAS_NEUTRAL[0],
                primaryColor: CANVAS_NEUTRAL[100],
                primaryTextColor: CANVAS_NEUTRAL[900],
                primaryBorderColor: CANVAS_NEUTRAL[400],
                lineColor: CANVAS_NEUTRAL[600],
                secondaryColor: CANVAS_NEUTRAL[50],
                tertiaryColor: CANVAS_NEUTRAL[200],
                fontFamily: 'Inter, sans-serif',
              },
        })

        renderSeq.current += 1
        const renderId = `${mermaidId}-${renderSeq.current}`
        const { svg: renderedSvg } = await mermaid.render(renderId, source)

        if (cancelled) return

        setRenderResult({ key: renderKey, status: 'success', svg: renderedSvg, errorMessage: '' })
        setSourceOpen(false)
      } catch (error) {
        if (cancelled) return

        setRenderResult({
          key: renderKey,
          status: 'error',
          svg: '',
          errorMessage: error instanceof Error ? error.message : '未知错误',
        })
        setSourceOpen(true)
      }
    }, debounceMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [chart, debounceMs, hasEnteredViewport, lazy, theme, mermaidId])

  const source = chart.trim()
  const renderKey = `${theme}:${source}`
  const status: MermaidRenderStatus = !source
    ? 'idle'
    : lazy && !hasEnteredViewport
      ? 'waiting'
      : renderResult?.key === renderKey
        ? renderResult.status
        : 'rendering'
  const svg = renderResult?.key === renderKey ? renderResult.svg : ''
  const errorMessage = renderResult?.key === renderKey ? renderResult.errorMessage : ''

  // Copy source code
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chart.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  // Fullscreen handlers
  const openFullscreen = () => setFullscreenOpen(true)
  const closeFullscreen = () => setFullscreenOpen(false)

  useEffect(() => {
    if (!fullscreenOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [fullscreenOpen])

  if (status === 'idle') return null

  return (
    <>
      <div ref={containerRef} className={`wiki-mermaid ${className}`}>
        {(status === 'success' || status === 'error') && (
          <div className="wiki-mermaid__toolbar">
            {enableSourceToggle && (
              <Button type="button" variant="ghost" size="sm" leadingIcon={<Code2 />} onClick={() => setSourceOpen(!sourceOpen)}>
                {sourceOpen ? '收起源码' : '查看源码'}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" leadingIcon={copied ? <Icon name="check" size="sm" /> : <Copy />} onClick={handleCopy}>
              {copied ? '已复制' : '复制源码'}
            </Button>
            {enableFullscreen && status === 'success' && (
              <Button type="button" variant="ghost" size="sm" leadingIcon={<Maximize2 />} onClick={openFullscreen}>
                全屏查看
              </Button>
            )}
          </div>
        )}

        {status === 'rendering' && (
          <LoadingState layout="compact" label="图表渲染中" />
        )}

        {status === 'waiting' && <Skeleton type="card" />}

        {status === 'success' && (
          <div className="wiki-mermaid__viewport">
            <div className="wiki-mermaid__svg" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        )}

        {status === 'error' && (
          <Alert
            tone="danger"
            layout="compact"
            title="Mermaid 图表渲染失败"
            description={renderMode === 'preview' && errorMessage ? errorMessage : '请检查图表语法。'}
            showDismiss={false}
          />
        )}

        {(sourceOpen || status === 'error') && (
          <pre className="wiki-mermaid__source">
            <code>{chart.trim()}</code>
          </pre>
        )}
      </div>

      {fullscreenOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="wiki-mermaid__fullscreen" onClick={closeFullscreen} role="presentation">
            <div className="wiki-mermaid__fullscreen-close">
              <IconButton variant="outline" size="md" icon="close" aria-label="关闭全屏图表" onClick={closeFullscreen} />
            </div>
            <div className="wiki-mermaid__fullscreen-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mermaid 图表全屏">
              <div className="wiki-mermaid__fullscreen-scroll">
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
