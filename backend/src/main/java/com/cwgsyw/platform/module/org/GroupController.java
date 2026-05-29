package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private final GroupMapper groupMapper;

    @GetMapping
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<Group>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupMapper.selectList(
            new LambdaQueryWrapper<Group>().eq(Group::getTenantId, cu.getTenantId())));
    }

    @PostMapping
    @PreAuthorize("hasPermission('group', 'create')")
    public R<Group> create(@RequestBody Group group,
                           @AuthenticationPrincipal SecurityUser cu) {
        group.setTenantId(cu.getTenantId());
        groupMapper.insert(group);
        return R.ok(group);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody Group req) {
        req.setId(id);
        groupMapper.updateById(req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        Group group = groupMapper.selectById(id);
        if (group == null) throw new IllegalArgumentException("组不存在: " + id);
        groupMapper.deleteById(id);
        return R.ok();
    }
}
