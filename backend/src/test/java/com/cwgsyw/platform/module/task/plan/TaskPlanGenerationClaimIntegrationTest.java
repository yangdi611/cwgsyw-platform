package com.cwgsyw.platform.module.task.plan;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class TaskPlanGenerationClaimIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("task_plan_claim").withUsername("task").withPassword("task");
    private static JdbcTemplate jdbc;
    private static Long planId;

    @BeforeAll
    static void migrate() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("classpath:db/migration").load().migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        Long versionId = jdbc.queryForObject("SELECT latest_version_id FROM task_template WHERE code = 'simple_task'", Long.class);
        planId = jdbc.queryForObject("""
            INSERT INTO task_plan (tenant_id, name, template_version_id, schedule_type, schedule_config,
              generation_mode, assignment_rule, status)
            VALUES ('default', '并发测试', ?, 'daily', '{}'::jsonb, 'single', '{}'::jsonb, 'active')
            RETURNING id
            """, Long.class, versionId);
    }

    @Test
    void concurrentClaimCreatesOnlyOneGenerationRecord() throws Exception {
        int workers = 8;
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Callable<Integer>> calls = new ArrayList<>();
        for (int i = 0; i < workers; i++) {
            calls.add(() -> {
                ready.countDown();
                start.await();
                return jdbc.update("""
                    INSERT INTO task_plan_generation
                      (tenant_id, plan_id, occurrence_key, occurrence_at, subject_type, subject_id, status, attempt_count)
                    VALUES ('default', ?, '20260723090000:user:1', ?, 'user', 1, 'pending', 1)
                    ON CONFLICT (tenant_id, plan_id, occurrence_key) DO NOTHING
                    """, planId, LocalDateTime.of(2026, 7, 23, 9, 0));
            });
        }
        try (var executor = Executors.newFixedThreadPool(workers)) {
            var futures = calls.stream().map(executor::submit).toList();
            ready.await();
            start.countDown();
            List<Integer> results = futures.stream().map(future -> {
                try { return future.get(); } catch (Exception exception) { throw new RuntimeException(exception); }
            }).toList();
            assertThat(results).containsExactlyInAnyOrder(1, 0, 0, 0, 0, 0, 0, 0);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM task_plan_generation WHERE plan_id = ?", Integer.class, planId)).isEqualTo(1);
    }
}
