'use client';

import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { EMPTY_BPMN } from '@/lib/bpmn';

interface BpmnEditorProps {
  /** Initial BPMN XML, uses empty template if not provided */
  initialXml?: string;
  /** Callback when editor content changes */
  onChange?: (xml: string) => void;
  /** Whether the editor is read-only */
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
      const canvas = modeler.get('canvas') as any;
      canvas.zoom('fit-viewport');
    });

    modeler.on('commandStack.changed', async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true });
        onChange?.(xml ?? '');
      } catch {
        // ignore save errors during editing
      }
    });

    modelerRef.current = modeler;

    const xml = initialXml || EMPTY_BPMN;
    modeler.importXML(xml).catch(() => {
      modeler.importXML(EMPTY_BPMN);
    });

    return () => {
      modeler.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-import when initialXml changes
  useEffect(() => {
    if (!modelerRef.current || !initialXml) return;
    modelerRef.current.importXML(initialXml);
    const canvas = modelerRef.current.get('canvas') as any;
    canvas.zoom('fit-viewport');
  }, [initialXml]);

  return (
    <div className="relative w-full h-full min-h-[500px] border rounded-lg bg-white">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <span className="text-muted-foreground">加载编辑器中...</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full min-h-[500px]" />
    </div>
  );
}
