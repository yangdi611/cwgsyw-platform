'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Box, MoreVertical, Settings, PencilLine, FolderInput, Check, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { GROUP_ICONS, getModelDisplayName } from './utils'

interface ModelCardProps {
  model: CiModelAdminItem
  groups: { code: string; name: string }[]
  canWrite: boolean
  canCreate: boolean
  canDelete: boolean
  deleting: boolean
  justMoved: boolean
  onMove: (toCode: string) => void
  onRename: () => void
  onCopy: () => void
  onDelete: () => void
}

export function ModelCard({
  model,
  groups,
  canWrite,
  canCreate,
  canDelete,
  deleting,
  justMoved,
  onMove,
  onRename,
  onCopy,
  onDelete,
}: ModelCardProps) {
  const Icon = model.icon ? GROUP_ICONS[model.icon] : Box
  const router = useRouter()
  const canRename = canWrite && !model.isBuiltIn
  const canCopy = canCreate && !model.isBuiltIn
  const canShowMenu = canWrite || canCopy || (canDelete && !model.isBuiltIn)
  const displayName = getModelDisplayName(model)

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-all',
        justMoved
          ? 'border-primary ring-2 ring-primary/30 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95'
          : 'hover:bg-muted/50',
      )}
    >
      <Link href={`/cmdb/admin/models/${model.modelId}`} className="block p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{displayName}</span>
              {model.isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{model.modelId}</p>
          </div>
          {/* 给菜单按钮留出空位，避免与图标重叠 */}
          <span className="h-7 w-7 shrink-0" aria-hidden />
        </div>
      </Link>
      {canShowMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${displayName} 操作`}
            className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {canWrite && (
              <>
                <DropdownMenuItem onClick={() => router.push(`/cmdb/admin/models/${model.modelId}`)}>
                  <Settings className="mr-2 h-4 w-4" />打开设置
                </DropdownMenuItem>
                {canRename && (
                  <DropdownMenuItem onClick={onRename}>
                    <PencilLine className="mr-2 h-4 w-4" />重命名
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="mr-2 h-4 w-4" />移动到分类
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 w-48 overflow-y-auto">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">选择目标分类</DropdownMenuLabel>
                      {groups.map(g => {
                        const current = g.code === model.group
                        return (
                          <DropdownMenuItem
                            key={g.code}
                            disabled={current}
                            onClick={() => { if (!current) onMove(g.code) }}
                          >
                            <span className="flex-1 truncate">{g.name}</span>
                            {current && <Check className="ml-2 h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            {canCopy && (
              <>
                {canWrite && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={onCopy}>
                  <Copy className="mr-2 h-4 w-4" />复制模型
                </DropdownMenuItem>
              </>
            )}
            {canDelete && !model.isBuiltIn && (
              <>
                {(canWrite || canCopy) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  disabled={deleting}
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (window.confirm(`确认删除模型「${displayName}」？删除后该模型的属性定义也会被删除。`)) onDelete()
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />删除模型
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
