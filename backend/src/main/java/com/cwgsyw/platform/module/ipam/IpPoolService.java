package com.cwgsyw.platform.module.ipam;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.ipam.dto.*;
import com.cwgsyw.platform.module.ipam.entity.IpAllocation;
import com.cwgsyw.platform.module.ipam.entity.IpPool;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.InetAddress;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IpPoolService {
    private final IpPoolMapper ipPoolMapper;
    private final IpAllocationMapper ipAllocationMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public PageResult<IpPoolVO> list(String keyword, String status, int page, int size, String tenantId,
                                     Long callerGroupId, String callerGroupScope) {
        LambdaQueryWrapper<IpPool> query = new LambdaQueryWrapper<IpPool>()
                .eq(IpPool::getTenantId, tenantId)
                .eq(IpPool::getIsDeleted, false)
                .orderByDesc(IpPool::getCreatedAt);
        if ("group".equals(callerGroupScope)) {
            if (callerGroupId == null) {
                return PageResult.of(new Page<IpPool>(page, size).convert(this::toPoolVO));
            }
            query.eq(IpPool::getGroupId, callerGroupId);
        }
        if (keyword != null && !keyword.isBlank()) {
            query.and(w -> w.like(IpPool::getName, keyword)
                    .or().like(IpPool::getCidr, keyword)
                    .or().like(IpPool::getDescription, keyword));
        }
        if (status != null && !status.isBlank()) {
            query.eq(IpPool::getStatus, status);
        }
        Page<IpPool> p = ipPoolMapper.selectPage(new Page<>(page, size), query);
        return PageResult.of(p.convert(this::toPoolVO));
    }

    public IpPoolDetailVO getById(Long id, String tenantId, Long callerGroupId, String callerGroupScope) {
        IpPool pool = findPoolOrThrow(id, tenantId, callerGroupId, callerGroupScope);
        IpPoolDetailVO vo = new IpPoolDetailVO();
        fillPoolVO(pool, vo);

        List<IpAllocation> allocations = ipAllocationMapper.findByPoolId(id);
        // Batch resolve user names and CI instance names
        Map<Long, String> userNames = resolveUserNames(allocations);
        Map<Long, String> ciNames = resolveCiNames(allocations);

        vo.setAllocations(allocations.stream().map(a -> toAllocationVO(a, userNames, ciNames)).collect(Collectors.toList()));
        return vo;
    }

    @Transactional
    public IpPool create(CreateIpPoolRequest req, String tenantId, Long operatorId,
                         Long callerGroupId, String callerGroupScope) {
        Long ownerGroupId = resolveOwnerGroupId(req.getGroupId(), callerGroupId, callerGroupScope);
        activeGroupReferenceValidator.lockAndRequire(tenantId, ownerGroupId);
        String canonicalCidr = canonicalizeCidr(req.getCidr());
        validateGatewayAndDns(canonicalCidr, req.getGateway(), req.getDns());
        ipPoolMapper.lockTenantForCidrChange(tenantId);
        requireNoOverlappingPool(tenantId, canonicalCidr, null);
        int totalCount = calculateTotalFromCidr(canonicalCidr);

        IpPool pool = new IpPool();
        pool.setTenantId(tenantId);
        pool.setGroupId(ownerGroupId);
        pool.setName(req.getName());
        pool.setDescription(req.getDescription());
        pool.setCidr(canonicalCidr);
        pool.setGateway(req.getGateway());
        pool.setDns(req.getDns());
        pool.setStatus("active");
        pool.setTotalCount(totalCount);
        pool.setAllocatedCount(0);
        ipPoolMapper.insert(pool);

        writeAudit(tenantId, "create", pool.getId(), operatorId, "name=" + pool.getName() + " cidr=" + pool.getCidr());
        return pool;
    }

    @Transactional
    public void update(Long id, UpdateIpPoolRequest req, String tenantId, Long operatorId,
                       Long callerGroupId, String callerGroupScope) {
        IpPool pool = findPoolOrThrow(id, tenantId, callerGroupId, callerGroupScope);
        if (req.getName() != null) pool.setName(req.getName());
        if (req.getDescription() != null) pool.setDescription(req.getDescription());
        if (req.getGateway() != null) pool.setGateway(req.getGateway());
        if (req.getDns() != null) pool.setDns(req.getDns());
        validateGatewayAndDns(pool.getCidr(), pool.getGateway(), pool.getDns());
        ipPoolMapper.updateById(pool);
        writeAudit(tenantId, "update", id, operatorId, "name=" + pool.getName());
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId, Long callerGroupId, String callerGroupScope) {
        IpPool pool = findPoolOrThrow(id, tenantId, callerGroupId, callerGroupScope);
        // Check for active allocations
        int activeCount = ipPoolMapper.countAllocated(id);
        if (activeCount > 0) {
            throw new IllegalArgumentException("地址池中尚有 " + activeCount + " 个已分配的 IP，请先释放后再删除");
        }
        pool.setDeletedAt(LocalDateTime.now());
        pool.setDeletedBy(operatorId);
        ipPoolMapper.updateById(pool);
        ipPoolMapper.deleteById(id);
        writeAudit(tenantId, "delete", id, operatorId, "name=" + pool.getName());
    }

    @Transactional
    public IpAllocationVO allocate(Long poolId, AllocateIpRequest req, String tenantId, Long operatorId,
                                    Long callerGroupId, String callerGroupScope) {
        IpPool pool = findPoolOrThrow(poolId, tenantId, callerGroupId, callerGroupScope);
        if (!"active".equals(pool.getStatus())) {
            throw new IllegalArgumentException("地址池状态不是 active，无法分配");
        }

        String ipAddress = req.getIpAddress();
        if (ipAddress == null || ipAddress.isBlank()) {
            // Auto-assign next available IP
            ipAddress = findNextAvailableIp(pool.getCidr(), poolId);
            if (ipAddress == null) {
                throw new IllegalArgumentException("地址池已满，无可用 IP");
            }
        } else {
            // Validate IP belongs to the CIDR range
            requireAssignableHostIp(ipAddress, pool.getCidr());
            // Check if already allocated
            IpAllocation existing = ipAllocationMapper.findByPoolAndIp(poolId, ipAddress);
            if (existing != null && "allocated".equals(existing.getStatus())) {
                throw new IllegalArgumentException("IP " + ipAddress + " 已分配");
            }
        }

        IpAllocation existing = ipAllocationMapper.findByPoolAndIp(poolId, ipAddress);
        if (existing != null && "released".equals(existing.getStatus())) {
            reuseReleasedAllocation(existing, req, operatorId);
            incrementAllocationCount(pool);
            writeAudit(tenantId, "allocate", poolId, operatorId, "ip=" + ipAddress);
            return toAllocationVO(existing, resolveUserNames(List.of(existing)), resolveCiNames(List.of(existing)));
        }

        IpAllocation allocation = new IpAllocation();
        allocation.setTenantId(tenantId);
        allocation.setPoolId(poolId);
        allocation.setIpAddress(ipAddress);
        allocation.setStatus("allocated");
        allocation.setCiInstanceId(req.getCiInstanceId());
        allocation.setDescription(req.getDescription());
        allocation.setAllocatedBy(operatorId);
        allocation.setAllocatedAt(LocalDateTime.now());
        ipAllocationMapper.insert(allocation);

        // Update pool allocated count
        incrementAllocationCount(pool);

        writeAudit(tenantId, "allocate", poolId, operatorId, "ip=" + ipAddress);

        IpAllocationVO vo = new IpAllocationVO();
        vo.setId(allocation.getId());
        vo.setPoolId(poolId);
        vo.setIpAddress(ipAddress);
        vo.setStatus("allocated");
        vo.setCiInstanceId(req.getCiInstanceId());
        vo.setAllocatedBy(operatorId);
        vo.setAllocatedAt(allocation.getAllocatedAt());
        if (req.getCiInstanceId() != null) {
            CiInstance ci = ciInstanceMapper.selectById(req.getCiInstanceId());
            if (ci != null) vo.setCiInstanceName(ci.getName());
        }
        User operator = userMapper.selectById(operatorId);
        if (operator != null) vo.setAllocatedByName(operator.getUsername());
        return vo;
    }

    @Transactional
    public void release(Long poolId, ReleaseIpRequest req, String tenantId, Long operatorId,
                        Long callerGroupId, String callerGroupScope) {
        IpPool pool = findPoolOrThrow(poolId, tenantId, callerGroupId, callerGroupScope);

        IpAllocation allocation = ipAllocationMapper.findByPoolAndIp(poolId, req.getIpAddress());
        if (allocation == null || !"allocated".equals(allocation.getStatus())) {
            throw new IllegalArgumentException("IP " + req.getIpAddress() + " 未分配");
        }

        allocation.setStatus("released");
        allocation.setReleasedAt(LocalDateTime.now());
        ipAllocationMapper.updateById(allocation);

        // Update pool counts
        int newCount = Math.max(0, pool.getAllocatedCount() - 1);
        pool.setAllocatedCount(newCount);
        if ("full".equals(pool.getStatus())) {
            pool.setStatus("active");
        }
        ipPoolMapper.updateById(pool);

        writeAudit(tenantId, "release", poolId, operatorId, "ip=" + req.getIpAddress());
    }

    public IpPoolVO utilization(Long id, String tenantId, Long callerGroupId, String callerGroupScope) {
        IpPool pool = findPoolOrThrow(id, tenantId, callerGroupId, callerGroupScope);
        return toPoolVO(pool);
    }

    public List<IpAllocationVO> getByCiInstanceId(Long ciInstanceId, String tenantId,
                                                   Long callerGroupId, String callerGroupScope) {
        List<IpAllocation> allocations = ipAllocationMapper.findByCiInstanceId(ciInstanceId);
        Map<Long, String> userNames = resolveUserNames(allocations);
        Map<Long, String> ciNames = resolveCiNames(allocations);
        return allocations.stream()
                .filter(allocation -> canAccessPool(allocation.getPoolId(), tenantId, callerGroupId, callerGroupScope))
                .map(a -> toAllocationVO(a, userNames, ciNames))
                .collect(Collectors.toList());
    }

    // ---- CIDR calculation helpers ----

    int calculateTotalFromCidr(String cidr) {
        try {
            int prefixLength = parseCidr(cidr).prefixLength();

            if (prefixLength == 32) return 1;
            if (prefixLength == 31) return 2;
            long total = (1L << (32 - prefixLength)) - 2;
            if (total > Integer.MAX_VALUE) throw new IllegalArgumentException("CIDR 地址池过大");
            return (int) total;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("无效的 CIDR 格式: " + cidr);
        }
    }

    private String findNextAvailableIp(String cidr, Long poolId) {
        try {
            CidrRange range = parseCidr(cidr);
            int prefixLength = range.prefixLength();
            long networkInt = range.network();

            long hostCount;
            long startIp;
            if (prefixLength == 32) {
                return longToIp(networkInt);
            } else if (prefixLength == 31) {
                startIp = networkInt;
                hostCount = 2;
            } else {
                long broadcast = networkInt | ((1L << (32 - prefixLength)) - 1);
                startIp = networkInt + 1;
                hostCount = broadcast - 1; // exclusive upper bound
            }

            // Fetch all allocated IPs in this pool for efficient lookup
            List<IpAllocation> allocated = ipAllocationMapper.findByPoolId(poolId);
            Set<Long> allocatedSet = allocated.stream()
                    .filter(a -> "allocated".equals(a.getStatus()))
                    .map(a -> {
                        try {
                            return bytesToLong(InetAddress.getByName(a.getIpAddress()).getAddress());
                        } catch (Exception e) {
                            return -1L;
                        }
                    })
                    .collect(Collectors.toSet());

            long endIp = (prefixLength <= 30) ? networkInt + range.size() - 1 : startIp + hostCount;
            for (long ip = startIp; ip < endIp; ip++) {
                if (!allocatedSet.contains(ip)) {
                    return longToIp(ip);
                }
            }
            return null;
        } catch (Exception e) {
            throw new IllegalArgumentException("CIDR 解析失败: " + e.getMessage());
        }
    }

    private boolean ipBelongsToCidr(String ipAddress, String cidr) {
        try {
            CidrRange range = parseCidr(cidr);
            long ip = parseIpv4(ipAddress);
            return ip >= range.network() && ip <= range.broadcast();
        } catch (Exception e) {
            return false;
        }
    }

    private Long resolveOwnerGroupId(Long requestedGroupId, Long callerGroupId, String callerGroupScope) {
        if ("group".equals(callerGroupScope)) {
            if (callerGroupId == null) throw new IllegalArgumentException("组级用户缺少主组，无法创建地址池");
            if (requestedGroupId != null && !callerGroupId.equals(requestedGroupId)) {
                throw new IllegalArgumentException("组级用户只能创建本组地址池");
            }
            return callerGroupId;
        }
        if (requestedGroupId == null) throw new IllegalArgumentException("请选择地址池归属用户组");
        return requestedGroupId;
    }

    private void requireNoOverlappingPool(String tenantId, String cidr, Long excludedPoolId) {
        CidrRange requested = parseCidr(cidr);
        List<IpPool> existingPools = ipPoolMapper.selectList(new LambdaQueryWrapper<IpPool>()
                .eq(IpPool::getTenantId, tenantId)
                .eq(IpPool::getIsDeleted, false));
        boolean overlaps = existingPools.stream()
                .filter(pool -> !Objects.equals(pool.getId(), excludedPoolId))
                .map(IpPool::getCidr)
                .map(this::parseCidr)
                .anyMatch(existing -> requested.network() <= existing.broadcast() && existing.network() <= requested.broadcast());
        if (overlaps) throw new IllegalArgumentException("CIDR 与现有地址池重复或重叠");
    }

    private void validateGatewayAndDns(String cidr, String gateway, String dns) {
        if (gateway != null && !gateway.isBlank()) requireAssignableHostIp(gateway, cidr, "网关");
        if (dns != null && !dns.isBlank()) requireAssignableHostIp(dns, cidr, "DNS");
    }

    private void requireAssignableHostIp(String ipAddress, String cidr) {
        requireAssignableHostIp(ipAddress, cidr, "IP");
    }

    private void requireAssignableHostIp(String ipAddress, String cidr, String label) {
        CidrRange range = parseCidr(cidr);
        long ip = parseIpv4(ipAddress);
        if (ip < range.network() || ip > range.broadcast()) {
            throw new IllegalArgumentException(label + " " + ipAddress + " 不属于 CIDR " + cidr + " 的范围");
        }
        if (range.prefixLength() <= 30 && (ip == range.network() || ip == range.broadcast())) {
            throw new IllegalArgumentException(label + " 不能是 CIDR 的网络地址或广播地址");
        }
    }

    private void reuseReleasedAllocation(IpAllocation allocation, AllocateIpRequest req, Long operatorId) {
        allocation.setStatus("allocated");
        allocation.setCiInstanceId(req.getCiInstanceId());
        allocation.setDescription(req.getDescription());
        allocation.setAllocatedBy(operatorId);
        allocation.setAllocatedAt(LocalDateTime.now());
        allocation.setReleasedAt(null);
        ipAllocationMapper.updateById(allocation);
    }

    private void incrementAllocationCount(IpPool pool) {
        int newCount = pool.getAllocatedCount() + 1;
        pool.setAllocatedCount(newCount);
        if (newCount >= pool.getTotalCount()) pool.setStatus("full");
        ipPoolMapper.updateById(pool);
    }

    private boolean canAccessPool(Long poolId, String tenantId, Long callerGroupId, String callerGroupScope) {
        try {
            findPoolOrThrow(poolId, tenantId, callerGroupId, callerGroupScope);
            return true;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static long bytesToLong(byte[] bytes) {
        long result = 0;
        for (byte b : bytes) {
            result = (result << 8) | (b & 0xFF);
        }
        return result;
    }

    private static String longToIp(long ip) {
        return ((ip >> 24) & 0xFF) + "." +
                ((ip >> 16) & 0xFF) + "." +
                ((ip >> 8) & 0xFF) + "." +
                (ip & 0xFF);
    }

    // ---- VO conversion helpers ----

    private IpPoolVO toPoolVO(IpPool pool) {
        IpPoolVO vo = new IpPoolVO();
        fillPoolVO(pool, vo);
        return vo;
    }

    private void fillPoolVO(IpPool pool, IpPoolVO vo) {
        vo.setId(pool.getId());
        vo.setGroupId(pool.getGroupId());
        vo.setName(pool.getName());
        vo.setDescription(pool.getDescription());
        vo.setCidr(pool.getCidr());
        vo.setGateway(pool.getGateway());
        vo.setDns(pool.getDns());
        vo.setStatus(pool.getStatus());
        vo.setTotalCount(pool.getTotalCount());
        vo.setAllocatedCount(pool.getAllocatedCount());
        vo.setUtilizationPercent(pool.getTotalCount() == 0 ? 0.0
                : Math.round(pool.getAllocatedCount() * 10000.0 / pool.getTotalCount()) / 100.0);
        vo.setCreatedAt(pool.getCreatedAt());
        vo.setUpdatedAt(pool.getUpdatedAt());
    }

    private void fillPoolVO(IpPool pool, IpPoolDetailVO vo) {
        vo.setId(pool.getId());
        vo.setGroupId(pool.getGroupId());
        vo.setName(pool.getName());
        vo.setDescription(pool.getDescription());
        vo.setCidr(pool.getCidr());
        vo.setGateway(pool.getGateway());
        vo.setDns(pool.getDns());
        vo.setStatus(pool.getStatus());
        vo.setTotalCount(pool.getTotalCount());
        vo.setAllocatedCount(pool.getAllocatedCount());
        vo.setUtilizationPercent(pool.getTotalCount() == 0 ? 0.0
                : Math.round(pool.getAllocatedCount() * 10000.0 / pool.getTotalCount()) / 100.0);
        vo.setCreatedAt(pool.getCreatedAt());
        vo.setUpdatedAt(pool.getUpdatedAt());
    }

    private IpAllocationVO toAllocationVO(IpAllocation a, Map<Long, String> userNames, Map<Long, String> ciNames) {
        IpAllocationVO vo = new IpAllocationVO();
        vo.setId(a.getId());
        vo.setPoolId(a.getPoolId());
        vo.setIpAddress(a.getIpAddress());
        vo.setStatus(a.getStatus());
        vo.setCiInstanceId(a.getCiInstanceId());
        vo.setCiInstanceName(a.getCiInstanceId() != null ? ciNames.get(a.getCiInstanceId()) : null);
        vo.setDescription(a.getDescription());
        vo.setAllocatedBy(a.getAllocatedBy());
        vo.setAllocatedByName(a.getAllocatedBy() != null ? userNames.get(a.getAllocatedBy()) : null);
        vo.setAllocatedAt(a.getAllocatedAt());
        vo.setReleasedAt(a.getReleasedAt());
        vo.setCreatedAt(a.getCreatedAt());
        vo.setUpdatedAt(a.getUpdatedAt());
        return vo;
    }

    private IpPool findPoolOrThrow(Long id, String tenantId, Long callerGroupId, String callerGroupScope) {
        IpPool pool = ipPoolMapper.selectById(id);
        if (pool == null || pool.getIsDeleted() || !pool.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("地址池不存在");
        }
        if ("group".equals(callerGroupScope) && (callerGroupId == null || !callerGroupId.equals(pool.getGroupId()))) {
            throw new IllegalArgumentException("无权访问该地址池");
        }
        return pool;
    }

    private CidrRange parseCidr(String cidr) {
        try {
            String[] parts = cidr == null ? new String[0] : cidr.trim().split("/");
            if (parts.length != 2) throw new IllegalArgumentException("无效的 CIDR 格式");
            int prefixLength = Integer.parseInt(parts[1]);
            if (prefixLength < 0 || prefixLength > 32) throw new IllegalArgumentException("无效的前缀长度");
            long ip = parseIpv4(parts[0]);
            long size = 1L << (32 - prefixLength);
            long network = ip & ~(size - 1);
            return new CidrRange(network, network + size - 1, prefixLength, size);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("无效的 CIDR 格式: " + cidr);
        }
    }

    private String canonicalizeCidr(String cidr) {
        CidrRange range = parseCidr(cidr);
        return longToIp(range.network()) + "/" + range.prefixLength();
    }

    private long parseIpv4(String value) {
        try {
            byte[] bytes = InetAddress.getByName(value).getAddress();
            if (bytes.length != 4 || !InetAddress.getByAddress(bytes).getHostAddress().equals(value)) {
                throw new IllegalArgumentException("无效的 IPv4 地址: " + value);
            }
            return bytesToLong(bytes);
        } catch (Exception e) {
            throw new IllegalArgumentException("无效的 IPv4 地址: " + value);
        }
    }

    private record CidrRange(long network, long broadcast, int prefixLength, long size) { }

    private Map<Long, String> resolveUserNames(List<IpAllocation> allocations) {
        Set<Long> userIds = allocations.stream()
                .map(IpAllocation::getAllocatedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getUsername));
    }

    private Map<Long, String> resolveCiNames(List<IpAllocation> allocations) {
        Set<Long> ciIds = allocations.stream()
                .map(IpAllocation::getCiInstanceId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ciIds.isEmpty()) return Map.of();
        return ciInstanceMapper.selectBatchIds(ciIds).stream()
                .collect(Collectors.toMap(CiInstance::getId, CiInstance::getName));
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId)
                .module("ip_pool")
                .action(action)
                .targetId(targetId)
                .targetType("ip_pool")
                .operatorId(operatorId)
                .remark(remark)
                .createdAt(LocalDateTime.now())
                .build());
    }
}
