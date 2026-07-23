package com.cwgsyw.platform.module.task.workitem.dto;

public record WorkItemCountsVO(
    long execute,
    long approve,
    long initiated,
    long copied,
    long completed
) {
}
