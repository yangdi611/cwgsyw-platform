'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import { WikiShellToggle } from '@/components/wiki/WikiShellChrome'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import type { WikiPage, WikiSearchResult, WikiSpace } from '@/types/wiki'
import { createWikiMarkdownComponents } from '@/components/wiki/wikiMarkdownComponents'
import '@uiw/react-md-editor/markdown-editor.css'
import '@/components/wiki/WikiEditor.css'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  EmptyState,
  Input,
} from '@/design-system/figma-neutral/components'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] as const
const ALLOWED_IMAGE_MIMES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
]
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.svg,image/png,image/jpeg,image/gif,image/webp,image/svg+xml'
const FMT = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const WIKI_PAGE_TITLE_MAX_LENGTH = 255


const WIKI_EDITOR_TOOLBAR_ICONS: Record<string, string> = {
  bold: 'bold',
  italic: 'italic',
  strikethrough: 'strikethrough',
  hr: 'minus',
  title: 'heading',
  heading: 'heading',
  heading1: 'heading-1',
  heading2: 'heading-2',
  heading3: 'heading-3',
  heading4: 'heading-4',
  heading5: 'heading-5',
  heading6: 'heading-6',
  link: 'link',
  quote: 'quote',
  code: 'code',
  codeBlock: 'code-2',
  comment: 'message-square',
  image: 'image',
  table: 'table',
  'unordered-list': 'list',
  'ordered-list': 'list-ordered',
  'checked-list': 'list-checks',
  help: 'help',
  edit: 'file-code',
  live: 'columns',
  preview: 'eye',
  fullscreen: 'maximize-2',
}

function WikiEditorToolbarIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className={`cwgsyw-wiki-editor__toolbar-icon cwgsyw-wiki-editor__toolbar-icon--${name}`}
    />
  )
}

type WikiEditorCommand = {
  name?: string
  icon?: ReactNode
  children?: WikiEditorCommand[]
  execute?: (...args: never[]) => unknown
}

function withWikiEditorToolbarIcon<T extends WikiEditorCommand>(cmd: T): T {
  const iconName = cmd.name ? WIKI_EDITOR_TOOLBAR_ICONS[cmd.name] : undefined
  return {
    ...cmd,
    ...(iconName ? { icon: <WikiEditorToolbarIcon name={iconName} /> } : {}),
    ...(Array.isArray(cmd.children)
      ? { children: cmd.children.map((child) => withWikiEditorToolbarIcon(child)) }
      : {}),
  }
}

const MIRROR_PROPS = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
  'lineHeight', 'textTransform', 'wordSpacing', 'whiteSpace', 'wordWrap', 'tabSize',
] as const

function getCaretCoordinates(ta: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const div = document.createElement('div')
  const style = div.style
  const computed = window.getComputedStyle(ta)
  style.position = 'absolute'
  style.visibility = 'hidden'
  style.whiteSpace = 'pre-wrap'
  style.wordWrap = 'break-word'
  style.overflowWrap = 'break-word'
  for (const prop of MIRROR_PROPS) {
    ;(style as unknown as Record<string, string>)[prop] = computed[prop as keyof CSSStyleDeclaration] as string
  }
  div.textContent = ta.value.slice(0, position)
  const span = document.createElement('span')
  span.textContent = ta.value.slice(position) || '.'
  div.appendChild(span)
  document.body.appendChild(div)
  const top = span.offsetTop - ta.scrollTop
  const left = span.offsetLeft - ta.scrollLeft
  document.body.removeChild(div)
  return { top, left }
}

