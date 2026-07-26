package com.cwgsyw.platform.module.cmdb.spatial.document;

import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialValidationIssue;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Schema v1 structural and geometry validator. CI binding validation lives in the command service. */
@Component
public class SpatialDocumentValidator {
    public static final int SCHEMA_VERSION = 1;
    public static final int MAX_ELEMENTS = 2000;
    private static final Set<String> ELEMENT_TYPES = Set.of(
            "ROOM_OUTLINE", "WALL", "DOOR", "RACK_ROW", "RACK_SLOT", "AISLE", "ZONE", "FACILITY", "TEXT");
    private static final Set<String> FACILITY_TYPES = Set.of(
            "AIR_CONDITIONER", "UPS", "POWER_DISTRIBUTION", "PDU", "FRESH_AIR", "FIRE_PROTECTION", "GENERAL");

    public SpatialDocumentValidation validate(JsonNode document) {
        List<SpatialValidationIssue> errors = new ArrayList<>();
        List<SpatialValidationIssue> warnings = new ArrayList<>();
        if (document == null || !document.isObject()) {
            errors.add(issue("DOCUMENT_INVALID", null, "document", "布局文档必须是对象"));
            return new SpatialDocumentValidation(errors, warnings);
        }
        if (document.path("schemaVersion").asInt(-1) != SCHEMA_VERSION) {
            errors.add(issue("SCHEMA_VERSION_UNSUPPORTED", null, "schemaVersion", "不支持的布局文档版本"));
        }
        validateCanvas(document.path("canvas"), errors);
        JsonNode elementsNode = document.path("elements");
        if (!elementsNode.isArray()) {
            errors.add(issue("ELEMENTS_REQUIRED", null, "elements", "布局必须包含元素数组"));
            return new SpatialDocumentValidation(errors, warnings);
        }
        if (elementsNode.size() > MAX_ELEMENTS) {
            errors.add(issue("ELEMENTS_TOO_MANY", null, "elements", "布局元素不能超过 " + MAX_ELEMENTS + " 个"));
        }
        Set<String> ids = new HashSet<>();
        Set<String> rackNames = new HashSet<>();
        java.util.Map<String, JsonNode> elementsById = new java.util.HashMap<>();
        int outlineCount = 0;
        for (int index = 0; index < elementsNode.size(); index++) {
            JsonNode element = elementsNode.get(index);
            String path = "elements[" + index + "]";
            String id = element.path("id").asText();
            if (!isUuid(id)) errors.add(issue("ELEMENT_ID_INVALID", id, path + ".id", "元素标识必须是 UUID"));
            else if (!ids.add(id)) errors.add(issue("ELEMENT_ID_DUPLICATE", id, path + ".id", "元素标识重复"));
            else elementsById.put(id, element);
            String type = element.path("type").asText();
            if (!ELEMENT_TYPES.contains(type)) {
                errors.add(issue("ELEMENT_TYPE_INVALID", id, path + ".type", "不支持的空间元素类型"));
                continue;
            }
            if ("ROOM_OUTLINE".equals(type)) outlineCount++;
            validateGeometry(element.path("geometry"), id, path + ".geometry", errors);
            if ("RACK_SLOT".equals(type)) {
                String name = element.path("name").asText();
                if (name.isBlank()) errors.add(issue("RACK_SLOT_NAME_REQUIRED", id, path + ".name", "机柜位必须有编号"));
                else if (!rackNames.add(name)) errors.add(issue("RACK_SLOT_NAME_DUPLICATE", id, path + ".name", "机柜位编号重复"));
                String state = element.path("rack").path("slotState").asText("EMPTY");
                boolean bound = element.path("binding").hasNonNull("ciInstanceId");
                if ("OCCUPIED".equals(state) && !bound) {
                    errors.add(issue("OCCUPIED_RACK_UNBOUND", id, path + ".binding", "已占用机柜位必须绑定机柜 CI"));
                }
                if (("EMPTY".equals(state) || "RESERVED".equals(state)) && bound) {
                    errors.add(issue("RACK_SLOT_BINDING_INVALID", id, path + ".binding", "空位或预留位不能绑定机柜 CI"));
                }
            }
            if ("FACILITY".equals(type)) {
                String facilityType = element.path("facility").path("facilityType").asText();
                if (!FACILITY_TYPES.contains(facilityType)) {
                    errors.add(issue("FACILITY_TYPE_INVALID", id, path + ".facility.facilityType", "设施类型无效"));
                }
                if (!element.path("binding").hasNonNull("ciInstanceId")) {
                    warnings.add(issue("FACILITY_UNBOUND", id, path + ".binding", "设施尚未绑定 CI"));
                }
            }
        }
        validateDoorAttachments((ArrayNode) elementsNode, elementsById, errors);
        if (outlineCount != 1) errors.add(issue("ROOM_OUTLINE_REQUIRED", null, "elements", "布局必须且只能有一个机房外轮廓"));
        return new SpatialDocumentValidation(errors, warnings);
    }

