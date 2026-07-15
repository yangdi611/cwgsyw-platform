package com.cwgsyw.platform.module.ipam;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.ipam.dto.AllocateIpRequest;
import com.cwgsyw.platform.module.ipam.dto.CreateIpPoolRequest;
import com.cwgsyw.platform.module.ipam.entity.IpAllocation;
import com.cwgsyw.platform.module.ipam.entity.IpPool;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IpPoolServiceTest {
    @Mock private IpPoolMapper ipPoolMapper;
    @Mock private IpAllocationMapper ipAllocationMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private UserMapper userMapper;
    @Mock private ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @InjectMocks private IpPoolService service;

    @Test
    void groupScopeUsesCallerGroupAndRejectsOtherGroup() {
        CreateIpPoolRequest request = request("10.20.0.7/30", 2L);

        assertThatThrownBy(() -> service.create(request, "default", 1L, 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("组级用户只能创建本组地址池");

        request.setGroupId(null);
        when(ipPoolMapper.selectList(any())).thenReturn(java.util.List.of());
        service.create(request, "default", 1L, 3L, "group");

        ArgumentCaptor<IpPool> poolCaptor = ArgumentCaptor.forClass(IpPool.class);
        verify(ipPoolMapper).insert(poolCaptor.capture());
        assertThat(poolCaptor.getValue().getGroupId()).isEqualTo(3L);
        assertThat(poolCaptor.getValue().getCidr()).isEqualTo("10.20.0.4/30");
    }

    @Test
    void tenantScopeRequiresAnOwnerGroupAndRejectsCidrOverlap() {
        CreateIpPoolRequest request = request("10.20.0.0/30", null);
        assertThatThrownBy(() -> service.create(request, "default", 1L, null, "tenant"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("请选择地址池归属用户组");

        request.setGroupId(2L);
        IpPool existing = pool("10.20.0.0/30", 2L);
        when(ipPoolMapper.selectList(any())).thenReturn(java.util.List.of(existing));
        assertThatThrownBy(() -> service.create(request("10.20.0.2/31", 2L), "default", 1L, null, "tenant"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("CIDR 与现有地址池重复或重叠");
        verify(ipPoolMapper, never()).insert(any(IpPool.class));
    }

    @Test
    void createRejectsInvalidGatewayDnsAndNetworkAddresses() {
        CreateIpPoolRequest invalidGateway = request("10.20.1.0/30", 2L);
        invalidGateway.setGateway("not-an-ip");
        assertThatThrownBy(() -> service.create(invalidGateway, "default", 1L, null, "tenant"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("无效的 IPv4 地址");

        IpPool pool = pool("10.20.1.0/30", 2L);
        when(ipPoolMapper.selectById(10L)).thenReturn(pool);
        AllocateIpRequest allocation = new AllocateIpRequest();
        allocation.setIpAddress("10.20.1.0");
        assertThatThrownBy(() -> service.allocate(10L, allocation, "default", 1L, null, "tenant"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("IP 不能是 CIDR 的网络地址或广播地址");
        allocation.setIpAddress("10.20.1.3");
        assertThatThrownBy(() -> service.allocate(10L, allocation, "default", 1L, null, "tenant"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("IP 不能是 CIDR 的网络地址或广播地址");
    }

    @Test
    void allocateReusesReleasedAllocationWithoutNewInsert() {
        IpPool pool = pool("10.20.2.0/30", 2L);
        IpAllocation released = new IpAllocation();
        released.setId(8L);
        released.setPoolId(10L);
        released.setIpAddress("10.20.2.1");
        released.setStatus("released");
        when(ipPoolMapper.selectById(10L)).thenReturn(pool);
        when(ipAllocationMapper.findByPoolAndIp(10L, "10.20.2.1")).thenReturn(released);
        AllocateIpRequest request = new AllocateIpRequest();
        request.setIpAddress("10.20.2.1");

        service.allocate(10L, request, "default", 1L, null, "tenant");

        assertThat(released.getStatus()).isEqualTo("allocated");
        verify(ipAllocationMapper).updateById(released);
        verify(ipAllocationMapper, never()).insert(any(IpAllocation.class));
    }

    @Test
    void groupScopeRejectsOtherGroupsPoolWithoutWriting() {
        IpPool pool = pool("10.20.3.0/30", 2L);
        when(ipPoolMapper.selectById(10L)).thenReturn(pool);
        assertThatThrownBy(() -> service.utilization(10L, "default", 3L, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("无权访问该地址池");
        verifyNoInteractions(ipAllocationMapper, auditLogMapper);
    }

    private CreateIpPoolRequest request(String cidr, Long groupId) {
        CreateIpPoolRequest request = new CreateIpPoolRequest();
        request.setName("test-pool");
        request.setCidr(cidr);
        request.setGroupId(groupId);
        return request;
    }

    private IpPool pool(String cidr, Long groupId) {
        IpPool pool = new IpPool();
        pool.setId(10L);
        pool.setTenantId("default");
        pool.setGroupId(groupId);
        pool.setCidr(cidr);
        pool.setStatus("active");
        pool.setTotalCount(2);
        pool.setAllocatedCount(0);
        pool.setIsDeleted(false);
        return pool;
    }
}
