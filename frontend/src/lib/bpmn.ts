// bpmn.js utility functions

/** Empty BPMN template for new process designs */
export const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:flowable="http://flowable.org/bpmn"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" name="新流程" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Extract the process id from BPMN XML */
export function extractProcessId(xml: string): string {
  const match = xml.match(/<bpmn:process[^>]*id="([^"]*)"/);
  return match?.[1] ?? 'Process_1';
}

/** Extract the process name from BPMN XML */
export function extractProcessName(xml: string): string {
  const match = xml.match(/<bpmn:process[^>]*name="([^"]*)"/);
  return match?.[1] ?? '未命名流程';
}
