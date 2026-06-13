package com.cwgsyw.platform.module.cmdb.dto.changes;

import lombok.Data;

@Data
public class DailyCountVO {
    private String date;
    private int created;
    private int updated;
    private int deleted;
}
