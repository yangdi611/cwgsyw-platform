package com.cwgsyw.platform.module.cmdb.spatial;

import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialLayoutVersionVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpatialLayoutVersionVOJsonTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void serializesSnowflakeVersionIdsAsStrings() throws Exception {
        var version = new SpatialLayoutVersionVO(
                2081155459563175938L, 1L, "PUBLISHED", 1, 0, 1,
                objectMapper.readTree("{}"), "checksum", 0,
                2081155459563175900L, null, null, null);

        var json = objectMapper.readTree(objectMapper.writeValueAsString(version));

        assertThat(json.path("versionId").isTextual()).isTrue();
        assertThat(json.path("versionId").asText()).isEqualTo("2081155459563175938");
        assertThat(json.path("sourceVersionId").isTextual()).isTrue();
    }
}
