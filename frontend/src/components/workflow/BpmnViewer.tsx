'use client';

import { useEffect, useRef } from 'react';

interface BpmnViewerProps {
  /** BPMN 2.0 XML content */
  xml: string;
  /** Activity IDs that are completed (green highlight) */
  completedActivities?: string[];
  /** Activity IDs that are currently active (blue highlight with pulse) */
  currentActivities?: string[];
}

export default function BpmnViewer({
  xml,
  completedActivities = [],
  currentActivities = [],
}: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !xml) return;

    let viewer: any = null;

    // Dynamic import to avoid SSR issues
    import('bpmn-js/lib/NavigatedViewer').then(({ default: BpmnJSViewer }) => {
      if (!containerRef.current) return;

      viewer = new BpmnJSViewer({
        container: containerRef.current,
      });

      viewer.importXML(xml).then(() => {
        const canvas = viewer.get('canvas') as any;
        canvas.zoom('fit-viewport');

        const overlays = viewer.get('overlays') as any;
        const elementRegistry = viewer.get('elementRegistry') as any;

        // Green overlay for completed activities
        completedActivities.forEach((id) => {
          try {
            if (elementRegistry.get(id)) {
              overlays.add(id, {
                position: { top: 0, left: 0 },
                html: '<div style="width:100%;height:100%;background:rgba(34,197,94,0.15);border:2px solid #22c55e;border-radius:6px;pointer-events:none"></div>',
              });
            }
          } catch {
            // ignore missing elements
          }
        });

        // Blue overlay for current activities
        currentActivities.forEach((id) => {
          try {
            if (elementRegistry.get(id)) {
              overlays.add(id, {
                position: { top: 0, left: 0 },
                html: '<div style="width:100%;height:100%;background:rgba(59,130,246,0.25);border:2px solid #3b82f6;border-radius:6px;animation:pulse 1.5s ease-in-out infinite;pointer-events:none"></div>',
              });
            }
          } catch {
            // ignore missing elements
          }
        });
      }).catch((err: any) => {
        console.warn('Failed to import BPMN XML:', err);
      });
    });

    return () => {
      if (viewer) viewer.destroy();
    };
  }, [xml, completedActivities, currentActivities]);

  if (!xml) {
    return (
      <div className="w-full min-h-[400px] border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground">
        没有流程图数据
      </div>
    );
  }

  return (
    <div className="w-full min-h-[400px] border rounded-lg bg-white">
      <div ref={containerRef} className="w-full h-full min-h-[400px]" />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
