package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class ChangeDocSubmitIdempotencySqlTest {
    @Test
    void submitLockIsTenantScopedAndSerializesStatusRead() throws NoSuchMethodException {
        Method method = ChangeDocMapper.class.getMethod("selectForUpdate", String.class, Long.class);
        String sql = String.join(" ", method.getAnnotation(Select.class).value());

        assertThat(sql).contains("id = #{id}", "tenant_id = #{tenantId}", "is_deleted = FALSE", "FOR UPDATE");
        Results results = method.getAnnotation(Results.class);
        assertThat(results).isNotNull();
        assertThat(results.value()).anySatisfy(result -> {
            assertThat(result.column()).isEqualTo("fields_data");
            assertThat(result.property()).isEqualTo("fieldsData");
            assertThat(result.typeHandler()).isEqualTo(JacksonTypeHandler.class);
        });
    }
}
