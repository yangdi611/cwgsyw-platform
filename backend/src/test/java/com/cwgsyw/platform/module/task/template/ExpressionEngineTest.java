package com.cwgsyw.platform.module.task.template;

import com.cwgsyw.platform.module.task.template.form.ExpressionEngine;
import com.cwgsyw.platform.module.task.template.form.ExpressionException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExpressionEngineTest {
    private final ExpressionEngine engine = new ExpressionEngine();

    @Test
    void evaluatesControlledConditionAst() {
        Map<String, Object> expression = Map.of(
            "op", "and",
            "args", List.of(
                Map.of("op", "eq", "left", Map.of("field", "has_exception"), "right", Map.of("literal", true)),
                Map.of("op", "gte", "left", Map.of("field", "count"), "right", Map.of("literal", 2))));

        assertThat(engine.evaluateCondition(expression, Map.of("has_exception", true, "count", 3))).isTrue();
        assertThat(engine.references(expression)).containsExactlyInAnyOrder("has_exception", "count");
    }

    @Test
    void evaluatesFormulaWithBigDecimalAndRounding() {
        Map<String, Object> expression = Map.of(
            "op", "ROUND",
            "args", List.of(
                Map.of("op", "DIVIDE", "scale", 6, "args", List.of(
                    Map.of("field", "normal"), Map.of("field", "total"))),
                Map.of("literal", 2)));

        assertThat(engine.evaluateFormula(expression, Map.of("normal", 2, "total", 3)))
            .isEqualTo(new BigDecimal("0.67"));
    }

    @Test
    void divideByZeroFailsOrReturnsNullByPolicy() {
        Map<String, Object> strict = Map.of("op", "DIVIDE", "args", List.of(
            Map.of("literal", 1), Map.of("literal", 0)));
        assertThatThrownBy(() -> engine.evaluateFormula(strict, Map.of()))
            .isInstanceOf(ExpressionException.class)
            .hasMessage("公式除数不能为零");

        Map<String, Object> nullable = Map.of(
            "op", "DIVIDE", "onDivideByZero", "null",
            "args", List.of(Map.of("literal", 1), Map.of("literal", 0)));
        assertThat(engine.evaluateFormula(nullable, Map.of())).isNull();
    }

    @Test
    void rejectsUnknownOperator() {
        assertThatThrownBy(() -> engine.validateFormula(Map.of(
            "op", "EVAL", "args", List.of(Map.of("literal", "alert(1)")))))
            .isInstanceOf(ExpressionException.class)
            .hasMessageContaining("不支持的公式操作");
    }
}
