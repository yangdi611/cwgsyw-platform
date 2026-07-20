package com.cwgsyw.platform.common;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsWrappedInactiveSqlStateToConflict() {
        SQLException root = new SQLException("inactive group", "P7201");
        DataIntegrityViolationException exception = new DataIntegrityViolationException(
            "writer failed", new IllegalStateException("jdbc wrapper", root));

        ResponseEntity<R<Void>> response = handler.handleDataIntegrity(exception);

        assertEquals(409, response.getStatusCode().value());
        assertEquals("GROUP_REFERENCE_INACTIVE", response.getBody().getErrorCode());
    }

    @Test
    void mapsNestedInvalidSqlStateToBadRequest() {
        SQLException wrapper = new SQLException("batch failed", "99999");
        wrapper.setNextException(new SQLException("invalid group reference", "P7202"));
        DataIntegrityViolationException exception = new DataIntegrityViolationException(
            "writer failed", wrapper);

        ResponseEntity<R<Void>> response = handler.handleDataIntegrity(exception);

        assertEquals(400, response.getStatusCode().value());
        assertEquals("GROUP_REFERENCE_INVALID", response.getBody().getErrorCode());
    }

    @Test
    void preservesGenericIntegrityContractForUnrelatedViolation() {
        DataIntegrityViolationException exception = new DataIntegrityViolationException(
            "unique violation", new SQLException("duplicate", "23505"));

        ResponseEntity<R<Void>> response = handler.handleDataIntegrity(exception);

        assertEquals(409, response.getStatusCode().value());
        assertEquals("DATA_INTEGRITY_VIOLATION", response.getBody().getErrorCode());
    }

    @Test
    void mapsWikiSiblingTitleConflictToExplicitConflict() {
        DataIntegrityViolationException exception = new DataIntegrityViolationException(
            "writer failed", new SQLException("WIKI_PAGE_SIBLING_TITLE_CONFLICT", "23505"));

        ResponseEntity<R<Void>> response = handler.handleDataIntegrity(exception);

        assertEquals(409, response.getStatusCode().value());
        assertEquals("WIKI_PAGE_SIBLING_TITLE_CONFLICT", response.getBody().getErrorCode());
    }

    @Test
    void mapsConcurrentGroupNameConflictToBadRequest() {
        DataIntegrityViolationException exception = new DataIntegrityViolationException(
            "writer failed", new SQLException(
                "duplicate key violates unique constraint uq_sys_group_tenant_name_active", "23505"));

        ResponseEntity<R<Void>> response = handler.handleDataIntegrity(exception);

        assertEquals(400, response.getStatusCode().value());
        assertEquals("GROUP_ACTIVE_NAME_CONFLICT", response.getBody().getErrorCode());
    }

    @Test
    void mapsRequestParameterConversionFailureToBadRequest() {
        R<Void> response = handler.handleInputConversion(new MethodArgumentTypeMismatchException(
            "invalid", java.time.LocalDate.class, "startDate", null, new IllegalArgumentException()));

        assertEquals(400, response.getCode());
        assertEquals("参数格式错误", response.getMessage());
    }
}
