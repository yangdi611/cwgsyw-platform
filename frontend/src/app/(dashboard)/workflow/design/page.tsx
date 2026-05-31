'use client';

import { useState } from 'react';
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

export default function NewWorkflowDesignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [xml, setXml] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !key) { toast.error('请填写流程名称和 Key'); return; }
    if (!xml) { toast.error('请设计流程画布内容'); return; }
    setSaving(true);
    try {
      await api.post('/workflow/definitions', { name, key, category, description, xml });
      toast.success('流程定义已保存');
      router.push('/workflow/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '保存失败');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">设计新流程</h1>
      <p className="text-sm text-muted-foreground mb-6">使用可视化编辑器设计 BPMN 2.0 流程，支持拖拽节点和连线</p>
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="flowName">流程名称 *</Label>
          <Input id="flowName" value={name} onChange={e => setName(e.target.value)} placeholder="如: 变更审批流" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flowKey">流程 Key *</Label>
          <Input id="flowKey" value={key} onChange={e => setKey(e.target.value)} placeholder="如: changeDocApproval" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="如: 审批" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">描述</Label>
          <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="用途" />
        </div>
      </div>
      <div className="mb-4">
        <BpmnEditor onChange={setXml} />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? '部署中...' : '保存并部署'}</Button>
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
      </div>
    </div>
  );
}
