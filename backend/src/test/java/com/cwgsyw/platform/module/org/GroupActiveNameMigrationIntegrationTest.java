package com.cwgsyw.platform.module.org;

import org.flywaydb.core.Flyway;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
class GroupActiveNameMigrationIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("cwgsyw_group_name_it")
        .withUsername("fqa")
        .withPassword("fqa");

    private static SqlSessionFactory sqlSessionFactory;

    @BeforeAll
    static void migrate() {
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .validateOnMigrate(false)
            .load()
            .migrate();

        DriverManagerDataSource dataSource = new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Configuration configuration = new Configuration(new Environment(
            "group-name-test", new JdbcTransactionFactory(), dataSource));
        configuration.addMapper(GroupMapper.class);
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
    }

    @Test
    void mapperConflictQuerySupportsNullCreateAndIdExclusion() throws SQLException {
        String name = unique("mapper");
        long groupId = insertReturningId("tenant-mapper", name, false);

        try (var session = sqlSessionFactory.openSession()) {
            GroupMapper mapper = session.getMapper(GroupMapper.class);
            assertEquals(1L, mapper.countActiveNameConflict("tenant-mapper", name, null));
            assertEquals(0L, mapper.countActiveNameConflict("tenant-mapper", name, groupId));
        }
    }

    @Test
    void activeTrimmedNameIsTenantUniqueWhileArchivedAndOtherTenantRemainReusable() throws SQLException {
        String name = unique("name");
        insert("tenant-a", name, false);

        assertThrows(SQLException.class, () -> insert("tenant-a", "  " + name + "  ", false));
        insert("tenant-b", name, false);
        insert("tenant-a", name, true);
    }

    @Test
    void concurrentActiveCreatesAllowExactlyOneWinner() throws Exception {
        String name = unique("concurrent");
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> first = executor.submit(() -> insertAfter(start, name));
            Future<Boolean> second = executor.submit(() -> insertAfter(start, name));
            start.countDown();

            int successes = (first.get() ? 1 : 0) + (second.get() ? 1 : 0);
            assertEquals(1, successes);
        }
    }

    private static boolean insertAfter(CountDownLatch start, String name) throws Exception {
        assertTrue(start.await(5, java.util.concurrent.TimeUnit.SECONDS));
        try {
            insert("tenant-concurrent", name, false);
            return true;
        } catch (SQLException exception) {
            assertEquals("23505", exception.getSQLState());
            return false;
        }
    }

    private static void insert(String tenantId, String name, boolean deleted) throws SQLException {
        try (Connection connection = connection();
             var statement = connection.prepareStatement("""
                 INSERT INTO sys_group
                     (tenant_id, code, name, group_type, is_builtin, is_deleted, created_at, updated_at)
                 VALUES (?, ?, ?, 'business', FALSE, ?, NOW(), NOW())
                 """)) {
            statement.setString(1, tenantId);
            statement.setString(2, unique("code"));
            statement.setString(3, name);
            statement.setBoolean(4, deleted);
            statement.executeUpdate();
        }
    }

    private static long insertReturningId(String tenantId, String name, boolean deleted) throws SQLException {
        try (Connection connection = connection();
             var statement = connection.prepareStatement("""
                 INSERT INTO sys_group
                     (tenant_id, code, name, group_type, is_builtin, is_deleted, created_at, updated_at)
                 VALUES (?, ?, ?, 'business', FALSE, ?, NOW(), NOW())
                 RETURNING id
                 """)) {
            statement.setString(1, tenantId);
            statement.setString(2, unique("code"));
            statement.setString(3, name);
            statement.setBoolean(4, deleted);
            try (var result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getLong(1);
            }
        }
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static String unique(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "");
    }
}
