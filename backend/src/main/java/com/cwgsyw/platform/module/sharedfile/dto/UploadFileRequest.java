package com.cwgsyw.platform.module.sharedfile.dto;

import lombok.Data;
import java.util.List;

@Data
public class UploadFileRequest {
    private Long folderId;
    private List<Long> visibleGroups;
}
