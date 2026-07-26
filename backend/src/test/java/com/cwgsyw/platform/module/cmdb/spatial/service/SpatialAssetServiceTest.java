package com.cwgsyw.platform.module.cmdb.spatial.service;

import com.cwgsyw.platform.common.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpatialAssetServiceTest {
    @Test
    void recognizesPngByBytesInsteadOfFilenameOrClaimedMimeType() {
        byte[] png = new byte[24];
        png[0] = (byte) 0x89; png[1] = 0x50; png[2] = 0x4e; png[3] = 0x47;
        png[16] = 0; png[17] = 0; png[18] = 3; png[19] = (byte) 0x20;
        png[20] = 0; png[21] = 0; png[22] = 2; png[23] = 0x58;

        var result = SpatialAssetService.inspect(png);

        assertThat(result.contentType()).isEqualTo("image/png");
        assertThat(result.width()).isEqualTo(800);
        assertThat(result.height()).isEqualTo(600);
    }

    @Test
    void rejectsSvgHtmlAndExtensionSpoofedContent() {
        assertThatThrownBy(() -> SpatialAssetService.inspect("<svg onload=alert(1)>".getBytes()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("参考图仅支持 PNG、JPEG 或 WebP 格式");
    }
}
