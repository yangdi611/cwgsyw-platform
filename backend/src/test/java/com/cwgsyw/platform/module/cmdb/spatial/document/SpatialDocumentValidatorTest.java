package com.cwgsyw.platform.module.cmdb.spatial.document;

import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialValidationIssue;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpatialDocumentValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final SpatialDocumentValidator validator = new SpatialDocumentValidator();

    @Test
    void acceptsMinimalValidOutline() {
        var result = validator.validate(document(outline()));

        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void rejectsDuplicateElementIdsAndSelfIntersectingPolygon() {
        ObjectNode outline = outline();
        ArrayNode points = (ArrayNode) outline.path("geometry").path("points");
        points.removeAll();
        point(points, 0.1, 0.1); point(points, 0.9, 0.9);
        point(points, 0.1, 0.9); point(points, 0.9, 0.1);
        ObjectNode wall = outline.deepCopy();
        wall.put("type", "WALL");
        var result = validator.validate(document(outline, wall));

        assertThat(codes(result)).contains("ELEMENT_ID_DUPLICATE", "POLYGON_SELF_INTERSECTION");
    }

    @Test
    void requiresOccupiedRackSlotBindingAndRejectsDuplicateRackNames() {
        ObjectNode first = rackSlot("F-01", "OCCUPIED", null);
        ObjectNode second = rackSlot("F-01", "EMPTY", null);
        var result = validator.validate(document(outline(), first, second));

        assertThat(codes(result)).contains("OCCUPIED_RACK_UNBOUND", "RACK_SLOT_NAME_DUPLICATE");
    }

    @Test
    void warnsForUnboundFacilityWithoutBlockingLayout() {
        ObjectNode facility = rectElement("FACILITY", "空调");
        facility.putObject("geometry").put("kind", "RECT").put("x", 0.1).put("y", 0.1).put("width", 0.1).put("height", 0.1);
        facility.putObject("facility").put("facilityType", "AIR_CONDITIONER");
        var result = validator.validate(document(outline(), facility));

        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).extracting(SpatialValidationIssue::code).containsExactly("FACILITY_UNBOUND");
    }

    @Test
    void rejectsUnknownFacilityType() {
        ObjectNode facility = rectElement("FACILITY", "未知设备");
        facility.putObject("geometry").put("kind", "RECT").put("x", 0.1).put("y", 0.1).put("width", 0.1).put("height", 0.1);
        facility.putObject("facility").put("facilityType", "UNKNOWN");

        var result = validator.validate(document(outline(), facility));

        assertThat(codes(result)).contains("FACILITY_TYPE_INVALID");
    }

    @Test
    void rejectsRectangleThatExtendsOutsideTheLogicalCanvas() {
        ObjectNode facility = rectElement("FACILITY", "越界空调");
        facility.putObject("geometry").put("kind", "RECT").put("x", 0.9).put("y", 0.2).put("width", 0.2).put("height", 0.1);
        facility.putObject("facility").put("facilityType", "AIR_CONDITIONER");

        var result = validator.validate(document(outline(), facility));

        assertThat(codes(result)).contains("RECT_OUT_OF_BOUNDS");
    }

    @Test
    void rejectsDoorWithoutAnAttachedWallOrOutlineEdge() {
        ObjectNode door = rectElement("DOOR", "门");
        door.putObject("geometry").put("kind", "RECT").put("x", 0.2).put("y", 0.1).put("width", 0.1).put("height", 0.02);

        var result = validator.validate(document(outline(), door));

        assertThat(codes(result)).contains("DOOR_ATTACHMENT_INVALID");
    }

    @Test
    void acceptsDoorAttachedToRoomOutlineEdge() {
        ObjectNode outline = outline();
        ObjectNode door = rectElement("DOOR", "门");
        door.putObject("geometry").put("kind", "RECT").put("x", 0.2).put("y", 0.05).put("width", 0.1).put("height", 0.02);
        door.putObject("door").put("edgeElementId", outline.path("id").asText()).put("segmentIndex", 0).put("position", 0.25);

        var result = validator.validate(document(outline, door));

        assertThat(result.errors()).isEmpty();
    }

    @Test
    void rejectsDoorThatOnlyClaimsToBeAttached() {
        ObjectNode outline = outline();
        ObjectNode door = rectElement("DOOR", "门");
        door.putObject("geometry").put("kind", "RECT").put("x", 0.4).put("y", 0.4).put("width", 0.1).put("height", 0.02);
        door.putObject("door").put("edgeElementId", outline.path("id").asText()).put("segmentIndex", 0).put("position", 0.25);

        var result = validator.validate(document(outline, door));

        assertThat(codes(result)).contains("DOOR_ATTACHMENT_INVALID");
    }

    private ObjectNode document(ObjectNode... elements) {
        ObjectNode document = mapper.createObjectNode();
        document.put("schemaVersion", 1);
        document.putObject("canvas").put("logicalWidth", 1600).put("logicalHeight", 1000);
        ArrayNode nodes = document.putArray("elements");
        for (ObjectNode element : elements) nodes.add(element);
        return document;
    }

    private ObjectNode outline() {
        ObjectNode result = mapper.createObjectNode();
        result.put("id", UUID.randomUUID().toString()); result.put("type", "ROOM_OUTLINE"); result.put("name", "308机房");
        ArrayNode points = result.putObject("geometry").put("kind", "POLYGON").putArray("points");
        point(points, 0.05, 0.05); point(points, 0.95, 0.05);
        point(points, 0.95, 0.95); point(points, 0.05, 0.95);
        return result;
    }

    private ObjectNode rackSlot(String name, String state, Long ciInstanceId) {
        ObjectNode slot = rectElement("RACK_SLOT", name);
        slot.putObject("geometry").put("kind", "RECT").put("x", 0.2).put("y", 0.2).put("width", 0.05).put("height", 0.1);
        slot.putObject("rack").put("slotState", state);
        if (ciInstanceId != null) slot.putObject("binding").put("ciInstanceId", ciInstanceId);
        return slot;
    }

    private ObjectNode rectElement(String type, String name) {
        ObjectNode result = mapper.createObjectNode();
        result.put("id", UUID.randomUUID().toString()); result.put("type", type); result.put("name", name);
        return result;
    }

    private java.util.List<String> codes(SpatialDocumentValidation result) {
        return result.errors().stream().map(SpatialValidationIssue::code).toList();
    }

    private void point(ArrayNode points, double x, double y) {
        ArrayNode point = points.addArray();
        point.add(x);
        point.add(y);
    }
}
