package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthorizationResourceMigrationGroupReferenceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @Test
    void initializeCreatedResourceValidatesOwnerGroupBeforeResourceMutation() {
        AuthorizationResourceMigrationService service =
            new AuthorizationResourceMigrationService(jdbcTemplate, activeGroupReferenceValidator);

        service.initializeCreatedResource("default", "wiki_space", 8L, 7L, 4L, 02770);

        InOrder order = inOrder(activeGroupReferenceValidator, jdbcTemplate);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 4L);
        order.verify(jdbcTemplate).update(anyString(), eq(7L), eq(4L), eq(02770), eq(8L), eq("default"));
        verify(activeGroupReferenceValidator).lockAndRequire("default", 4L);
    }
}
