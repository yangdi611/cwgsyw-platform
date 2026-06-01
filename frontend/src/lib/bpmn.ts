// bpmn.js utility functions

/** Empty BPMN template — comes with a complete approval flow: Start → Approve → Gateway → (Pass/Reject) */
export const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:flowable="http://flowable.org/bpmn"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" name="新流程" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
    <bpmn:sequenceFlow id="flow_start" sourceRef="StartEvent_1" targetRef="Activity_1" />
    <bpmn:userTask id="Activity_1" name="审批人审批">
      <bpmn:extensionElements>
        <flowable:candidateGroups>\${groupId}</flowable:candidateGroups>
      </bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="flow_to_gw" sourceRef="Activity_1" targetRef="Gateway_1" />
    <bpmn:exclusiveGateway id="Gateway_1" name="审批结果" />
    <bpmn:sequenceFlow id="flow_pass" sourceRef="Gateway_1" targetRef="End_pass" name="通过">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow_reject" sourceRef="Gateway_1" targetRef="End_reject" name="拒绝">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${approved == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:endEvent id="End_pass" name="审批通过" />
    <bpmn:endEvent id="End_reject" name="审批拒绝" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="shape_start" bpmnElement="StartEvent_1">
        <dc:Bounds x="100" y="95" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_task" bpmnElement="Activity_1">
        <dc:Bounds x="200" y="73" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_gw" bpmnElement="Gateway_1">
        <dc:Bounds x="380" y="88" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end_pass" bpmnElement="End_pass">
        <dc:Bounds x="510" y="55" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end_reject" bpmnElement="End_reject">
        <dc:Bounds x="510" y="135" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="edge_start" bpmnElement="flow_start">
        <di:waypoint x="136" y="113" /><di:waypoint x="200" y="113" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_to_gw" bpmnElement="flow_to_gw">
        <di:waypoint x="300" y="113" /><di:waypoint x="380" y="113" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_pass" bpmnElement="flow_pass">
        <di:waypoint x="430" y="113" /><di:waypoint x="510" y="73" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_reject" bpmnElement="flow_reject">
        <di:waypoint x="405" y="138" /><di:waypoint x="510" y="153" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
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
