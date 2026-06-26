'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { wikiApi } from '@/lib/wiki-api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'
import { ArrowLeft, Save } from 'lucide-react'
import type { WikiPage, WikiSearchResult, WikiSpace } from '@/types/wiki'
import '@uiw/react-md-editor/markdown-editor.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

const FMT = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * 镜像 div 测量法：算出 textarea 中某字符位置光标的像素坐标（相对 textarea 内容左上角）。
 * 复制 textarea 的字体/内边距/换行等样式到隐藏 div，在光标处插入标记 span 取其偏移。
 * 这是 textarea 光标定位的业界标准做法，正确处理自动换行与横向位置。
 */
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
  const { hasPermission, isHydrated } = usePermission()
  const groupScope = useAuthStore((s) => s.groupScope)
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  const sid = Number(spaceId)
  const pid = Number(pageId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // Autocomplete state for [[ trigger
  const [acQuery, setAcQuery] = useState<string | null>(null)
  const [acResults, setAcResults] = useState<WikiSearchResult[]>([])
  const [acPos, setAcPos] = useState<{ top: number; left: number } | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const { data: spaces } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: () => wikiApi.listSpaces(),
  })
  const readOnly = spaces?.find((s) => s.id === sid)?.read_only ?? false

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('wiki', 'update')) router.replace(`/wiki/${sid}/${pid}`)
  }, [isHydrated, hasPermission, router, sid, pid])

  // 手册空间（read_only）对非 admin 不可编辑，跳回阅读页
  useEffect(() => {
    if (spaces && readOnly && !isAdmin) router.replace(`/wiki/${sid}/${pid}`)
  }, [spaces, readOnly, isAdmin, router, sid, pid])

  const { data: page } = useQuery<WikiPage>({
    queryKey: ['wiki-page', pid],
    queryFn: () => wikiApi.getPage(pid),
  })

  useEffect(() => {
    if (!page) return
    setTitle(page.title)
    setContent(page.content ?? '')
  }, [page])

  const saveMutation = useMutation({
    mutationFn: (comment?: string) =>
      wikiApi.savePage(pid, { title: title.trim() || '无标题', content, comment }),
    onSuccess: (updated) => {
      setSavedAt(FMT.format(new Date()))
      queryClient.setQueryData<WikiPage>(['wiki-page', pid], updated)
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', sid] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败'
      toast.error(msg)
    },
  })

  // Auto-save: 30s debounce after content/title changes
  useEffect(() => {
    if (!page) return // don't auto-save before initial load
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(undefined)
    }, 30_000)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title])

  // Ctrl+S manual save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveMutation.mutate(undefined)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveMutation])

  // Image paste/drop → upload attachment → insert ![](url)
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent | ClipboardEvent) => {
      const clipEvent = e as ClipboardEvent
      const items = clipEvent.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          e.preventDefault?.()
          const file = item.getAsFile()
          if (!file) return
          try {
            const { url } = await wikiApi.uploadAttachment(pid, file)
            const insertText = `\n![](${url})\n`
            setContent((c) => c + insertText)
          } catch {
            toast.error('图片上传失败')
          }
          break
        }
      }
    },
    [pid],
  )

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const handler = (e: ClipboardEvent) => handlePaste(e)
    el.addEventListener('paste', handler)
    return () => el.removeEventListener('paste', handler)
  }, [handlePaste])

  // [[ autocomplete: 用 textarea 真实光标位置检测，支持文档中间输入
  const handleContentChange = useCallback(
    (val: string | undefined) => {
      const v = val ?? ''
      setContent(v)
      // 取编辑器内 textarea 的光标位置；取不到则回退到文末
      const ta = editorRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
      const caret = ta ? ta.selectionStart : v.length
      const before = v.slice(0, caret)
      // 光标前最近的未闭合 [[xxx（xxx 不含 ] 和换行，最多 30 字）
      const match = before.match(/\[\[([^\]\n]{0,30})$/)
      if (match) {
        const q = match[1]
        setAcQuery(q)
        // 计算浮层位置：镜像 div 测量光标真实像素坐标
        if (ta) {
          const caretXY = getCaretCoordinates(ta, caret)
          const taRect = ta.getBoundingClientRect()
          const edRect = editorRef.current?.getBoundingClientRect()
          // 光标坐标 → 相对编辑器容器；+20 让浮层落在光标下一行
          const top = taRect.top - (edRect?.top ?? 0) + caretXY.top + 20
          const left = taRect.left - (edRect?.left ?? 0) + caretXY.left
          setAcPos({ top, left })
        }
        wikiApi
          .search({ keyword: q, space_id: sid, page: 1, size: 8 })
          .then((r) => setAcResults(r.records))
          .catch(() => setAcResults([]))
      } else {
        setAcQuery(null)
        setAcResults([])
        setAcPos(null)
      }
    },
    [sid],
  )

  const insertWikiLink = useCallback(
    (result: WikiSearchResult) => {
      const ta = editorRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
      setContent((c) => {
        const caret = ta ? ta.selectionStart : c.length
        const before = c.slice(0, caret)
        const after = c.slice(caret)
        // 把光标前最近的 [[xxx 替换为 [[标题]]
        const newBefore = before.replace(/\[\[([^\]\n]{0,30})$/, `[[${result.title}]]`)
        return newBefore + after
      })
      setAcQuery(null)
      setAcResults([])
    },
    [],
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-v2-border bg-v2-surface px-4 py-2.5">
        <button
          onClick={() => router.push(`/wiki/${sid}/${pid}`)}
          className="flex items-center gap-1.5 text-sm text-v2-muted hover:text-v2-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <Input
          className="h-9 flex-1 text-base font-semibold"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="页面标题"
        />
        <span className="shrink-0 text-xs text-v2-subtle">
          {savedAt ? `已保存 ${savedAt}` : '未保存'}
        </span>
        <Button
          variant="primary"
          size="sm"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(undefined)}
        >
          <Save className="h-3.5 w-3.5" />
          保存
        </Button>
      </div>

      {/* Editor */}
      <div className="relative min-h-0 flex-1" ref={editorRef} data-color-mode="light">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          preview="live"
          height="100%"
          style={{ borderRadius: 0, border: 'none', height: '100%' }}
          visibleDragbar={false}
        />

        {/* [[ autocomplete popover —— 跟随光标定位 */}
        {acQuery !== null && acResults.length > 0 && acPos && (
          <div
            className="absolute z-50 max-h-64 w-72 overflow-y-auto rounded-v2-md border border-v2-border bg-v2-surface shadow-lg"
            style={{ top: acPos.top, left: acPos.left }}
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-v2-muted">插入 Wiki 链接</div>
            {acResults.map((r) => (
              <button
                key={r.page_id}
                onClick={() => insertWikiLink(r)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-v2-surface-hover"
              >
                <span className="font-medium text-v2-fg">{r.title}</span>
                {r.highlight && (
                  <span className="truncate text-xs text-v2-muted">{r.highlight}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
