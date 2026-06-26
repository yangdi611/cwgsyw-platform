package com.cwgsyw.platform.module.system;

import com.cwgsyw.platform.common.R;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 系统信息：暴露实际数据库 schema 版本（取自 flyway_schema_history），
 * 供前端 Sidebar 动态展示，避免硬编码版本号过时。
 * 走默认 authenticated()，任意登录用户可读。
 */
@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemInfoController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/info")
    public R<Map<String, Object>> info() {
        Map<String, Object> data = new HashMap<>();
        String schemaVersion = null;
        try {
            schemaVersion = jdbcTemplate.queryForObject(
                "SELECT version FROM flyway_schema_history " +
                "WHERE success = true AND version IS NOT NULL " +
                "ORDER BY installed_rank DESC LIMIT 1",
                String.class);
        } catch (Exception ignored) {
            // flyway_schema_history 缺失或查询失败时静默返回 null，前端兜底显示
        }
        data.put("schema_version", schemaVersion);
        return R.ok(data);
    }
}
