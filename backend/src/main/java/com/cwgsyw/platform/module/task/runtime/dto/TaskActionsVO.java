package com.cwgsyw.platform.module.task.runtime.dto;

public record TaskActionsVO(
    boolean canStart,
    boolean canEditDraft,
    boolean canSubmit,
    boolean canCancel,
    boolean canReassign,
    boolean canRemind,
    boolean canViewSensitive
) {
}
