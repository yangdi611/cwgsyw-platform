package com.cwgsyw.platform.module.task.plan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class JdbcAssignmentDirectory implements AssignmentDirectory {
    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<UserSubject> findAllUsers(String tenantId) {
        return jdbcTemplate.query("""
            SELECT u.id, u.username, u.real_name, u.group_id, g.name AS group_name
            FROM sys_user u
            LEFT JOIN sys_group g ON g.id = u.group_id AND g.tenant_id = u.tenant_id AND g.is_deleted = FALSE
            WHERE u.tenant_id = ? AND u.is_deleted = FALSE AND u.status = 1
            ORDER BY u.id
            """, (resultSet, rowNum) -> new UserSubject(
                resultSet.getLong("id"), resultSet.getString("username"), resultSet.getString("real_name"),
                nullableLong(resultSet, "group_id"), resultSet.getString("group_name")), tenantId);
    }

    @Override
    public List<UserSubject> findUsers(String tenantId, List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return List.of();
        return named().query("""
            SELECT u.id, u.username, u.real_name, u.group_id, g.name AS group_name
            FROM sys_user u
            LEFT JOIN sys_group g ON g.id = u.group_id AND g.tenant_id = u.tenant_id AND g.is_deleted = FALSE
            WHERE u.tenant_id = :tenantId AND u.is_deleted = FALSE AND u.status = 1 AND u.id IN (:ids)
            ORDER BY u.id
            """, params(tenantId, userIds), (resultSet, rowNum) -> new UserSubject(
                resultSet.getLong("id"), resultSet.getString("username"), resultSet.getString("real_name"),
                nullableLong(resultSet, "group_id"), resultSet.getString("group_name")));
    }

    @Override
    public List<GroupSubject> findGroups(String tenantId, List<Long> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) return List.of();
        return named().query("""
            SELECT g.id, g.code, g.name, g.leader_id, u.real_name AS leader_name
            FROM sys_group g
            LEFT JOIN sys_user u ON u.id = g.leader_id AND u.tenant_id = g.tenant_id AND u.is_deleted = FALSE
            WHERE g.tenant_id = :tenantId AND g.is_deleted = FALSE AND g.id IN (:ids)
            ORDER BY g.id
            """, params(tenantId, groupIds), (resultSet, rowNum) -> new GroupSubject(
                resultSet.getLong("id"), resultSet.getString("code"), resultSet.getString("name"),
                nullableLong(resultSet, "leader_id"), resultSet.getString("leader_name")));
    }

    @Override
    public List<UserSubject> findGroupMembers(String tenantId, List<Long> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) return List.of();
        return named().query("""
            SELECT DISTINCT u.id, u.username, u.real_name,
                   COALESCE(u.group_id, membership.group_id) AS group_id, g.name AS group_name
            FROM sys_user u
            JOIN (
                SELECT user_id, group_id FROM sys_user_group_membership
                WHERE tenant_id = :tenantId AND is_deleted = FALSE AND group_id IN (:ids)
                UNION
                SELECT id AS user_id, group_id FROM sys_user
                WHERE tenant_id = :tenantId AND is_deleted = FALSE AND group_id IN (:ids)
            ) membership ON membership.user_id = u.id
            LEFT JOIN sys_group g ON g.id = membership.group_id AND g.tenant_id = :tenantId AND g.is_deleted = FALSE
            WHERE u.tenant_id = :tenantId AND u.is_deleted = FALSE AND u.status = 1
            ORDER BY u.id
            """, params(tenantId, groupIds), (resultSet, rowNum) -> new UserSubject(
                resultSet.getLong("id"), resultSet.getString("username"), resultSet.getString("real_name"),
                nullableLong(resultSet, "group_id"), resultSet.getString("group_name")));
    }

    @Override
    public List<UserSubject> findGroupLeaders(String tenantId, List<Long> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) return List.of();
        return named().query("""
            SELECT u.id, u.username, u.real_name, g.id AS group_id, g.name AS group_name
            FROM sys_group g
            JOIN sys_user u ON u.id = g.leader_id AND u.tenant_id = g.tenant_id
            WHERE g.tenant_id = :tenantId AND g.is_deleted = FALSE AND g.id IN (:ids)
              AND u.is_deleted = FALSE AND u.status = 1
            ORDER BY u.id
            """, params(tenantId, groupIds), (resultSet, rowNum) -> new UserSubject(
                resultSet.getLong("id"), resultSet.getString("username"), resultSet.getString("real_name"),
                resultSet.getLong("group_id"), resultSet.getString("group_name")));
    }

    @Override
    public List<UserSubject> findDutyUsers(String tenantId, List<Long> groupIds, LocalDate dutyDate) {
        MapSqlParameterSource parameters = new MapSqlParameterSource().addValue("tenantId", tenantId).addValue("dutyDate", dutyDate);
        String groupFilter = "";
        if (groupIds != null && !groupIds.isEmpty()) {
            parameters.addValue("ids", groupIds);
            groupFilter = " AND r.group_id IN (:ids)";
        }
        return named().query("""
            SELECT DISTINCT u.id, u.username, u.real_name, r.group_id, g.name AS group_name
            FROM ops_duty_roster r
            JOIN sys_user u ON u.id = r.assignee_id AND u.tenant_id = r.tenant_id
            LEFT JOIN sys_group g ON g.id = r.group_id AND g.tenant_id = r.tenant_id AND g.is_deleted = FALSE
            WHERE r.tenant_id = :tenantId AND r.is_deleted = FALSE AND r.duty_date = :dutyDate
              AND u.is_deleted = FALSE AND u.status = 1
            """ + groupFilter + " ORDER BY u.id", parameters, (resultSet, rowNum) -> new UserSubject(
                resultSet.getLong("id"), resultSet.getString("username"), resultSet.getString("real_name"),
                nullableLong(resultSet, "group_id"), resultSet.getString("group_name")));
    }

    private NamedParameterJdbcTemplate named() {
        return new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    private MapSqlParameterSource params(String tenantId, List<Long> ids) {
        return new MapSqlParameterSource(Map.of("tenantId", tenantId, "ids", ids));
    }

    private Long nullableLong(java.sql.ResultSet resultSet, String column) throws java.sql.SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }
}