export default function WikiEditorPage() {
  const { spaceId, pageId } = useParams<{ spaceId: string; pageId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const sid = Number(spaceId)
  const pid = Number(pageId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [acQuery, setAcQuery] = useState<string | null>(null)
  const [acResults, setAcResults] = useState<WikiSearchResult[]>([])
  const [acPos, setAcPos] = useState<{ top: number; left: number } | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: spaces } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: () => wikiApi.listSpaces(),
  })
  const currentSpace = spaces?.find((space) => space.id === sid)

  const { data: page, isError: pageError } = useQuery<WikiPage>({
    queryKey: ['wiki-page', pid],
    queryFn: () => wikiApi.getPage(pid),
  })

  useEffect(() => {
    if (page && page.canWrite === false) router.replace(`/wiki/${sid}/${pid}`)
  }, [page, router, sid, pid])

  useBreadcrumbLabel([currentSpace?.name, page?.title])

  useEffect(() => {
    if (!page) return
    // Query data initializes the editable page form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(page.title)
    setContent(page.content ?? '')
  }, [page])

  const displayedTitle = title || page?.title || ''

  const saveMutation = useMutation({
    mutationFn: (comment?: string) =>
      wikiApi.savePage(pid, { title: displayedTitle.trim(), content, comment }),
    onSuccess: (updated) => {
      setSavedAt(FMT.format(new Date()))
      queryClient.setQueryData<WikiPage>(['wiki-page', pid], updated)
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', sid] })
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败'
      toast.error(message)
    },
  })

  useEffect(() => {
    if (!page) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(undefined)
    }, 30_000)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        saveMutation.mutate(undefined)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveMutation])

  const uploadAndInsert = useCallback(
    async (file: File) => {
      const name = file.name?.toLowerCase() ?? ''
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
      const okType =
        (ALLOWED_IMAGE_EXTS as readonly string[]).includes(ext) ||
        ALLOWED_IMAGE_MIMES.includes(file.type)
      if (!okType) {
        toast.error('仅支持 PNG / JPG / GIF / WEBP / SVG 图片')
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error('图片不能超过 5 MB')
        return
      }
      try {
        const { url } = await wikiApi.uploadAttachment(pid, file)
        const insertText = `\n![](${url})\n`
        const textarea = editorRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
        if (textarea) {
          const start = textarea.selectionStart
          setContent((current) => current.slice(0, start) + insertText + current.slice(start))
        } else {
          setContent((current) => current + insertText)
        }
      } catch {
        toast.error('图片上传失败')
      }
    },
    [pid],
  )

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        if (item.type.startsWith('image/')) {
          event.preventDefault?.()
          const file = item.getAsFile()
          if (file) await uploadAndInsert(file)
          break
        }
      }
    },
    [uploadAndInsert],
  )

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) await uploadAndInsert(file)
      event.target.value = ''
    },
    [uploadAndInsert],
  )

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const handler = (event: ClipboardEvent) => {
      void handlePaste(event)
    }
    el.addEventListener('paste', handler)
    return () => el.removeEventListener('paste', handler)
  }, [handlePaste])

  const handleContentChange = useCallback(
    (val: string | undefined) => {
      const next = val ?? ''
      setContent(next)
      const textarea = editorRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
      const caret = textarea ? textarea.selectionStart : next.length
      const before = next.slice(0, caret)
      const match = before.match(/\[\[([^\]\n]{0,30})$/)
      if (match) {
        const query = match[1]
        setAcQuery(query)
        if (textarea) {
          const caretXY = getCaretCoordinates(textarea, caret)
          const taRect = textarea.getBoundingClientRect()
          const edRect = editorRef.current?.getBoundingClientRect()
          const top = taRect.top - (edRect?.top ?? 0) + caretXY.top + 20
          const left = taRect.left - (edRect?.left ?? 0) + caretXY.left
          setAcPos({ top, left })
        }
        wikiApi
          .search({ keyword: query, space_id: sid, page: 1, size: 8 })
          .then((result) => setAcResults(result.records))
          .catch(() => setAcResults([]))
      } else {
        setAcQuery(null)
        setAcResults([])
        setAcPos(null)
      }
    },
    [sid],
  )

  const insertWikiLink = useCallback((result: WikiSearchResult) => {
    const textarea = editorRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
    setContent((current) => {
      const caret = textarea ? textarea.selectionStart : current.length
      const before = current.slice(0, caret)
      const after = current.slice(caret)
      const newBefore = before.replace(/\[\[([^\]\n]{0,30})$/, `[[${result.title}]]`)
      return newBefore + after
    })
    setAcQuery(null)
    setAcResults([])
  }, [])

  const previewComponents = useMemo(
    () =>
      createWikiMarkdownComponents({
        imageLightbox: false,
        mermaidRenderMode: 'preview',
        mermaidLazy: false,
        mermaidDebounceMs: 250,
      }),
    [],
  )

  if (pageError || (spaces && !currentSpace)) {
    return (
      <section className="cwgsyw-devices-panel cwgsyw-wiki-edit">
        <header className="cwgsyw-devices-panel__head cwgsyw-wiki-edit__head">
          <span className="cwgsyw-wiki-edit__head-start">
            <WikiShellToggle />
            编辑
          </span>
        </header>
        <div className="cwgsyw-devices-panel__body">
          <EmptyState title="页面不存在或无权编辑" description="请返回知识空间后重新选择页面。" />
        </div>
      </section>
    )
  }

  return (
    <section className="cwgsyw-devices-panel cwgsyw-wiki cwgsyw-wiki-edit">
      <header className="cwgsyw-devices-panel__head cwgsyw-wiki-edit__head">
        <span className="cwgsyw-wiki-edit__head-start">
          <WikiShellToggle />
          编辑
        </span>
        <div className="cwgsyw-inline-controls cwgsyw-wiki__header-actions">
          <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/wiki/${sid}/${pid}`)}>
            返回
          </Button>
          <Button type="button" size="sm" disabled={!displayedTitle.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate(undefined)}>
            保存
          </Button>
        </div>
      </header>
      <div className="cwgsyw-wiki-edit__body">
      <div className="cwgsyw-wiki-edit__title-row">
        <Input
          size="sm"
          value={displayedTitle}
          maxLength={WIKI_PAGE_TITLE_MAX_LENGTH}
          placeholder="页面标题"
          onChange={(event) => setTitle(event.target.value)}
        />
        <p className="cwgsyw-wiki-edit__status">
          {`${displayedTitle.length}/${WIKI_PAGE_TITLE_MAX_LENGTH} · ${savedAt ? `已保存 ${savedAt}` : '未保存'}`}
        </p>
      </div>
      <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={handleFileInputChange} />
      <div className="wiki-editor relative min-h-0 flex-1 overflow-hidden" ref={editorRef} data-color-mode="light">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          preview="live"
          height="100%"
          visibleDragbar={false}
          commandsFilter={(cmd) => {
            const next = withWikiEditorToolbarIcon(cmd)
            if (cmd.name === 'image') {
              return {
                ...next,
                execute: () => fileInputRef.current?.click(),
              }
            }
            return next
          }}
          previewOptions={{
            components: previewComponents,
          }}
        />
        {acQuery !== null && acResults.length > 0 && acPos ? (
          <div className="cwgsyw-wiki-edit__ac" style={{ top: acPos.top, left: acPos.left }}>
            <div className="cwgsyw-wiki-edit__ac-head">插入 Wiki 链接</div>
            {acResults.map((result) => (
              <Button
                key={result.pageId}
                type="button"
                variant="ghost"
                className="cwgsyw-wiki-edit__ac-item"
                onClick={() => insertWikiLink(result)}
              >
                <span>{result.title}</span>
                {result.highlight ? <span className="cwgsyw-wiki-search__hit">{result.highlight}</span> : null}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      </div>
    </section>
  )
}
