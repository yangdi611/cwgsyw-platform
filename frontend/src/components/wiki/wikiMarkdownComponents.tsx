import type { Components } from 'react-markdown'
import { WikiImage } from './WikiImage'
import { WikiMermaid } from './WikiMermaid'

export interface WikiMarkdownComponentsOptions {
  imageLightbox?: boolean
  mermaidRenderMode?: 'read' | 'preview'
  mermaidLazy?: boolean
  mermaidDebounceMs?: number
}

function getCodeLanguage(className?: string): string | null {
  const match = /language-([^\s]+)/i.exec(className ?? '')
  return match?.[1]?.toLowerCase() ?? null
}

export function createWikiMarkdownComponents(
  options: WikiMarkdownComponentsOptions = {},
): Components {
  const {
    imageLightbox = false,
    mermaidRenderMode = 'read',
    mermaidLazy = true,
    mermaidDebounceMs = 180,
  } = options

  return {
    img: ({ src, alt }) => (
      <WikiImage
        src={typeof src === 'string' ? src : undefined}
        alt={alt}
        lightbox={imageLightbox}
      />
    ),
    code: ({ inline, className, children, ...props }: {
      inline?: boolean
      className?: string
      children?: React.ReactNode
    }) => {
      const language = getCodeLanguage(className)
      const value = String(children ?? '').replace(/\n$/, '')

      if (!inline && language === 'mermaid') {
        return (
          <WikiMermaid
            chart={value}
            renderMode={mermaidRenderMode}
            lazy={mermaidLazy}
            debounceMs={mermaidDebounceMs}
          />
        )
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
  }
}
