package com.cwgsyw.platform.module.backup.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("backup_record")
public class BackupRecord extends BaseEntity {
    /** 备份文件名（含时间戳） */
    private String fileName;
    /** 备份文件在磁盘上的绝对路径 */
    private String filePath;
    /** 备份文件大小（字节） */
    private Long fileSizeBytes;
    /** running / success / failed */
    private String status;
    /** manual / scheduled */
    private String backupType;
    /** 失败时的错误信息 */
    private String errorMessage;
}
