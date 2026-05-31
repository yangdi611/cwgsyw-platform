'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

interface ProcessDef {
  id: string;
  name: string;
  key: string;
  version: number;
  description: string;
  category: string;
  suspended: boolean;
  deployment_time: string;
}

export default function WorkflowAdminPage() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canConfigure = hasPermission('workflow', 'configure');
  const [deleteTarget, setDeleteTarget] = useState<ProcessDef | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['process-definitions', page],
    queryFn: () => api.get('/workflow/definitions', { params: { page, size: 20 } }).then(r => ({
      records: (r.data.data?.records ?? []) as ProcessDef[],
      total: r.data.data?.total ?? 0,
    })),
  });

  const definitions = data?.records ?? [];
  const totalPages = data?.total ? Math.ceil(data.total / 20) : 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/workflow/definitions/${deleteTarget.id}`);
      toast.success(`流程 "${deleteTarget.name}" 已删除`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">流程管理</h1>
          <p className="text-sm text-muted-foreground">管理 BPMN 流程定义，创建和编辑审批流程</p>
        </div>
        {canConfigure && (
          <Link href="/workflow/design">
            <Button>+ 新建流程</Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : definitions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">暂无流程定义</p>
          <p className="text-sm text-muted-foreground mb-4">
            创建第一个 BPMN 流程定义来开始使用流程引擎
          </p>
          {canConfigure && (
            <Link href="/workflow/design">
              <Button>+ 新建流程</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">流程名称</th>
                  <th className="text-left p-3 text-sm font-medium">Key</th>
                  <th className="text-left p-3 text-sm font-medium">版本</th>
                  <th className="text-left p-3 text-sm font-medium">分类</th>
                  <th className="text-left p-3 text-sm font-medium">状态</th>
                  {canConfigure && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => (
                  <tr key={def.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">{def.name}</td>
                    <td className="p-3 text-sm text-muted-foreground font-mono">{def.key}</td>
                    <td className="p-3 text-sm">v{def.version}</td>
                    <td className="p-3 text-sm">{def.category || '-'}</td>
                    <td className="p-3">
                      <Badge variant={def.suspended ? 'destructive' : 'default'}>
                        {def.suspended ? '已挂起' : '启用'}
                      </Badge>
                    </td>
                    {canConfigure && (
                      <td className="p-3 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/workflow/design/${def.id}`)}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(def)}>
                          删除
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>共 {data?.total ?? 0} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                <span className="px-3 py-1">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除流程 <strong>{deleteTarget?.name}</strong> (v{deleteTarget?.version}) 吗？
            此操作不可撤销，将删除所有关联的运行时数据和历史记录。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
