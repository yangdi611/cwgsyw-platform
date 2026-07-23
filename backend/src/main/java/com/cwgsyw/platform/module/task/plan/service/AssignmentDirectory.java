package com.cwgsyw.platform.module.task.plan.service;

import java.time.LocalDate;
import java.util.List;

public interface AssignmentDirectory {
    List<UserSubject> findAllUsers(String tenantId);

    List<UserSubject> findUsers(String tenantId, List<Long> userIds);

    List<GroupSubject> findGroups(String tenantId, List<Long> groupIds);

    List<UserSubject> findGroupMembers(String tenantId, List<Long> groupIds);

    List<UserSubject> findGroupLeaders(String tenantId, List<Long> groupIds);

    List<UserSubject> findDutyUsers(String tenantId, List<Long> groupIds, LocalDate dutyDate);

    record UserSubject(Long userId, String username, String realName, Long groupId, String groupName) {
    }

    record GroupSubject(Long groupId, String groupCode, String groupName, Long leaderId, String leaderName) {
    }
}
