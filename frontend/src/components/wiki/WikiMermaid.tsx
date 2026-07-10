'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { createPortal } from 'react-dom'
import { Code2, Copy, Check, Maximize2, X } from 'lucide-react'

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

  const [status, setStatus] = useState<MermaidRenderStatus>('idle')
  const [svg, setSvg] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
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
      setTimeout(() => setHasEnteredViewport(true), 0)
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
    if (!source) {
      // Use setTimeout to defer setState calls
      const timer = setTimeout(() => {
        setStatus('idle')
        setSvg('')
      }, 0)
      return () => clearTimeout(timer)
    }

    if (lazy && !hasEnteredViewport) {
      // Use setTimeout to defer setState call
      setTimeout(() => setStatus('waiting'), 0)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setStatus('rendering')
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme,
        })

        renderSeq.current += 1
        const renderId = `${mermaidId}-${renderSeq.current}`
        const { svg: renderedSvg } = await mermaid.render(renderId, source)

        if (cancelled) return

        setSvg(renderedSvg)
        setErrorMessage('')
        setStatus('success')
        setSourceOpen(false)
      } catch (error) {
        if (cancelled) return

        setSvg('')
        setErrorMessage(error instanceof Error ? error.message : '未知错误')
        setStatus('error')
        setSourceOpen(true)
      }
    }, debounceMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [chart, debounceMs, hasEnteredViewport, lazy, theme, mermaidId])

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
        {/* Toolbar */}
        {(status === 'success' || status === 'error') && (
          <div className="wiki-mermaid__toolbar">
            {enableSourceToggle && (
              <button
                type="button"
                className="wiki-mermaid__button"
                onClick={() => setSourceOpen(!sourceOpen)}
              >
                <Code2 className="h-3.5 w-3.5" />
                {sourceOpen ? '收起源码' : '查看源码'}
              </button>
            )}
            <button type="button" className="wiki-mermaid__button" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制源码'}
            </button>
            {enableFullscreen && status === 'success' && (
              <button type="button" className="wiki-mermaid__button" onClick={openFullscreen}>
                <Maximize2 className="h-3.5 w-3.5" />
                全屏查看
              </button>
            )}
          </div>
        )}

        {/* Rendering status */}
        {status === 'rendering' && (
          <div className="wiki-mermaid__status">图表渲染中...</div>
        )}

        {status === 'waiting' && (
          <div className="wiki-mermaid__placeholder" style={{ minHeight: '6rem' }} />
        )}

        {/* Success: show SVG */}
        {status === 'success' && (
          <div className="wiki-mermaid__viewport">
            <div className="wiki-mermaid__svg" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="wiki-mermaid__error">
            <div className="wiki-mermaid__error-title">Mermaid 图表渲染失败</div>
            {renderMode === 'preview' && errorMessage && (
              <div className="wiki-mermaid__error-message">{errorMessage}</div>
            )}
            <div className="wiki-mermaid__error-message">请检查图表语法。</div>
          </div>
        )}

        {/* Source code (shown when sourceOpen or error) */}
        {(sourceOpen || status === 'error') && (
          <pre className="wiki-mermaid__source">
            <code>{chart.trim()}</code>
          </pre>
        )}
      </div>

      {/* Fullscreen portal */}
      {fullscreenOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="wiki-mermaid__fullscreen" onClick={closeFullscreen}>
            <button
              type="button"
              className="wiki-mermaid__fullscreen-close"
              onClick={closeFullscreen}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="wiki-mermaid__fullscreen-panel" onClick={(e) => e.stopPropagation()}>
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
