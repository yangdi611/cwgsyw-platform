'use client';

import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { EMPTY_BPMN } from '@/lib/bpmn';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

interface BpmnEditorProps {
  initialXml?: string;
  onChange?: (xml: string) => void;
  readOnly?: boolean;
}

export default function BpmnEditor({ initialXml, onChange, readOnly = false }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: document },
    });

    modeler.on('import.done', () => {
      setReady(true);
      // Wait for layout to settle, then fit
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const canvas = modeler.get('canvas') as any;
          if (canvas) canvas.zoom('fit-viewport');
        });
      });
    });

    modeler.on('commandStack.changed', async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true });
        onChange?.(xml ?? '');
      } catch {
        // ignore
      }
    });

    modelerRef.current = modeler;

    const xml = initialXml || EMPTY_BPMN;
    modeler.importXML(xml).catch(() => {
      modeler.importXML(EMPTY_BPMN);
    });

    // Resize handler — keep canvas fitting as container resizes
    const handleResize = () => {
      const canvas = modeler.get('canvas') as any;
      if (canvas) canvas.resized();
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes
    let observer: ResizeObserver | null = null;
    if (containerRef.current) {
      observer = new ResizeObserver(() => {
        handleResize();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
      modeler.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modelerRef.current || !initialXml) return;
    modelerRef.current.importXML(initialXml);
    const canvas = modelerRef.current.get('canvas') as any;
    requestAnimationFrame(() => canvas?.zoom('fit-viewport'));
  }, [initialXml]);

  return (
    <div className="relative w-full border rounded-lg bg-white"
      style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <span className="text-muted-foreground">加载编辑器中...</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
