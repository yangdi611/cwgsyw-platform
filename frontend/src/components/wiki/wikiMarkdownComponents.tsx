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

// Recursively extract text from React children
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children
  }
  if (typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(extractText).join('')
  }
  if (children && typeof children === 'object') {
    const element = children as { props?: { children?: React.ReactNode } }
    if ('props' in element && element.props && element.props.children !== undefined) {
      return extractText(element.props.children)
    }
  }
  return ''
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
      const value = extractText(children).replace(/\n$/, '')

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
