package com.cwgsyw.platform.module.sosreport;

import com.cwgsyw.platform.module.sosreport.entity.SosUploadSession;
import com.cwgsyw.platform.module.sosreport.mapper.SosUploadSessionMapper;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 在真实 PostgreSQL 上执行 Mapper 的 SQL 和迁移里的约束。需要 Docker。 */
@Testcontainers
class SosUploadSessionMapperIntegrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_sos_upload_it")
        .withUsername("fqa")
        .withPassword("fqa");

    private static SqlSessionFactory sqlSessionFactory;
    private static JdbcTemplate jdbcTemplate;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .validateOnMigrate(false)
            .load()
            .migrate();

        DriverManagerDataSource dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbcTemplate = new JdbcTemplate(dataSource);
        Configuration configuration = new Configuration(new Environment(
            "sos-upload-test", new JdbcTransactionFactory(), dataSource));
        configuration.setMapUnderscoreToCamelCase(true);
        configuration.addMapper(SosUploadSessionMapper.class);
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    private static String insert(String status, LocalDateTime expiresAt) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
            INSERT INTO sos_upload_session (id, tenant_id, file_name, file_size, chunk_size, chunk_count, status, created_by, expires_at)
            VALUES (?, 'tenant-a', 'a.tar.xz', 2097152, 1048576, 2, ?, 7, ?)
            """, id, status, expiresAt);
        return id;
    }

    private static String status(String id) {
        return jdbcTemplate.queryForObject("SELECT status FROM sos_upload_session WHERE id = ?", String.class, id);
    }

    private static int count(String id) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sos_upload_session WHERE id = ?", Integer.class, id);
    }

    private interface Work {
        void run(SosUploadSessionMapper mapper);
    }

    private static void inSession(Work work) {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            work.run(session.getMapper(SosUploadSessionMapper.class));
        }
    }

    @Test
    void onlyAnActiveUnexpiredSessionCanBeTouchedOrClaimed() {
        LocalDateTime now = LocalDateTime.now();
        String active = insert("uploading", now.plusMinutes(5));
        String expired = insert("uploading", now.minusMinutes(1));
        String assembling = insert("assembling", now.plusMinutes(5));

        inSession(mapper -> {
            assertEquals(1, mapper.touch(active, now, now.plusMinutes(60)));
            assertEquals(0, mapper.touch(expired, now, now.plusMinutes(60)), "过期后不能续期，否则清理和写入会互相覆盖");
            assertEquals(0, mapper.touch(assembling, now, now.plusMinutes(60)));

            assertEquals(1, mapper.claimForAssembly(active, now, now.plusMinutes(10)));
            assertEquals(0, mapper.claimForAssembly(active, now, now.plusMinutes(10)), "第二个完成请求必须失败");
            assertEquals(0, mapper.claimForAssembly(expired, now, now.plusMinutes(10)));
        });
        assertEquals("assembling", status(active));
    }

    @Test
    void assemblyCanBeReleasedOrCompleted() {
        LocalDateTime now = LocalDateTime.now();
        String released = insert("assembling", now.plusMinutes(5));
        String completed = insert("assembling", now.plusMinutes(5));
        String leaseExpired = insert("assembling", now.minusMinutes(1));

        inSession(mapper -> {
            assertEquals(1, mapper.releaseAssembly(released, now, now.plusMinutes(60)));
            assertEquals(1, mapper.markCompleted(completed, 42L, now, now.plusMinutes(60)));
            assertEquals(0, mapper.markCompleted(completed, 42L, now, now.plusMinutes(60)));
            assertEquals(0, mapper.markCompleted(leaseExpired, 42L, now, now.plusMinutes(60)), "租约过期后清理任务可能已经在删除文件");
        });
        assertEquals("uploading", status(released));
        assertEquals("completed", status(completed));
        assertEquals(42L, jdbcTemplate.queryForObject("SELECT report_id FROM sos_upload_session WHERE id = ?", Long.class, completed));
    }

    @Test
    void purgeFindsExpiredSessionsAndSparesOnesThatWereRenewed() {
        LocalDateTime now = LocalDateTime.now();
        String expired = insert("uploading", now.minusMinutes(1));
        String renewed = insert("uploading", now.plusMinutes(5));
        String cancelled = insert("uploading", now.plusMinutes(5));

        inSession(mapper -> {
            assertEquals(1, mapper.expireNow(cancelled, now));

            List<SosUploadSession> found = mapper.findExpired(now, 1000);
            SosUploadSession row = found.stream().filter(session -> expired.equals(session.getId())).findFirst().orElseThrow();
            assertEquals(2, row.getChunkCount());
            assertEquals("tenant-a", row.getTenantId());
            assertEquals("uploading", row.getStatus(), "清理任务靠状态判断合并结果归谁所有");
            assertTrue(found.stream().noneMatch(session -> renewed.equals(session.getId())));
            assertTrue(found.stream().anyMatch(session -> cancelled.equals(session.getId())));

            assertEquals(1, mapper.deleteExpired(expired, now));
            assertEquals(1, mapper.deleteExpired(cancelled, now));
            assertEquals(0, mapper.deleteExpired(renewed, now));
        });
        assertEquals(0, count(expired));
        assertEquals(1, count(renewed));
    }
}
