package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc_snapshot")
public class ChangeDocSnapshot {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long changeDocId;
    private String snapshotJson;
    private Long operatorId;
    private String remark;
    private LocalDateTime createdAt;
}
