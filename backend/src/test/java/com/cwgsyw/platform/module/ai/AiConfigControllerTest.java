package com.cwgsyw.platform.module.ai;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiConfigControllerTest {
    @Mock AiGatewayService aiGatewayService;

    @Test
    void testProviderReturnsSuccessfulReply() {
        when(aiGatewayService.testProvider("default", "deepseek")).thenReturn("ok");
        AiConfigController controller = new AiConfigController(aiGatewayService);

        assertThat(controller.testProvider("deepseek", user()).getData()).isEqualTo("ok");
    }

    @Test
    void testProviderMapsUpstreamFailureToStableBusinessError() {
        when(aiGatewayService.testProvider("default", "deepseek"))
                .thenThrow(new RuntimeException("upstream secret response"));
        AiConfigController controller = new AiConfigController(aiGatewayService);

        assertThatThrownBy(() -> controller.testProvider("deepseek", user()))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getHttpStatus()).isEqualTo(400);
                    assertThat(exception.getErrorCode()).isEqualTo("AI_PROVIDER_TEST_FAILED");
                    assertThat(exception.getMessage()).isEqualTo("AI 服务测试失败");
                });
    }

    private SecurityUser user() {
        return new SecurityUser(1L, "admin", "", "default", null, "platform", Set.of("ai_config:write"));
    }
}
