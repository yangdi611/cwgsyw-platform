package com.cwgsyw.platform.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
public class SecurityUser implements UserDetails {
    private final Long userId;
    private final String username;
    private final String password;
    private final String tenantId;
    private final Long groupId;
    private final String groupScope;   // "group" | "tenant" | "platform"
    private final Set<String> permissions;
    private final Collection<? extends GrantedAuthority> authorities;

    /** 当前必须完成的强制动作（CHANGE_PASSWORD / COMPLETE_PROFILE），见 RequiredActionResolver。 */
    private final List<String> requiredActions;

    /** 当前请求所用的可撤销会话 id（来自 JWT），由 JwtAuthFilter 加载完 UserDetails 后回填。见 SPEC 10.5。 */
    @Setter
    private String sessionId;

    public SecurityUser(Long userId, String username, String password,
                        String tenantId, Long groupId, String groupScope, Set<String> permissions) {
        this(userId, username, password, tenantId, groupId, groupScope, permissions, List.of());
    }

    public SecurityUser(Long userId, String username, String password,
                        String tenantId, Long groupId, String groupScope, Set<String> permissions,
                        List<String> requiredActions) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.tenantId = tenantId;
        this.groupId = groupId;
        this.groupScope = groupScope != null ? groupScope : "group";
        this.permissions = permissions;
        this.authorities = permissions.stream()
            .map(SimpleGrantedAuthority::new)
            .collect(Collectors.toSet());
        this.requiredActions = requiredActions != null ? requiredActions : List.of();
    }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public String getPassword()  { return password; }
    @Override public String getUsername()  { return username; }
    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}
