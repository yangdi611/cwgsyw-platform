'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/v2/Input';
import { Label } from '@/components/v2/Label';
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
    // Replace the process id in the XML with the user's key — Flowable
    // derives the definition key from <process id="...">, not from the API field.
    const finalXml = xml.replace(/<bpmn:process id="[^"]*"/, `<bpmn:process id="${key}"`);
    setSaving(true);
    try {
      await api.post('/workflow/definitions', { name, key, category, description, xml: finalXml });
      toast.success('流程定义已保存');
      router.push('/workflow/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '保存失败');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-v2-fg mb-2">设计新流程</h1>
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
          <li><b>点击箭头线</b>（不是 Gateway 菱形）→ 右侧出现 <b>Condition</b> 输入框</li>
          <li>上面箭头填已填入通过条件，下面箭头已填入拒绝条件</li>
          <li>选中 <b>User Task</b> → 下方 <b>Flowable Assignment</b> 面板配置审批人</li>
        </ol>
        <p className="mt-1 text-xs text-blue-500">
          💡 Condition 在连接线上，不在网关上。多级审批 = 多个 User Task + 多个网关串联。
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
