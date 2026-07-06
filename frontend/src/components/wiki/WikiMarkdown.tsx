'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import { createWikiMarkdownComponents } from './wikiMarkdownComponents'

export interface WikiMarkdownProps {
  content: string
  imageLightbox?: boolean
  mermaidRenderMode?: 'read' | 'preview'
  mermaidLazy?: boolean
  mermaidDebounceMs?: number
}

export function WikiMarkdown({
  content,
  imageLightbox = false,
  mermaidRenderMode = 'read',
  mermaidLazy = true,
  mermaidDebounceMs = 180,
}: WikiMarkdownProps) {
  const components = useMemo(
    () =>
      createWikiMarkdownComponents({
        imageLightbox,
        mermaidRenderMode,
        mermaidLazy,
        mermaidDebounceMs,
      }),
    [imageLightbox, mermaidRenderMode, mermaidLazy, mermaidDebounceMs],
  )

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}
