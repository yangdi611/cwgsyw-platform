'use client';

import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import FlowablePropertiesProvider, { flowableModdleDescriptor } from '@/lib/FlowableProps';
import { EMPTY_BPMN } from '@/lib/bpmn';
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
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
      propertiesPanel: { parent: panelRef.current! },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        FlowablePropertiesProvider,
      ],
      moddleExtensions: {
        flowable: flowableModdleDescriptor,
      },
      keyboard: { bindTo: document },
    });

    modelerRef.current = modeler;

    modeler.on('import.done', async () => {
      setReady(true);
      try {
        const result = await modeler.saveXML({ format: true });
        onChange?.(result.xml ?? '');
      } catch { /* ignore */ }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          (modeler.get('canvas') as any)?.zoom('fit-viewport');
        });
      });
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
            <span className="text-muted-foreground">加载编辑器中...</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <div ref={panelRef} className="w-72 border-l overflow-y-auto bg-gray-50 flex-shrink-0">
        {!ready && (
          <div className="p-4 text-sm text-muted-foreground">加载属性面板...</div>
        )}
      </div>
    </div>
  );
}
