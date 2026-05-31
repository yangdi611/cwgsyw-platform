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
    <div className="h-[600px] border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground">
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
      <p className="text-sm text-muted-foreground mb-4">
        拖拽左侧元素到画布中设计流程。选中节点后在右侧属性面板配置审批人和条件。
      </p>

      <div className="grid grid-cols-4 gap-4 mb-4">
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
          <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="审批流程" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">描述</Label>
          <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="流程用途说明" />
        </div>
      </div>

      <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-medium mb-1">📝 配置指南：让审批人出现</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>从左侧拖一个 <b>User Task（用户任务）</b> 到画布，放在 Start 和 End 之间</li>
          <li><b>选中</b> 那个 User Task → 右侧属性面板出现</li>
          <li>在 <b>General</b> 的 Name 填"组长审批"</li>
          <li>在 <b>Assignment</b> 的 <b>Candidate groups</b> 填 <code>${"${groupId}"}</code> — 这样会自动匹配组</li>
          <li>在排他网关的 <b>Condition</b> 填 <code>${"${approved == true}"}</code>（通过）和 <code>${"${approved == false}"}</code>（拒绝）</li>
        </ol>
        <p className="mt-1 text-xs text-blue-500">
          💡 多级审批 = 多个 User Task + 多个网关串联。属性面板是右侧的灰色区域，点击画布上的节点后会出现。
        </p>
      </div>

      <div className="mb-4">
        <BpmnEditor onChange={setXml} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '部署中...' : '保存并部署'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
      </div>
    </div>
  );
}
