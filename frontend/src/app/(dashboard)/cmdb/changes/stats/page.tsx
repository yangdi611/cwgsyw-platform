'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ActionCountVO {
  created: number
  updated: number
  deleted: number
  total: number
}

interface DailyCountVO {
  date: string
  created: number
  updated: number
  deleted: number
}

interface TopInstanceVO {
  instanceId: number
  instanceName: string
  modelId: string
  modelName: string
  changeCount: number
}

interface ChangeStatsVO {
  today: ActionCountVO
  thisWeek: ActionCountVO
  thisMonth: ActionCountVO
  dailyBreakdown: DailyCountVO[]
  top10Instances: TopInstanceVO[]
}

function ActionCountCard({
  title,
  data,
  loading,
}: {
  title: string
  data?: ActionCountVO
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : data ? (
          <>
            <div className="text-3xl font-bold">{data.total}</div>
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                新增 {data.created}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                修改 {data.updated}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                删除 {data.deleted}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

function DailyBarChart({ data }: { data: DailyCountVO[] }) {
  if (!data || data.length === 0) return null

  const maxVal = Math.max(...data.map((d) => Math.max(d.created, d.updated, d.deleted, 1)))

  return (
    <div className="space-y-1">
      {data.map((day) => {
        const hCreated = (day.created / maxVal) * 100
        const hUpdated = (day.updated / maxVal) * 100
        const hDeleted = (day.deleted / maxVal) * 100
        return (
          <div key={day.date} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 text-right text-muted-foreground">
              {day.date.slice(5)}
            </span>
            <div className="flex h-5 flex-1 items-end gap-px">
              <div
                className="rounded-t bg-green-500 transition-all"
                style={{ width: `${hCreated}%`, height: '100%' }}
                title={`新增 ${day.created}`}
              />
              <div
                className="rounded-t bg-blue-500 transition-all"
                style={{ width: `${hUpdated}%`, height: '100%' }}
                title={`修改 ${day.updated}`}
              />
              <div
                className="rounded-t bg-red-500 transition-all"
                style={{ width: `${hDeleted}%`, height: '100%' }}
                title={`删除 ${day.deleted}`}
              />
            </div>
            <span className="w-10 text-muted-foreground">{day.created + day.updated + day.deleted}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function CmdbChangesStatsPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!hasPermission('cmdb_change', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: stats, isLoading } = useQuery<ChangeStatsVO>({
    queryKey: ['cmdb-changes-stats'],
    queryFn: () => api.get('/cmdb/changes/stats').then((r) => r.data.data),
    enabled: hasPermission('cmdb_change', 'read'),
  })

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">CMDB 变更统计</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CI 实例变更历史统计与趋势分析
        </p>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <ActionCountCard title="今日变更" data={stats?.today} loading={isLoading} />
        <ActionCountCard title="本周变更" data={stats?.thisWeek} loading={isLoading} />
        <ActionCountCard title="本月变更" data={stats?.thisMonth} loading={isLoading} />
      </div>

      {/* 每日趋势 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">每日变更趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : stats?.dailyBreakdown && stats.dailyBreakdown.length > 0 ? (
            <div>
              <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-green-500" />
                  新增
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-blue-500" />
                  修改
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-red-500" />
                  删除
                </span>
              </div>
              <DailyBarChart data={stats.dailyBreakdown} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无每日变更数据</p>
          )}
        </CardContent>
      </Card>

      {/* Top10 实例 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">变更最频繁的实例 (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : stats?.top10Instances && stats.top10Instances.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>实例名称</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead className="text-right">变更次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top10Instances.map((inst, idx) => (
                  <TableRow key={inst.instanceId}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{inst.instanceName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inst.modelName}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{inst.changeCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">暂无实例变更统计</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
