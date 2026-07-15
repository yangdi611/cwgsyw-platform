package com.cwgsyw.platform.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.Locale;
import java.util.Map;

@Component
public class AuditSnapshotSerializer {
    private static final int MAX_STRING_LENGTH = 512;
    private static final int MAX_COLLECTION_SIZE = 50;

    private final ObjectMapper objectMapper;

    public AuditSnapshotSerializer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String serialize(Object value) {
        if (value == null) {
            return null;
        }
        try {
            JsonNode sanitized = sanitize(objectMapper.valueToTree(value));
            return objectMapper.writeValueAsString(sanitized);
        } catch (Exception exception) {
            return "{}";
        }
    }

    public String sanitizeJson(String json) {
        if (json == null || json.isBlank()) {
            return json;
        }
        try {
            return objectMapper.writeValueAsString(sanitize(objectMapper.readTree(json)));
        } catch (Exception exception) {
            return "{}";
        }
    }

    private JsonNode sanitize(JsonNode value) {
        if (value.isObject()) {
            ObjectNode result = objectMapper.createObjectNode();
            Iterator<Map.Entry<String, JsonNode>> fields = value.fields();
            int count = 0;
            while (fields.hasNext() && count++ < MAX_COLLECTION_SIZE) {
                Map.Entry<String, JsonNode> field = fields.next();
                result.set(field.getKey(), isSensitive(field.getKey())
                        ? objectMapper.getNodeFactory().textNode("[REDACTED]")
                        : sanitize(field.getValue()));
            }
            if (fields.hasNext()) {
                result.put("_truncated", true);
            }
            return result;
        }
        if (value.isArray()) {
            ArrayNode result = objectMapper.createArrayNode();
            int size = Math.min(value.size(), MAX_COLLECTION_SIZE);
            for (int index = 0; index < size; index++) {
                result.add(sanitize(value.get(index)));
            }
            if (value.size() > MAX_COLLECTION_SIZE) {
                result.add("[TRUNCATED]");
            }
            return result;
        }
        if (value.isTextual() && value.textValue().length() > MAX_STRING_LENGTH) {
            return objectMapper.getNodeFactory().textNode(value.textValue().substring(0, MAX_STRING_LENGTH) + "…");
        }
        return value;
    }

    private boolean isSensitive(String fieldName) {
        String normalized = fieldName.toLowerCase(Locale.ROOT);
        return normalized.contains("password") || normalized.contains("secret")
                || normalized.contains("token") || normalized.contains("credential")
                || normalized.equals("key") || normalized.endsWith("key")
                || normalized.equals("content") || normalized.equals("body")
                || normalized.equals("filecontent");
    }
}
