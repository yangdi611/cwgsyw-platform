'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Link from 'next/link';

interface TaskVO {
  task_id: string;
  process_instance_id: string;
  task_name: string;
  business_type: string;
  business_id: number;
  business_key: string;
  create_time: string;
  assignee: string | null;
}

const businessTypeLabels: Record<string, string> = {
  daily_report: '日报审批',
  change_doc: '变更文档审批',
  device: '设备权限申请',
};

interface ApprovalState {
  taskId: string;
  approved: boolean;
  comment: string;
}

export default function WorkflowTasksPage() {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [approvalStates, setApprovalStates] = useState<Record<string, ApprovalState>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workflow-tasks'],
    queryFn: () => api.get('/workflow/tasks/group').then(r => r.data.data as TaskVO[]),
  });

  const getApprovalState = (taskId: string): ApprovalState => {
    return approvalStates[taskId] || { taskId, approved: false, comment: '' };
  };

  const updateApprovalState = (taskId: string, update: Partial<ApprovalState>) => {
    setApprovalStates(prev => ({
      ...prev,
      [taskId]: { ...getApprovalState(taskId), ...update },
    }));
  };

  const handleApprove = async (taskId: string, approved: boolean) => {
    const state = getApprovalState(taskId);
    try {
      await api.post('/workflow/approve', {
        task_id: taskId,
        approved,
        comment: state.comment || undefined,
      });
      toast.success(approved ? '已通过' : '已拒绝');
      setExpandedTask(null);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败');
    }
  };

  const renderBusinessLink = (task: TaskVO) => {
    // Map business_type to a link if we know the pattern
    if (task.business_type === 'daily_report' && task.business_id) {
      return <Link href={`/daily/${task.business_id}`} className="text-sm text-primary hover:underline px-2 py-1">查看日报</Link>;
    }
    // Generic fallback — show business key info
    if (task.business_key) {
      return <span className="text-xs text-muted-foreground">{task.business_key}</span>;
    }
    return null;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">待审批任务</h1>
      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="space-y-3">
          {(data ?? []).map(task => {
            const state = getApprovalState(task.task_id);
            const isExpanded = expandedTask === task.task_id;

            return (
              <div key={task.task_id} className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.task_name}</span>
                      <Badge variant="outline">
                        {(businessTypeLabels[task.business_type] ?? task.business_type) || '审批'}
                      </Badge>
                      {task.assignee && (
                        <Badge variant="secondary" className="text-xs">已认领</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(task.create_time).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {renderBusinessLink(task)}
                    <Button variant="outline" size="sm"
                      onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}>
                      {isExpanded ? '收起' : '审批'}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">审批意见（可选）</label>
                      <Textarea
                        rows={2}
                        value={state.comment}
                        onChange={e => updateApprovalState(task.task_id, { comment: e.target.value })}
                        placeholder="填写审批意见..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() => handleApprove(task.task_id, true)}
                      >
                        通过
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleApprove(task.task_id, false)}
                      >
                        拒绝
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground text-center py-12">暂无待审批任务</p>
          )}
        </div>
      )}
    </div>
  );
}
