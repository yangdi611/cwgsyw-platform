'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [versionDef, setVersionDef] = useState<ProcessDef | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [startTarget, setStartTarget] = useState<ProcessDef | null>(null);
  const [startBizKey, setStartBizKey] = useState('');
  const [starting, setStarting] = useState(false);

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
      await api.delete(`/workflow/definitions/${encodeURIComponent(deleteTarget.id)}`);
      toast.success(`流程 "${deleteTarget.name}" 已删除`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
      setDeleteTarget(null);
    }
  };

  const handleStart = async () => {
    if (!startTarget) return;
    if (!startBizKey.trim()) { toast.error('请输入业务标识'); return; }
    setStarting(true);
    try {
      const r = await api.post('/workflow/instances', {
        process_definition_key: startTarget.key,
        business_key: startBizKey.trim(),
        variables: {},
      });
      toast.success(`流程已启动 — 实例: ${r.data.data.id.substring(0, 8)}...`);
      setStartTarget(null);
      setStartBizKey('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '启动失败');
    } finally { setStarting(false); }
  };

  const handleVersions = async (def: ProcessDef) => {
    setVersionDef(def);
    try {
      const r = await api.get(`/workflow/definitions/key/${def.key}/versions`);
      setVersions(r.data.data ?? []);
    } catch {
      toast.error('获取版本历史失败');
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
                        <Button variant="ghost" size="sm" className="text-green-600" onClick={() => { setStartTarget(def); setStartBizKey(''); }}>启动</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleVersions(def)}>版本</Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/workflow/design/${encodeURIComponent(def.key)}`)}>
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

      {versionDef && (
        <div className="border rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{versionDef.name} — 版本历史</h2>
            <Button variant="ghost" size="sm" onClick={() => { setVersionDef(null); setVersions([]); }}>关闭</Button>
          </div>
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无版本数据</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">版本</th>
                    <th className="text-left p-3 text-sm font-medium">名称</th>
                    <th className="text-left p-3 text-sm font-medium">状态</th>
                    <th className="text-left p-3 text-sm font-medium">部署时间</th>
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="p-3 text-sm font-mono">v{v.version}</td>
                      <td className="p-3 text-sm">{v.name}</td>
                      <td className="p-3">
                        <Badge variant={v.suspended ? 'destructive' : 'default'}>
                          {v.suspended ? '已挂起' : '启用'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {v.deployment_time ? new Date(v.deployment_time).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {v.suspended && (
                          <Button variant="ghost" size="sm" className="text-green-600" onClick={async () => {
                            try {
                              await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/activate`);
                              toast.success(`v${v.version} 已激活`);
                              handleVersions(versionDef!);
                            } catch { toast.error('激活失败'); }
                          }}>激活</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/workflow/design/${versionDef!.key}?version=${v.id}`)}>编辑</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Start process dialog */}
      <Dialog open={!!startTarget} onOpenChange={(o) => { if (!o) { setStartTarget(null); setStartBizKey(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>启动流程: {startTarget?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Key: <code className="font-mono">{startTarget?.key}</code> · v{startTarget?.version}
          </p>
          <div className="space-y-2">
            <Label htmlFor="bizKey">业务标识 *</Label>
            <Input
              id="bizKey"
              value={startBizKey}
              onChange={e => setStartBizKey(e.target.value)}
              placeholder="如: 日报:42、变更:审批001"
            />
            <p className="text-xs text-muted-foreground">
              用于标识流程实例关联的业务对象，方便在流程实例列表中追踪
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStartTarget(null); setStartBizKey(''); }}>取消</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleStart} disabled={starting}>
              {starting ? '启动中...' : '启动流程'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
