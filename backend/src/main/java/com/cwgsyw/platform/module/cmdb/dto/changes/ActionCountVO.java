package com.cwgsyw.platform.module.cmdb.dto.changes;

import lombok.Data;

@Data
public class ActionCountVO {
    private int created;
    private int updated;
    private int deleted;
    private int total;
}
