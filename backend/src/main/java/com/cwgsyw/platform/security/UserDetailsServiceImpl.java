package com.cwgsyw.platform.security;

import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    private final UserMapper userMapper;
    private final RbacService rbacService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + username));
        Set<String> permissions = rbacService.getUserPermissions(user.getId());
        String highestScope = rbacService.getHighestScope(user.getId());
        return new SecurityUser(user.getId(), user.getUsername(), user.getPassword(),
            user.getTenantId(), user.getGroupId(), highestScope, permissions);
    }
}
