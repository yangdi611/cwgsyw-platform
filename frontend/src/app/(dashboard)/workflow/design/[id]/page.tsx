'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const BpmnEditor = dynamic(() => import('@/components/workflow/BpmnEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground">
      加载编辑器...
    </div>
  ),
});

interface DefDetail {
  id: string;
  name: string;
  key: string;
  category: string;
  description: string;
  version: number;
  xml: string;
}

export default function EditWorkflowDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<DefDetail | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [xml, setXml] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/workflow/definitions/${encodeURIComponent(id)}`).then(r => {
      const d: DefDetail = r.data.data;
      setDetail(d);
      setName(d.name);
      setCategory(d.category || '');
      setDescription(d.description || '');
      setXml(d.xml);
      setLoading(false);
    }).catch(() => {
      toast.error('获取流程定义失败');
      router.push('/workflow/admin');
    });
  }, [id, router]);

  const handleSave = async () => {
    if (!name) { toast.error('请填写流程名称'); return; }
    if (!xml) { toast.error('流程画布不能为空'); return; }
    setSaving(true);
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(id)}`, {
        name,
        key: detail?.key,
        category,
        description,
        xml,
      });
      toast.success(`流程定义已更新 (v${(detail?.version ?? 0) + 1})`);
      router.push('/workflow/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '更新失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">加载中...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">编辑流程: {name}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        当前版本: v{detail?.version} | 修改后将创建新版本
      </p>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="flowName">流程名称 *</Label>
          <Input id="flowName" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flowKey">流程 Key</Label>
          <Input id="flowKey" value={detail?.key} disabled />
          <p className="text-xs text-muted-foreground">Key 不可修改</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Input id="category" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">描述</Label>
          <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <BpmnEditor initialXml={xml} onChange={setXml} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '部署中...' : '保存新版本'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
      </div>
    </div>
  );
}
