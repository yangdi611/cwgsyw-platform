package com.cwgsyw.platform.module.task.template;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplate;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateField;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateFieldMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class TaskTemplateSchemaRoundtripIntegrationTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("task_template_roundtrip")
        .withUsername("template")
        .withPassword("template");

    private static SqlSessionFactory sqlSessionFactory;

    @BeforeAll
    static void prepareDatabase() throws Exception {
        String jdbcUrl = POSTGRES.getJdbcUrl() + "&stringtype=unspecified";
        Flyway.configure()
            .dataSource(jdbcUrl, POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("classpath:db/migration")
            .load()
            .migrate();

        DriverManagerDataSource dataSource = new DriverManagerDataSource(
            jdbcUrl, POSTGRES.getUsername(), POSTGRES.getPassword());
        MybatisConfiguration configuration = new MybatisConfiguration();
        configuration.setMapUnderscoreToCamelCase(true);
        configuration.addMapper(TaskTemplateMapper.class);
        configuration.addMapper(TaskTemplateVersionMapper.class);
        configuration.addMapper(TaskTemplateFieldMapper.class);
        MybatisSqlSessionFactoryBean factoryBean = new MybatisSqlSessionFactoryBean();
        factoryBean.setDataSource(dataSource);
        factoryBean.setConfiguration(configuration);
        sqlSessionFactory = factoryBean.getObject();
    }

    @Test
    void preservesCompleteDynamicFormSchema() {
        try (SqlSession session = sqlSessionFactory.openSession(false)) {
            TaskTemplateMapper templateMapper = session.getMapper(TaskTemplateMapper.class);
            TaskTemplateVersionMapper versionMapper = session.getMapper(TaskTemplateVersionMapper.class);
            TaskTemplateFieldMapper fieldMapper = session.getMapper(TaskTemplateFieldMapper.class);

            TaskTemplate template = new TaskTemplate();
            template.setTenantId("roundtrip");
            template.setCode("database_inspection");
            template.setName("数据库巡检");
            template.setCategory("巡检");
            template.setStatus("draft");
            template.setBuiltin(false);
            template.setScopeType("tenant");
            template.setIsDeleted(false);
            template.setCreatedAt(LocalDateTime.now());
            template.setUpdatedAt(LocalDateTime.now());
            templateMapper.insert(template);

            TaskTemplateVersion version = new TaskTemplateVersion();
            version.setTenantId("roundtrip");
            version.setTemplateId(template.getId());
            version.setVersion(1);
            version.setStatus("draft");
            version.setNameSnapshot("数据库巡检");
            version.setLayoutSchema(Map.of("sections", List.of(
                Map.of("key", "result", "title", "巡检结果", "columns", 2))));
            version.setCompletionPolicy(Map.of("requireAllVisible", true));
            version.setDefaultAssignment(Map.of("mode", "per_user"));
            version.setDefaultReminder(Map.of("beforeDueMinutes", List.of(60, 15)));
            version.setCreatedAt(LocalDateTime.now());
            version.setUpdatedAt(LocalDateTime.now());
            versionMapper.insert(version);

            TaskTemplateField result = field("result", "single_select", 0);
            result.setTenantId("roundtrip");
            result.setTemplateVersionId(version.getId());
            result.setDefaultValue("normal");
            result.setValidationConfig(Map.of("options", List.of(
                Map.of("value", "normal", "label", "正常"),
                Map.of("value", "abnormal", "label", "异常"))));
            result.setDisplayConfig(Map.of("width", 6, "placeholder", "请选择结果"));
            result.setVisibilityConfig(Map.of(
                "executor", "read_write", "approver", "read", "analytics", true, "export", true));
            result.setAnalyticsConfig(Map.of(
                "enabled", true, "role", List.of("dimension"), "aggregation", "count"));
            fieldMapper.insert(result);

            TaskTemplateField count = field("inspection_count", "number", 1);
            count.setTenantId("roundtrip");
            count.setTemplateVersionId(version.getId());
            count.setDefaultValue(0);
            count.setValidationConfig(Map.of("min", 0, "scale", 0));
            count.setAnalyticsConfig(Map.of(
                "enabled", true, "role", List.of("metric"), "aggregation", "sum", "unit", "次"));
            fieldMapper.insert(count);

            TaskTemplateField details = field("details", "table", 2);
            details.setTenantId("roundtrip");
            details.setTemplateVersionId(version.getId());
            details.setValidationConfig(Map.of("columns", List.of(
                Map.of("key", "item", "label", "检查项", "type", "text", "required", true),
                Map.of("key", "duration", "label", "耗时", "type", "number", "required", false))));
            fieldMapper.insert(details);

            TaskTemplateField evidence = field("evidence", "file", 3);
            evidence.setTenantId("roundtrip");
            evidence.setTemplateVersionId(version.getId());
            evidence.setValidationConfig(Map.of("minCount", 1, "maxCount", 10, "allowedTypes", List.of("image/*", "text/plain")));
            evidence.setConditionConfig(Map.of(
                "requiredWhen", Map.of("op", "eq", "left", Map.of("field", "result"), "right", Map.of("literal", "abnormal"))));
            fieldMapper.insert(evidence);

            TaskTemplateField scope = field("ci_scope", "ci_scope", 4);
            scope.setTenantId("roundtrip");
            scope.setTemplateVersionId(version.getId());
            scope.setValidationConfig(Map.of(
                "allowModelGroups", true, "allowModels", true, "allowInstances", true, "maxCount", 200));
            fieldMapper.insert(scope);

            TaskTemplateField rate = field("pass_rate", "formula", 5);
            rate.setTenantId("roundtrip");
            rate.setTemplateVersionId(version.getId());
            rate.setFormulaConfig(Map.of(
                "op", "ROUND",
                "args", List.of(
                    Map.of("op", "DIVIDE", "onDivideByZero", "null", "args", List.of(
                        Map.of("field", "inspection_count"), Map.of("literal", 10))),
                    Map.of("literal", 2))));
            rate.setAnalyticsConfig(Map.of(
                "enabled", true, "role", List.of("metric"), "aggregation", "avg", "unit", "%"));
            fieldMapper.insert(rate);

            TaskTemplateField secret = field("secret_note", "textarea", 6);
            secret.setTenantId("roundtrip");
            secret.setTemplateVersionId(version.getId());
            secret.setSensitive(true);
            secret.setVisibilityConfig(Map.of(
                "executor", "read_write", "approver", "hidden", "analytics", false, "export", false));
            secret.setAnalyticsConfig(Map.of("enabled", false));
            fieldMapper.insert(secret);

            session.commit();
            session.clearCache();

            TaskTemplateVersion storedVersion = versionMapper.selectById(version.getId());
            List<TaskTemplateField> storedFields = fieldMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<TaskTemplateField>()
                    .eq(TaskTemplateField::getTemplateVersionId, version.getId())
                    .orderByAsc(TaskTemplateField::getSortOrder));

            assertThat(storedVersion.getLayoutSchema()).isEqualTo(version.getLayoutSchema());
            assertThat(storedVersion.getCompletionPolicy()).isEqualTo(version.getCompletionPolicy());
            assertThat(storedVersion.getDefaultAssignment()).isEqualTo(version.getDefaultAssignment());
            assertThat(storedVersion.getDefaultReminder()).isEqualTo(version.getDefaultReminder());
            assertThat(storedFields).extracting(TaskTemplateField::getFieldKey)
                .containsExactly("result", "inspection_count", "details", "evidence", "ci_scope", "pass_rate", "secret_note");
            assertThat(storedFields.get(0).getValidationConfig()).isEqualTo(result.getValidationConfig());
            assertThat(storedFields.get(2).getValidationConfig()).isEqualTo(details.getValidationConfig());
            assertThat(storedFields.get(3).getConditionConfig()).isEqualTo(evidence.getConditionConfig());
            assertThat(storedFields.get(5).getFormulaConfig()).isEqualTo(rate.getFormulaConfig());
            assertThat(storedFields.get(6).getVisibilityConfig()).isEqualTo(secret.getVisibilityConfig());
            assertThat(storedFields.get(6).getSensitive()).isTrue();
        }
    }

    private TaskTemplateField field(String key, String type, int order) {
        TaskTemplateField field = new TaskTemplateField();
        field.setFieldKey(key);
        field.setLabel(key);
        field.setFieldType(type);
        field.setSortOrder(order);
        field.setRequired(false);
        field.setSensitive(false);
        field.setCreatedAt(LocalDateTime.now());
        return field;
    }
}
