package com.cwgsyw.platform.module.audit;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.audit.dto.AuditLogVO;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('audit:read')")
    public R<PageResult<AuditLogVO>> list(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {

        Page<AuditLog> result = auditLogMapper.queryPage(
                new Page<>(page, size),
                user.getTenantId(), module, operatorId, startDate, endDate);

        Set<Long> operatorIds = result.getRecords().stream()
                .map(AuditLog::getOperatorId).collect(Collectors.toSet());
        Map<Long, String> names = operatorIds.isEmpty() ? Map.of() :
                userMapper.selectBatchIds(operatorIds).stream()
                        .collect(Collectors.toMap(
                                com.cwgsyw.platform.module.user.entity.User::getId,
                                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));

        return R.ok(PageResult.of(result.convert(log -> {
            AuditLogVO vo = new AuditLogVO();
            vo.setId(log.getId());
            vo.setModule(log.getModule());
            vo.setAction(log.getAction());
            vo.setTargetId(log.getTargetId());
            vo.setTargetType(log.getTargetType());
            vo.setOperatorId(log.getOperatorId());
            vo.setOperatorName(names.getOrDefault(log.getOperatorId(), String.valueOf(log.getOperatorId())));
            vo.setOperatorIp(log.getOperatorIp());
            vo.setRemark(log.getRemark());
            vo.setCreatedAt(log.getCreatedAt());
            return vo;
        })));
    }
}
