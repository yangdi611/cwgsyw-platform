'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface ProcessStat {
  process_definition_key: string;
  name: string;
  version: number;
  total_started: number;
  running_count: number;
  finished_count: number;
  success_rate: number;
  avg_duration_seconds: number;
}

export default function WorkflowStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['process-stats'],
    queryFn: () => api.get('/workflow/stats').then(r => (r.data.data ?? []) as ProcessStat[]),
  });

  const stats = data ?? [];

  const formatDuration = (sec: number) => {
    if (sec <= 0) return '-';
    if (sec < 60) return `${sec} 秒`;
    if (sec < 3600) return `${Math.round(sec / 60)} 分钟`;
    return `${(sec / 3600).toFixed(1)} 小时`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">流程统计</h1>
      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : stats.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">暂无流程统计数据</p>
          <p className="text-sm text-muted-foreground mt-1">启动流程实例后即可查看统计</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {stats.map(s => (
            <div key={s.process_definition_key} className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{s.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono">{s.process_definition_key} · v{s.version}</p>
                </div>
                <Badge variant={s.success_rate >= 90 ? 'default' : s.success_rate >= 50 ? 'secondary' : 'destructive'}>
                  {s.success_rate}% 通过率
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{s.total_started}</div>
                  <div className="text-xs text-muted-foreground">总实例数</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-500">{s.running_count}</div>
                  <div className="text-xs text-muted-foreground">运行中</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-500">{s.finished_count}</div>
                  <div className="text-xs text-muted-foreground">已完成</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{formatDuration(s.avg_duration_seconds)}</div>
                  <div className="text-xs text-muted-foreground">平均审批时长</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
