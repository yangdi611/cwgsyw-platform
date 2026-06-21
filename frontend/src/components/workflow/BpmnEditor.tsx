'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import { EMPTY_BPMN } from '@/lib/bpmn';
import { flowableModdleDescriptor } from '@/lib/FlowableProps';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';

interface BpmnEditorProps {
  initialXml?: string;
  onChange?: (xml: string) => void;
}

export default function BpmnEditor({ initialXml, onChange }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Flowable fields state — managed by DOM directly, React just hides/shows
  const [flowableFields, setFlowableFields] = useState<Array<{
    key: string; label: string; value: string;
    setValue: (v: string) => void;
  }> | null>(null);

  // Sequence flow condition editing
  const [seqFlow, setSeqFlow] = useState<{ name: string; condition: string; setCondition: (v: string) => void } | null>(null);

  const renderSelectionFields = useCallback((element: any) => {
    const bo = element?.businessObject;
    if (!bo) { setFlowableFields(null); setSeqFlow(null); return; }

    // UserTask → Flowable Assignment
    if (bo.$type === 'bpmn:UserTask') {
      setSeqFlow(null);
      renderFlowFields(element);
      return;
    }

    // SequenceFlow → Condition
    if (bo.$type === 'bpmn:SequenceFlow') {
      setFlowableFields(null);
      const condExp = bo.get('conditionExpression');
      const cond = condExp?.get('body') || '';
      const bpmnFactory = modelerRef.current?.get('bpmnFactory');
      const modeling = modelerRef.current?.get('modeling');
      setSeqFlow({
        name: bo.get('name') || '',
        condition: cond,
        setCondition: (v: string) => {
          if (!bpmnFactory || !modeling) return;
          if (!v) {
            modeling.updateModdleProperties(element, bo, { conditionExpression: undefined });
          } else {
            const newCond = bpmnFactory.create('bpmn:FormalExpression', { body: v });
            modeling.updateModdleProperties(element, bo, { conditionExpression: newCond });
          }
        }
      });
      return;
    }

    setFlowableFields(null);
    setSeqFlow(null);
  }, []);

  const renderFlowFields = useCallback((element: any) => {
    const bo = element?.businessObject;

    // Read/write extension elements
    const extVal = (name: string): string => {
      const ee = bo.get('extensionElements');
      if (!ee) return '';
      const vals: any[] = ee.get('values') || [];
      const found = vals.find((v: any) => v.$type === 'flowable:' + name);
      return found ? (found.get('value') || '') : '';
    };

    const setExtVal = (name: string, value: string) => {
      const ee = bo.get('extensionElements');
      const vals: any[] = ee ? [...(ee.get('values') || [])] : [];
      const existing = vals.find((v: any) => v.$type === 'flowable:' + name);
      const bpmnFactory = modelerRef.current?.get('bpmnFactory');
      const modeling = modelerRef.current?.get('modeling');
      if (!bpmnFactory || !modeling) return;

      if (!value) {
        const filtered = vals.filter((v: any) => v.$type !== 'flowable:' + name);
        const newEE = filtered.length
          ? bpmnFactory.create('bpmn:ExtensionElements', { values: filtered })
          : null;
        modeling.updateModdleProperties(element, bo, { extensionElements: newEE });
        return;
      }

      const newEl = bpmnFactory.create('flowable:' + name, { value });
      const newVals = existing
        ? vals.map((v: any) => (v === existing ? newEl : v))
        : [...vals, newEl];
      const newEE = bpmnFactory.create('bpmn:ExtensionElements', { values: newVals });
      modeling.updateModdleProperties(element, bo, { extensionElements: newEE });
    };

    setFlowableFields([
      { key: 'assignee', label: 'Assignee', value: extVal('Assignee'), setValue: v => setExtVal('Assignee', v) },
      { key: 'candUsers', label: 'Candidate Users', value: extVal('CandidateUsers'), setValue: v => setExtVal('CandidateUsers', v) },
      { key: 'candGroups', label: 'Candidate Groups', value: extVal('CandidateGroups'), setValue: v => setExtVal('CandidateGroups', v) },
    ]);
  }, []);

  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
      propertiesPanel: { parent: panelRef.current! },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
      ],
      moddleExtensions: { flowable: flowableModdleDescriptor },
      keyboard: { bindTo: document },
    });

    modelerRef.current = modeler;

    // Listen for selection changes to render Flowable fields + sequence flow conditions
    modeler.on('selection.changed', (e: any) => {
      const sel = e.newSelection?.[0];
      if (sel) {
        renderSelectionFields(sel);
      } else {
        setFlowableFields(null);
        setSeqFlow(null);
      }
    });
    modeler.on('element.changed', () => {
      const selection: any = modeler.get('selection');
      const sel = selection?.get()?.[0];
      if (sel) renderSelectionFields(sel);
    });

    modeler.on('import.done', async () => {
      setReady(true);
      try {
        const result = await modeler.saveXML({ format: true });
        onChange?.(result.xml ?? '');
      } catch { /* ignore */ }
      raf2(() => (modeler.get('canvas') as any)?.zoom('fit-viewport'));
    });

    modeler.on('commandStack.changed', async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true });
        onChange?.(xml ?? '');
      } catch { /* ignore */ }
    });

    const xml = initialXml || EMPTY_BPMN;
    modeler.importXML(xml).catch(() => modeler.importXML(EMPTY_BPMN));

    const onResize = () => (modeler.get('canvas') as any)?.resized();
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(() => onResize());
    observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      modeler.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative w-full border rounded-lg bg-white flex"
      style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
    >
      <div className="flex-1 relative">
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <span className="text-v2-muted">加载编辑器中...</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Properties panel sidebar */}
      <div className="w-72 border-l overflow-y-auto bg-gray-50 flex-shrink-0 flex flex-col">
        {/* Standard properties panel */}
        <div ref={panelRef}>
          {!ready && <div className="p-4 text-sm text-v2-muted">加载属性面板...</div>}
        </div>

        {/* Flowable Assignment — rendered separately below the standard panel */}
        {flowableFields && (
          <div className="border-t px-4 py-3">
            <div className="text-sm font-semibold text-gray-700 mb-3">Flowable Assignment</div>
            {flowableFields.map(f => (
              <div key={f.key} className="mb-3 last:mb-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input
                  type="text"
                  value={f.value}
                  onChange={e => {
                    f.setValue(e.target.value);
                    setFlowableFields(prev => prev?.map(p => p.key === f.key ? { ...p, value: e.target.value } : p) ?? null);
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                  placeholder={f.key === 'candGroups' ? '${groupId}' : ''}
                />
              </div>
            ))}
          </div>
        )}

        {/* Sequence Flow Condition — shows when an arrow line is selected */}
        {seqFlow && (
          <div className="border-t px-4 py-3">
            <div className="text-sm font-semibold text-gray-700 mb-2">Sequence Flow</div>
            {seqFlow.name && <p className="text-xs text-gray-500 mb-2">名称: {seqFlow.name}</p>}
            <label className="block text-xs font-medium text-gray-600 mb-1">Condition（条件表达式）</label>
            <input
              type="text"
              value={seqFlow.condition}
              onChange={e => {
                seqFlow.setCondition(e.target.value);
                setSeqFlow(prev => prev ? { ...prev, condition: e.target.value } : null);
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none font-mono"
              placeholder="${approved == true}"
            />
            <p className="text-xs text-gray-400 mt-1">
              表达式如 ${"${approved == true}"}、${"${approved == false}"}。只在从 Gateway 出发的连线上有意义。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function raf2(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}
