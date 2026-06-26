'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  Box,
  FolderOpen,
  FileText,
  ServerCog,
  Users,
  BookOpen,
  Search,
  Loader2,
} from 'lucide-react'
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { globalSearch, type SearchResultItem } from '@/lib/search-api'
import { useCommandPalette } from '@/store/commandPaletteStore'

/** 结果类型 → 图标。 */
const TYPE_ICON: Record<SearchResultItem['type'], typeof Box> = {
  ci: Box,
  shared_file: FolderOpen,
  change_doc: FileText,
  device: ServerCog,
  user: Users,
  wiki: BookOpen,
}

/** 分组展示顺序（后端可能乱序返回，这里固定顺序更稳定）。 */
const GROUP_ORDER = ['配置项 (CI)', '共享文件', '变更单', '设备', '用户', '知识库']

/**
 * 把文本中所有匹配关键词的片段加粗（灰度系统不上色，用字重区分）。
 * 中文无词边界，做大小写不敏感的子串匹配即可。
 */
function highlightAll(text: string, kw: string): React.ReactNode {
  const k = kw.trim()
  if (!text || !k) return text
  const lower = text.toLowerCase()
  const klower = k.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let n = 0
  for (;;) {
    const idx = lower.indexOf(klower, i)
    if (idx === -1) {
      parts.push(text.slice(i))
      break
    }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={n++} className="bg-transparent font-semibold text-foreground">
        {text.slice(idx, idx + k.length)}
      </mark>
    )
    i = idx + k.length
  }
  return parts
}

/**
 * 在文本里定位首个关键词，拆成 before/match/after 三段（供摘要聚光灯渲染）。
 * 未命中返回 null（关键词只命中标题、未命中摘要时会发生）。
 */
function splitOnKeyword(
  text: string | null | undefined,
  kw: string
): { before: string; match: string; after: string } | null {
  const k = kw.trim()
  if (!text || !k) return null
  const idx = text.toLowerCase().indexOf(k.toLowerCase())
  if (idx === -1) return null
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + k.length),
    after: text.slice(idx + k.length),
  }
}

export function CommandPalette() {
  const router = useRouter()
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)

  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // 全局快捷键：⌘K / Ctrl+K 开关，Esc 由 Dialog 处理
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useCommandPalette.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 关闭时重置查询状态
  useEffect(() => {
    if (!open) {
      setKeyword('')
      setResults([])
      setLoading(false)
    }
  }, [open])

  // 防抖搜索（300ms）。reqId 防止旧请求覆盖新结果（竞态）。
  useEffect(() => {
    const kw = keyword.trim()
    if (!kw) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++reqId.current
    const timer = setTimeout(() => {
      globalSearch(kw, 5)
        .then((items) => {
          if (id === reqId.current) setResults(items)
        })
        .catch(() => {
          if (id === reqId.current) setResults([])
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const handleSelect = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  // 按 group_label 聚合，并按固定顺序排列
  const grouped = GROUP_ORDER.map((label) => ({
    label,
    items: results.filter((r) => r.group_label === label),
  })).filter((g) => g.items.length > 0)

  const hasQuery = keyword.trim().length > 0
  // Spotlight 式渐进披露：未输入时只显示搜索框，输入后结果面板才展开
  const showPanel = hasQuery

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="command-palette"
          className={cn(
            'fixed top-[14vh] left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-2xl shadow-foreground/10 duration-100 outline-none sm:max-w-2xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'
          )}
        >
          <DialogPrimitive.Title className="sr-only">全局搜索</DialogPrimitive.Title>
          <Command shouldFilter={false} className="flex flex-col">
            {/* 搜索框：Spotlight 风格，高大醒目 */}
            <div className="flex items-center gap-3 px-5">
              {loading ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <Command.Input
                autoFocus
                value={keyword}
                onValueChange={setKeyword}
                placeholder="搜索 CI、共享文件、变更单、设备、用户、知识库…"
                className="flex h-16 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* 结果面板：仅在输入后出现 */}
            {showPanel && (
              <Command.List className="max-h-[55vh] overflow-y-auto overflow-x-hidden border-t p-2">
                {loading && results.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    搜索中…
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                    未找到匹配结果
                  </Command.Empty>
                )}
                {grouped.map((group) => (
                  <Command.Group
                    key={group.label}
                    heading={
                      <span className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {group.label}
                      </span>
                    }
                  >
                    {group.items.map((item) => {
                      const Icon = TYPE_ICON[item.type]
                      const kw = keyword.trim()
                      // 聚光灯仅用于「wiki 长正文截取片段」：关键词藏在 substring(content,pos-50,100)
                      // 的中部，左/右对齐都会把它推出可视区。阈值 30 ≈ 摘要列(≈340px)在 text-xs(12px)
                      // 下能容纳的 CJK 字数——超过这个长度才需要把命中词拉到中间。
                      // 其余(结构化短摘要 region/IP/单号，或命中在标题的 wiki)一律右对齐摆放。
                      const spot =
                        item.type === 'wiki' && item.subtitle && item.subtitle.length > 30
                          ? splitOnKeyword(item.subtitle, kw)
                          : null
                      return (
                        <Command.Item
                          key={`${item.type}-${item.id}`}
                          value={`${item.type}-${item.id}`}
                          onSelect={() => handleSelect(item.url)}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                        >
                          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          {/* 标题：聚光灯模式下让摘要占主区(限宽 40%)；非聚光灯下标题填满、把短摘要推到右侧 */}
                          <span
                            className={cn(
                              'truncate font-medium',
                              spot ? 'max-w-[40%] shrink-0' : 'min-w-0 flex-1'
                            )}
                          >
                            {highlightAll(item.title, kw)}
                          </span>
                          {/* 摘要 */}
                          {item.subtitle &&
                            (spot ? (
                              // 聚光灯：before 右端实/左端渐隐，match 居中加粗，after 左端实/右端渐隐
                              <span className="flex min-w-0 flex-1 items-baseline overflow-hidden text-xs text-muted-foreground">
                                <span
                                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-right"
                                  style={{
                                    maskImage:
                                      'linear-gradient(to right, transparent, black 60%)',
                                    WebkitMaskImage:
                                      'linear-gradient(to right, transparent, black 60%)',
                                  }}
                                >
                                  {spot.before}
                                </span>
                                <span className="shrink-0 px-1 font-semibold text-foreground">
                                  {spot.match}
                                </span>
                                <span
                                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left"
                                  style={{
                                    maskImage:
                                      'linear-gradient(to left, transparent, black 60%)',
                                    WebkitMaskImage:
                                      'linear-gradient(to left, transparent, black 60%)',
                                  }}
                                >
                                  {spot.after}
                                </span>
                              </span>
                            ) : (
                              // 短摘要：右对齐贴边摆放，关键词加粗
                              <span className="ml-auto max-w-[55%] shrink-0 truncate text-right text-xs text-muted-foreground">
                                {highlightAll(item.subtitle, kw)}
                              </span>
                            ))}
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                ))}
              </Command.List>
            )}
          </Command>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
