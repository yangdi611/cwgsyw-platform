'use client';

import { Fragment, useState } from 'react';
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
import { ChevronDown, CheckCircle, Circle, Pencil } from 'lucide-react';

interface ProcessDef {
  id: string;
  name: string;
  key: string;
  version: number;
  description: string;
  category: string;
  suspended: boolean;
  deployment_time: string;
  activeVersion?: number | null;
}

export default function WorkflowAdminPage() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canConfigure = hasPermission('workflow', 'configure');
  const [deleteTarget, setDeleteTarget] = useState<ProcessDef | null>(null);
  const [versionDef, setVersionDef] = useState<ProcessDef | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<{ version: any; def: ProcessDef } | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProcessDef | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameKey, setRenameKey] = useState('');
  const [renaming, setRenaming] = useState(false);

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

  const handleVersions = async (def: ProcessDef) => {
    // Toggle: if clicking the same def, collapse it
    if (versionDef?.id === def.id) {
      setVersionDef(null);
      setVersions([]);
      return;
    }
    setVersionDef(def);
    try {
      const r = await api.get(`/workflow/definitions/key/${def.key}/versions`);
      setVersions(r.data.data ?? []);
    } catch {
      toast.error('获取版本历史失败');
    }
  };

  const handleActivate = async (v: any, def: ProcessDef) => {
    setActivating(v.id);
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/activate`);
      toast.success(`v${v.version} 已启用`);
      // Refresh both version list and main list
      handleVersions(def);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '启用失败');
    } finally {
      setActivating(null);
    }
  };

  const handleSuspend = async (v: any, def: ProcessDef) => {
    setSuspending(v.id);
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/suspend`);
      toast.success(`v${v.version} 已禁用`);
      handleVersions(def);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '禁用失败');
    } finally {
      setSuspending(null);
    }
  };

  const openRename = (def: ProcessDef) => {
    setRenameTarget(def);
    setRenameName(def.name);
    setRenameKey(def.key);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    if (!renameName.trim()) { toast.error('请输入流程名称'); return; }
    if (!renameKey.trim()) { toast.error('请输入流程 Key'); return; }
    setRenaming(true);
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(renameTarget.id)}/rename`, {
        name: renameName.trim(),
        key: renameKey.trim(),
      });
      toast.success('流程信息已更新');
      setRenameTarget(null);
      refetch();
      if (versionDef?.id === renameTarget.id) {
        handleVersions(renameTarget);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || '更新失败');
    } finally {
      setRenaming(false);
    }
  };

  // Use the activeVersion field from the backend which correctly reports
  // which version is active even when it's not the latest.
  const getActiveVersionInfo = (def: ProcessDef) => {
    if (def.activeVersion != null) {
      return { version: def.activeVersion, active: true };
    }
    return { version: def.version, active: false };
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
                  <th className="text-left p-3 text-sm font-medium">最新版本</th>
                  <th className="text-left p-3 text-sm font-medium">分类</th>
                  <th className="text-left p-3 text-sm font-medium">激活版本</th>
                  {canConfigure && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => {
                  const isExpanded = versionDef?.id === def.id;
                  const versionInfo = getActiveVersionInfo(def);
                  return (
                    <Fragment key={def.id}>
                      <tr className={`border-b hover:bg-muted/30 ${isExpanded ? 'bg-muted/10' : ''}`}>
                        <td className="p-3 text-sm font-medium">{def.name}</td>
                        <td className="p-3 text-sm text-muted-foreground font-mono">{def.key}</td>
                        <td className="p-3 text-sm">v{def.version}</td>
                        <td className="p-3 text-sm">{def.category || '-'}</td>
                        <td className="p-3">
                          {versionInfo.active ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              v{versionInfo.version}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">--</span>
                          )}
                        </td>
                        {canConfigure && (
                          <td className="p-3 text-right space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => openRename(def)}>
                              <Pencil className="h-3 w-3 mr-1" />
                              编辑
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleVersions(def)}>
                              版本
                              <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(def)}>
                              删除
                            </Button>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="border-b">
                          <td colSpan={canConfigure ? 6 : 5} className="p-0">
                            <div className="bg-muted/10 px-6 py-4">
                              <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b bg-muted/30">
                                      <th className="text-left p-3 text-sm font-medium">版本</th>
                                      <th className="text-left p-3 text-sm font-medium">名称</th>
                                      <th className="text-left p-3 text-sm font-medium">部署时间</th>
                                      <th className="text-left p-3 text-sm font-medium">启用状态</th>
                                      {canConfigure && (
                                        <th className="text-right p-3 text-sm font-medium">操作</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {versions.length === 0 ? (
                                      <tr><td colSpan={canConfigure ? 5 : 4} className="p-3 text-sm text-muted-foreground text-center">暂无版本数据</td></tr>
                                    ) : versions.map((v: any) => (
                                      <tr key={v.id} className="border-b last:border-0">
                                        <td className="p-3 text-sm font-mono">v{v.version}</td>
                                        <td className="p-3 text-sm">{v.name}</td>
                                        <td className="p-3 text-sm text-muted-foreground">
                                          {v.deployment_time ? new Date(v.deployment_time).toLocaleString('zh-CN') : '-'}
                                        </td>
                                        <td className="p-3">
                                          {!v.suspended ? (
                                            <Badge variant="default" className="gap-1">
                                              <CheckCircle className="h-3 w-3" />
                                              已启用
                                            </Badge>
                                          ) : (
                                            <span className="text-sm text-muted-foreground">--</span>
                                          )}
                                        </td>
                                        {canConfigure && (
                                          <td className="p-3 text-right space-x-1">
                                            {v.suspended ? (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-green-600"
                                                disabled={activating === v.id}
                                                onClick={() => handleActivate(v, def)}
                                              >
                                                {activating === v.id ? '启用中...' : '启用'}
                                              </Button>
                                            ) : (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-orange-500"
                                                disabled={suspending === v.id}
                                                onClick={() => handleSuspend(v, def)}
                                              >
                                                {suspending === v.id ? '禁用中...' : '禁用'}
                                              </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/workflow/design/${def.key}?version=${v.id}`)}>编辑</Button>
                                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteVersionTarget({ version: v, def })}>
                                              删除
                                            </Button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

      {/* Delete process dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除流程 <strong>{deleteTarget?.name}</strong> 及其所有版本吗？
            此操作不可撤销，将删除所有关联的运行时数据和历史记录。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete version dialog */}
      <Dialog open={!!deleteVersionTarget} onOpenChange={(o) => { if (!o) setDeleteVersionTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除版本</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除 <strong>{deleteVersionTarget?.def.name}</strong> 的
            <strong> v{deleteVersionTarget?.version.version}</strong> 吗？
          </p>
          <p className="text-xs text-destructive">此操作将级联删除该版本下所有运行中和历史的流程实例，不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteVersionTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={async () => {
              if (!deleteVersionTarget) return;
              try {
                await api.post(`/workflow/definitions/delete-version`, { definition_id: deleteVersionTarget.version.id });
                toast.success(`v${deleteVersionTarget.version.version} 已删除`);
                setDeleteVersionTarget(null);
                refetch();
                if (versionDef?.key === deleteVersionTarget.def.key) {
                  handleVersions(deleteVersionTarget.def);
                }
              } catch (err: any) {
                toast.error(err.response?.data?.message || '删除失败');
                setDeleteVersionTarget(null);
              }
            }}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) setRenameTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑流程信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename-name">流程名称</Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="输入流程名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-key">流程 Key</Label>
              <Input
                id="rename-key"
                value={renameKey}
                onChange={(e) => setRenameKey(e.target.value)}
                placeholder="输入流程 Key（英文标识）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>取消</Button>
            <Button disabled={renaming} onClick={handleRename}>
              {renaming ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