    private void validateDoorAttachments(ArrayNode elements, java.util.Map<String, JsonNode> elementsById, List<SpatialValidationIssue> errors) {
        for (int index = 0; index < elements.size(); index++) {
            JsonNode door = elements.get(index);
            if (!"DOOR".equals(door.path("type").asText())) continue;
            String path = "elements[" + index + "].door";
            String doorId = door.path("id").asText();
            String edgeElementId = door.path("door").path("edgeElementId").asText();
            int segmentIndex = door.path("door").path("segmentIndex").asInt(-1);
            JsonNode edge = elementsById.get(edgeElementId);
            if (edge == null || !("WALL".equals(edge.path("type").asText()) || "ROOM_OUTLINE".equals(edge.path("type").asText()))) {
                errors.add(issue("DOOR_ATTACHMENT_INVALID", doorId, path, "门必须吸附在存在的墙体或机房外轮廓边上"));
                continue;
            }
            JsonNode points = edge.path("geometry").path("points");
            int edgeCount = "POLYGON".equals(edge.path("geometry").path("kind").asText()) ? points.size() : points.size() - 1;
            if (!points.isArray() || segmentIndex < 0 || segmentIndex >= edgeCount) {
                errors.add(issue("DOOR_ATTACHMENT_INVALID", doorId, path + ".segmentIndex", "门吸附的边序号无效"));
                continue;
            }
            JsonNode geometry = door.path("geometry");
            if (!"RECT".equals(geometry.path("kind").asText()) || !inUnitRange(geometry.get("x"))
                    || !inUnitRange(geometry.get("y")) || !inUnitRange(geometry.get("width"))
                    || !inUnitRange(geometry.get("height"))) {
                errors.add(issue("DOOR_ATTACHMENT_INVALID", doorId, path, "门必须使用有效矩形几何"));
                continue;
            }
            double centerX = geometry.path("x").asDouble() + geometry.path("width").asDouble() / 2;
            double centerY = geometry.path("y").asDouble() + geometry.path("height").asDouble() / 2;
            double[] start = point(points.get(segmentIndex));
            double[] end = point(points.get((segmentIndex + 1) % points.size()));
            if (distanceToSegment(centerX, centerY, start, end) > 0.035d) {
                errors.add(issue("DOOR_ATTACHMENT_INVALID", doorId, path, "门必须贴近所选墙体或机房外轮廓边"));
            }
        }
    }

    private void validateCanvas(JsonNode canvas, List<SpatialValidationIssue> errors) {
        int width = canvas.path("logicalWidth").asInt(0);
        int height = canvas.path("logicalHeight").asInt(0);
        if (width < 100 || width > 10000 || height < 100 || height > 10000) {
            errors.add(issue("CANVAS_INVALID", null, "canvas", "逻辑画布尺寸必须在 100 到 10000 之间"));
        }
    }

