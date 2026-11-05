package com.cwgsyw.platform.module.sosreport.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/** 分片上传接口的请求和响应。 */
public final class SosUploadDtos {

    private SosUploadDtos() {
    }

    @Data
    public static class StartUploadRequest {
        private String fileName;
        private Long fileSize;
        /** 可选。浏览器不支持摘要计算时不传。 */
        private String sha256;
    }

    @Data
    @AllArgsConstructor
    public static class UploadSessionVO {
        private String uploadId;
        private int chunkSize;
        private int chunkCount;
    }
}
