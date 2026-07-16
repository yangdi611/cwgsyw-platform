package com.cwgsyw.platform.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import com.cwgsyw.platform.module.org.GroupLifecycleException;
import com.cwgsyw.platform.module.org.dto.GroupLifecycleErrorResponse;
import java.sql.SQLException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(GroupLifecycleException.class)
    public ResponseEntity<GroupLifecycleErrorResponse> handleGroupLifecycle(GroupLifecycleException ex) {
        return ResponseEntity.status(ex.getHttpStatus()).body(new GroupLifecycleErrorResponse(
            ex.getHttpStatus(), ex.getErrorCode(), ex.getMessage(), ex.getPreflight()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<R<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        DatabaseFailure failure = findDatabaseFailure(ex);
        if ("P7201".equals(failure.sqlState())
                || failure.contains("GROUP_REFERENCE_INACTIVE")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(R.fail(409, "GROUP_REFERENCE_INACTIVE", "目标用户组不存在、已归档或不可用于业务引用"));
        }
        if ("P7202".equals(failure.sqlState())
                || failure.contains("GROUP_REFERENCE_INVALID")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(R.fail(400, "GROUP_REFERENCE_INVALID", "用户组引用格式无效"));
        }
        if (failure.contains("WIKI_PAGE_SIBLING_TITLE_CONFLICT")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(R.fail(409, "WIKI_PAGE_SIBLING_TITLE_CONFLICT", "同级页面标题已存在"));
        }
        log.error("Unhandled data integrity violation", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(R.fail(409, "DATA_INTEGRITY_VIOLATION", "数据约束冲突"));
    }

    private DatabaseFailure findDatabaseFailure(Throwable root) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        Throwable current = root;
        StringBuilder messages = new StringBuilder();
        String fallbackSqlState = null;
        while (current != null && !visited.contains(current)) {
            if (current.getMessage() != null) {
                if (!messages.isEmpty()) messages.append('\n');
                messages.append(current.getMessage());
            }
            if (current instanceof SQLException sqlException) {
                SQLException next = sqlException;
                while (next != null && visited.add(next)) {
                    if (next.getMessage() != null) {
                        if (!messages.isEmpty()) messages.append('\n');
                        messages.append(next.getMessage());
                    }
                    if ("P7201".equals(next.getSQLState()) || "P7202".equals(next.getSQLState())) {
                        return new DatabaseFailure(next.getSQLState(), messages.toString());
                    }
                    if (fallbackSqlState == null) fallbackSqlState = next.getSQLState();
                    next = next.getNextException();
                }
            } else {
                visited.add(current);
            }
            current = current.getCause();
        }
        return new DatabaseFailure(fallbackSqlState, messages.toString());
    }

    private record DatabaseFailure(String sqlState, String messages) {
        private boolean contains(String marker) {
            return messages != null && messages.contains(marker);
        }
    }

    /** 业务异常：携带 errorCode + HTTP 状态（SPEC 9.5 / 13.6）。 */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<R<Void>> handleBusiness(BusinessException ex) {
        return ResponseEntity.status(ex.getHttpStatus())
            .body(R.fail(ex.getHttpStatus(), ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public R<Void> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining("; "));
        return R.fail(400, msg);
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public R<Void> handleAccessDenied(AccessDeniedException ex) {
        return R.fail(403, "无权限");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public R<Void> handleIllegalArg(IllegalArgumentException ex) {
        return R.fail(400, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public R<Void> handleIllegalState(IllegalStateException ex) {
        return R.fail(409, ex.getMessage());
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public R<Void> handleOptimisticLock(OptimisticLockingFailureException ex) {
        return R.fail(409, ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public R<Void> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return R.fail(500, "服务器内部错误");
    }
}
