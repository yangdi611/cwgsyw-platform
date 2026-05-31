'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const BpmnViewer = dynamic(() => import('@/components/workflow/BpmnViewer'), {
  ssr: false,
  loading: () => <div className="min-h-[300px] border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground">加载流程图...</div>,
});

interface InstanceVO {
  id: string;
  process_definition_name: string;
  process_definition_key: string;
  business_key: string;
  start_time: string;
  end_time: string | null;
  ended: boolean;
  suspended: boolean;
}

interface ActivityVO {
  activity_id: string;
  activity_name: string;
  activity_type: string;
  start_time: string;
  end_time: string | null;
  assignee: string;
}

export default function InstancesPage() {
  const { hasPermission } = usePermission();
  const canConfigure = hasPermission('workflow', 'configure');
  const [tab, setTab] = useState<'running' | 'finished'>('running');
  const [page, setPage] = useState(1);
  const [selectedInstance, setSelectedInstance] = useState<InstanceVO | null>(null);
  const [activities, setActivities] = useState<ActivityVO[]>([]);
  const [viewerXml, setViewerXml] = useState('');

  const queryKey = tab === 'running' ? 'instances-running' : 'instances-finished';
  const endpoint = tab === 'running' ? '/workflow/instances/running' : '/workflow/instances/finished';

  const { data, isLoading, refetch } = useQuery({
    queryKey: [queryKey, page],
    queryFn: () => api.get(endpoint, { params: { page, size: 20 } }).then(r => ({
      records: (r.data.data?.records ?? []) as InstanceVO[],
      total: r.data.data?.total ?? 0,
    })),
  });

  const instances = data?.records ?? [];
  const totalPages = data?.total ? Math.ceil(data.total / 20) : 0;

  const handleView = async (inst: InstanceVO) => {
    setSelectedInstance(inst);
    try {
      const [detailRes, activityRes] = await Promise.all([
        // Get the process definition XML for the viewer
        api.get('/workflow/definitions').then(r => {
          const defs = r.data.data?.records ?? [];
          const match = defs.find((d: any) => d.key === inst.process_definition_key);
          if (match) return api.get(`/workflow/definitions/${match.id}`);
          return null;
        }),
        api.get(`/workflow/instances/${inst.id}/activities`),
      ]);
      if (detailRes) setViewerXml(detailRes.data.data?.xml ?? '');
      setActivities((activityRes.data.data ?? []) as ActivityVO[]);
    } catch {
      toast.error('获取流程详情失败');
    }
  };

  const handleSuspend = async (id: string) => {
    try { await api.put(`/workflow/instances/${id}/suspend`); toast.success('已挂起'); refetch(); }
    catch { toast.error('操作失败'); }
  };

  const handleActivate = async (id: string) => {
    try { await api.put(`/workflow/instances/${id}/activate`); toast.success('已激活'); refetch(); }
    catch { toast.error('操作失败'); }
  };

  const handleTerminate = async (id: string) => {
    if (!confirm('确定要终止此流程实例吗？')) return;
    try { await api.delete(`/workflow/instances/${id}`); toast.success('已终止'); refetch(); }
    catch { toast.error('操作失败'); }
  };

  const completedIds = activities.filter(a => a.end_time).map(a => a.activity_id);
  const currentIds = activities.filter(a => !a.end_time).map(a => a.activity_id);

  const formatDate = (s: string) => new Date(s).toLocaleString('zh-CN');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">流程实例</h1>
      <p className="text-sm text-muted-foreground mb-6">查看和管理运行中的流程实例和已完成的历史记录</p>

      <div className="flex gap-2 mb-6">
        <Button variant={tab === 'running' ? 'default' : 'outline'} size="sm" onClick={() => { setTab('running'); setPage(1); }}>
          运行中
        </Button>
        <Button variant={tab === 'finished' ? 'default' : 'outline'} size="sm" onClick={() => { setTab('finished'); setPage(1); }}>
          已完成
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : instances.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {tab === 'running' ? '暂无运行中的流程实例' : '暂无已完成的流程实例'}
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-sm font-medium">流程名称</th>
                <th className="text-left p-3 text-sm font-medium">业务标识</th>
                <th className="text-left p-3 text-sm font-medium">开始时间</th>
                {tab === 'finished' && <th className="text-left p-3 text-sm font-medium">结束时间</th>}
                <th className="text-left p-3 text-sm font-medium">状态</th>
                <th className="text-right p-3 text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr key={inst.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-sm font-medium">{inst.process_definition_name}</td>
                  <td className="p-3 text-sm text-muted-foreground font-mono text-xs">{inst.business_key || '-'}</td>
                  <td className="p-3 text-sm">{formatDate(inst.start_time)}</td>
                  {tab === 'finished' && <td className="p-3 text-sm">{inst.end_time ? formatDate(inst.end_time) : '-'}</td>}
                  <td className="p-3">
                    {inst.suspended ? (
                      <Badge variant="secondary">已挂起</Badge>
                    ) : inst.ended ? (
                      <Badge variant="outline">已完成</Badge>
                    ) : (
                      <Badge variant="default">运行中</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleView(inst)}>查看</Button>
                    {canConfigure && !inst.ended && (
                      <>
                        {inst.suspended ? (
                          <Button variant="ghost" size="sm" onClick={() => handleActivate(inst.id)}>激活</Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleSuspend(inst.id)}>挂起</Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleTerminate(inst.id)}>终止</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <span>{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      )}

      {/* Detail Panel */}
      {selectedInstance && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold">{selectedInstance.process_definition_name}</h2>
              <p className="text-sm text-muted-foreground">Business Key: {selectedInstance.business_key || '-'} | ID: {selectedInstance.id}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedInstance(null); setViewerXml(''); setActivities([]); }}>关闭</Button>
          </div>

          {viewerXml ? (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">流程进度</p>
              <BpmnViewer xml={viewerXml} completedActivities={completedIds} currentActivities={currentIds} />
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> 已完成</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> 当前</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm mb-4">暂无流程图数据</p>
          )}

          {activities.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">活动历史</p>
              <div className="space-y-1">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                    <Badge variant={a.end_time ? 'outline' : 'default'} className="text-xs">
                      {a.end_time ? '已完成' : '进行中'}
                    </Badge>
                    <span>{a.activity_name}</span>
                    {a.assignee && <span className="text-muted-foreground text-xs ml-auto">负责人: {a.assignee}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
