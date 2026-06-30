package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskDetailVO {
    private TaskVO task;
    private String content;
    private String resultSummary;
    private String closeReason;
    private LocalDateTime confirmedAt;
    private String confirmedByName;
    private LocalDateTime startedAt;
    private String completedByName;
    private List<ParticipantVO> participants;
    private List<ChecklistItemVO> checklist;
    private List<TaskLinkVO> links;
    private List<TaskLogVO> logs;
    // action gates
    private Boolean canConfirm;
    private Boolean canStart;
    private Boolean canComplete;
    private Boolean canCancel;
    private Boolean canCloseException;
    private Boolean canEdit;

    @Data
    public static class ParticipantVO {
        private Long userId;
        private String userName;
        private String role;
    }

    @Data
    public static class ChecklistItemVO {
        private Long id;
        private String title;
        private Boolean required;
        private String inputType;
        private String options;
        private String value;
        private Boolean checked;
        private Integer sortOrder;
    }

    @Data
    public static class TaskLinkVO {
        private Long id;
        private String linkType;
        private Long linkId;
        private String linkTitle;
        private String linkUrl;
    }

    @Data
    public static class TaskLogVO {
        private Long id;
        private String action;
        private Long operatorId;
        private String operatorName;
        private String content;
        private LocalDateTime createdAt;
    }
}
