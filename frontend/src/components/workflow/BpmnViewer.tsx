'use client';

import { useEffect, useRef } from 'react';
import BpmnJSViewer from 'bpmn-js/lib/NavigatedViewer';
import type { BpmnViewerServices } from '@/types/bpmn';
import { CANVAS_NEUTRAL, CANVAS_STATUS } from '@/design-system/figma-neutral/canvas-tokens';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

interface BpmnViewerProps {
  xml: string;
  completedActivities?: string[];
  currentActivities?: string[];
}

export default function BpmnViewer({
  xml,
  completedActivities = [],
  currentActivities = [],
}: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<BpmnJSViewer<BpmnViewerServices> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !xml) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    try {
      const viewer = new BpmnJSViewer<BpmnViewerServices>({ container: containerRef.current });

      viewer.importXML(xml).then(() => {
        const canvas = viewer.get('canvas');
        canvas.zoom('fit-viewport');

        const overlays = viewer.get('overlays');
        const elementRegistry = viewer.get('elementRegistry');

        completedActivities.forEach((id) => {
          try {
            if (elementRegistry.get(id)) {
              overlays.add(id, {
                position: { top: 0, left: 0 },
                html: `<div style="width:100%;height:100%;background:color-mix(in srgb, ${CANVAS_STATUS.success} 15%, transparent);border:2px solid ${CANVAS_STATUS.success};border-radius:6px;pointer-events:none"></div>`,
              });
            }
          } catch { /* ignore */ }
        });

        currentActivities.forEach((id) => {
          try {
            if (elementRegistry.get(id)) {
              overlays.add(id, {
                position: { top: 0, left: 0 },
                html: `<div style="width:100%;height:100%;background:color-mix(in srgb, ${CANVAS_NEUTRAL[800]} 16%, transparent);border:2px solid ${CANVAS_NEUTRAL[800]};border-radius:6px;animation:pulse 1.5s ease-in-out infinite;pointer-events:none"></div>`,
              });
            }
          } catch { /* ignore */ }
        });
      }).catch((err: unknown) => {
        console.warn('BPMN viewer import failed:', err);
      });

      viewerRef.current = viewer;
    } catch (err) {
      console.error('BPMN viewer init failed:', err);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [xml, completedActivities, currentActivities]);

  if (!xml) {
    return (
      <div className="w-full min-h-[400px] border rounded-lg bg-[var(--cwgsyw-bg-surface-subtle)] flex items-center justify-center text-[var(--cwgsyw-text-secondary)]">
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