    private void validateGeometry(JsonNode geometry, String id, String path, List<SpatialValidationIssue> errors) {
        String kind = geometry.path("kind").asText();
        if (!("RECT".equals(kind) || "POLYGON".equals(kind) || "LINE".equals(kind))) {
            errors.add(issue("GEOMETRY_KIND_INVALID", id, path + ".kind", "不支持的几何类型"));
            return;
        }
        if ("RECT".equals(kind)) {
            decimalInRange(geometry, "x", id, path, errors);
            decimalInRange(geometry, "y", id, path, errors);
            positiveSize(geometry, "width", id, path, errors);
            positiveSize(geometry, "height", id, path, errors);
            if (inUnitRange(geometry.get("x")) && inUnitRange(geometry.get("y"))
                    && inUnitRange(geometry.get("width")) && inUnitRange(geometry.get("height"))
                    && (geometry.path("x").asDouble() + geometry.path("width").asDouble() > 1
                    || geometry.path("y").asDouble() + geometry.path("height").asDouble() > 1)) {
                errors.add(issue("RECT_OUT_OF_BOUNDS", id, path, "矩形元素不能超出逻辑画布"));
            }
            if (geometry.has("rotation") && (geometry.path("rotation").asDouble() < 0 || geometry.path("rotation").asDouble() >= 360)) {
                errors.add(issue("ROTATION_INVALID", id, path + ".rotation", "旋转角度必须在 0 到 360 之间"));
            }
        } else {
            ArrayNode points = geometry.has("points") && geometry.get("points").isArray() ? (ArrayNode) geometry.get("points") : null;
            int minPoints = "POLYGON".equals(kind) ? 3 : 2;
            if (points == null || points.size() < minPoints) {
                errors.add(issue("GEOMETRY_POINTS_INVALID", id, path + ".points", "几何点数量不足"));
                return;
            }
            for (int i = 0; i < points.size(); i++) {
                JsonNode point = points.get(i);
                if (!point.isArray() || point.size() != 2 || !inUnitRange(point.get(0)) || !inUnitRange(point.get(1))) {
                    errors.add(issue("GEOMETRY_POINT_OUT_OF_RANGE", id, path + ".points[" + i + "]", "坐标必须在 0 到 1 之间"));
                }
            }
            if ("POLYGON".equals(kind) && isSelfIntersecting(points)) {
                errors.add(issue("POLYGON_SELF_INTERSECTION", id, path + ".points", "机房多边形不能自相交"));
            }
        }
    }

    private void decimalInRange(JsonNode geometry, String field, String id, String path, List<SpatialValidationIssue> errors) {
        if (!inUnitRange(geometry.get(field))) errors.add(issue("GEOMETRY_OUT_OF_RANGE", id, path + "." + field, "坐标必须在 0 到 1 之间"));
    }

    private void positiveSize(JsonNode geometry, String field, String id, String path, List<SpatialValidationIssue> errors) {
        if (!inUnitRange(geometry.get(field)) || geometry.path(field).asDouble() <= 0) {
            errors.add(issue("GEOMETRY_SIZE_INVALID", id, path + "." + field, "尺寸必须大于 0 且不超过 1"));
        }
    }

    private boolean inUnitRange(JsonNode value) {
        return value != null && value.isNumber() && value.asDouble() >= 0 && value.asDouble() <= 1;
    }

    private boolean isUuid(String value) {
        try { UUID.fromString(value); return true; } catch (Exception ignored) { return false; }
    }

    private boolean isSelfIntersecting(ArrayNode points) {
        int count = points.size();
        for (int i = 0; i < count; i++) {
            double[] a = point(points.get(i));
            double[] b = point(points.get((i + 1) % count));
            for (int j = i + 1; j < count; j++) {
                if (Math.abs(i - j) <= 1 || (i == 0 && j == count - 1)) continue;
                if (segmentsIntersect(a, b, point(points.get(j)), point(points.get((j + 1) % count)))) return true;
            }
        }
        return false;
    }

    private double[] point(JsonNode node) { return new double[]{node.get(0).asDouble(), node.get(1).asDouble()}; }
    private double distanceToSegment(double x, double y, double[] start, double[] end) {
        double dx = end[0] - start[0], dy = end[1] - start[1];
        double denominator = dx * dx + dy * dy;
        double t = denominator == 0 ? 0 : Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / denominator));
        return Math.hypot(x - (start[0] + t * dx), y - (start[1] + t * dy));
    }
    private boolean segmentsIntersect(double[] a, double[] b, double[] c, double[] d) {
        double abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
        return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
    }
    private double cross(double[] a, double[] b, double[] c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
    private SpatialValidationIssue issue(String code, String elementId, String path, String message) { return new SpatialValidationIssue(code, elementId, path, message); }
}
