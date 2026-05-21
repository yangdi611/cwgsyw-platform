package com.cwgsyw.platform.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
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

    public SecurityUser(Long userId, String username, String password,
                        String tenantId, Long groupId, String groupScope, Set<String> permissions) {
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
    }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public String getPassword()  { return password; }
    @Override public String getUsername()  { return username; }
    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}
