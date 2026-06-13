package com.cwgsyw.platform.module.cmdb.mapper;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the recursive-CTE parameter-binding fix in
 * {@link CiInstanceRelMapper#findTopologyEdges}.
 *
 * <p>Root cause being prevented: the PostgreSQL JDBC driver (42.7.x) miscounts
 * JDBC placeholders when the same MyBatis named parameter (e.g. {@code #{rootId}})
 * is referenced more than once inside a {@code WITH RECURSIVE} statement, raising
 * {@code org.postgresql.util.PSQLException: No value specified for parameter N}.
 *
 * <p>The workaround funnels each value through a {@code params} CTE and references
 * it by alias thereafter, so every {@code #{param}} appears exactly once in the
 * statement. These tests pin that invariant against regressions.
 */
class CiInstanceRelMapperTest {

    private static final Pattern PARAM_PATTERN = Pattern.compile("#\\{(\\w+)\\}");

    /** {@code @Param} names declared on findTopologyEdges(...) . */
    private static List<String> declaredParamNames() throws Exception {
        List<String> names = new ArrayList<>();
        for (Parameter p : CiInstanceRelMapper.class
                .getMethod("findTopologyEdges", Long.class, String.class, int.class)
                .getParameters()) {
            Param param = p.getAnnotation(Param.class);
            assertThat(param).as("parameter must carry @Param").isNotNull();
            names.add(param.value());
        }
        return names;
    }

    /** The raw SQL text of the {@link Select} annotation. */
    private static String selectSql() throws Exception {
        Method method = CiInstanceRelMapper.class
                .getMethod("findTopologyEdges", Long.class, String.class, int.class);
        Select select = method.getAnnotation(Select.class);
        assertThat(select).as("@Select present").isNotNull();
        // MyBatis concatenates multi-line text blocks with spaces; value()[0] is the single SQL string.
        return select.value()[0];
    }

    /** name -> number of #{name} occurrences in the SQL. */
    private static Map<String, Long> parameterCounts(String sql) {
        Map<String, Long> counts = new TreeMap<>();
        Matcher m = PARAM_PATTERN.matcher(sql);
        while (m.find()) {
            counts.merge(m.group(1), 1L, Long::sum);
        }
        return counts;
    }

    @Test
    void eachMyBatisParameterAppearsExactlyOnce() throws Exception {
        // If this fails it almost certainly reintroduces
        // "No value specified for parameter N" from PG JDBC's recursive-CTE handling.
        Map<String, Long> counts = parameterCounts(selectSql());
        assertThat(counts)
                .as("every #{} binding must occur exactly once (rootId, tenantId, maxDepth)")
                .hasSize(3)
                .containsEntry("rootId", 1L)
                .containsEntry("tenantId", 1L)
                .containsEntry("maxDepth", 1L);
    }

    @Test
    void sqlBindingsMatchDeclaredParams() throws Exception {
        // Catches drift between the method signature's @Param names and what the SQL binds.
        assertThat(parameterCounts(selectSql()).keySet())
                .as("SQL must bind exactly the declared @Param names")
                .containsExactlyInAnyOrderElementsOf(declaredParamNames());
    }

    @Test
    void usesParamsCteWorkaround() throws Exception {
        // The params CTE is what makes "each parameter once" possible for a self-referencing CTE.
        String sql = selectSql();
        assertThat(sql).containsIgnoringCase("params AS (");
        assertThat(sql).containsIgnoringCase("WITH RECURSIVE");
        assertThat(sql).contains("p_root_id", "p_tenant_id", "p_max_depth");
    }
}
