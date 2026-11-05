package com.cwgsyw.platform.module.sosreport.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 分片上传的临时状态。没有业务数据，过期后物理删除，所以不继承 BaseEntity，也不做软删除。
 * 上传成功的审计记录写在 {@code sos_report} 上。
 */
@Data
@TableName("sos_upload_session")
public class SosUploadSession {
    public static final String STATUS_UPLOADING = "uploading";
    public static final String STATUS_ASSEMBLING = "assembling";
    public static final String STATUS_COMPLETED = "completed";

    @TableId(type = IdType.INPUT)
    private String id;
    private String tenantId;
    private String fileName;
    private Long fileSize;
    private Integer chunkSize;
    private Integer chunkCount;
    private String expectedSha256;
    private String status;
    private Long reportId;
    private Long createdBy;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
