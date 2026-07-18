package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.workflow.dto.SaveProcessDefinitionReq;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowDefinitionMetadataTest {
    @Test
    void syncDefinitionMetadata_updatesRoundTripFieldsAndPreservesCanvas() {
        SaveProcessDefinitionReq request = new SaveProcessDefinitionReq();
        request.setKey("updated_key");
        request.setName("Updated & Reviewed");
        request.setCategory("updated/category");
        request.setDescription("Updated <description>");

        String result = WorkflowService.syncDefinitionMetadata(xml(), request, "preserved_key", request.getCategory());

        assertThat(result).contains("id=\"preserved_key\"")
            .contains("name=\"Updated &amp; Reviewed\"")
            .contains("targetNamespace=\"updated/category\"")
            .contains("Updated &lt;description&gt;")
            .contains("bpmnElement=\"Task_1\"");
    }

    @Test
    void syncDefinitionMetadata_addsEmptyDocumentationWhenMissing() {
        SaveProcessDefinitionReq request = new SaveProcessDefinitionReq();
        request.setKey("updated_key");
        request.setName("Updated");
        request.setCategory("updated");

        String result = WorkflowService.syncDefinitionMetadata(
            xml().replace("<bpmn:documentation>Old</bpmn:documentation>", ""), request,
            request.getKey(), request.getCategory());

        assertThat(result).contains("<bpmn:documentation/>");
    }

    private String xml() {
        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
              xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
              targetNamespace="old">
              <bpmn:process id="old_key" name="Old"><bpmn:documentation>Old</bpmn:documentation>
                <bpmn:startEvent id="Start_1"/><bpmn:endEvent id="End_1"/>
              </bpmn:process>
              <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="old_key">
                <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"/>
              </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
            </bpmn:definitions>
            """;
    }
}
