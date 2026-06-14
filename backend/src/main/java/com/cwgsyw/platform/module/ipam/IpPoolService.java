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

    public PageResult<IpPoolVO> list(String keyword, String status, int page, int size, String tenantId) {
        LambdaQueryWrapper<IpPool> query = new LambdaQueryWrapper<IpPool>()
                .eq(IpPool::getTenantId, tenantId)
                .eq(IpPool::getIsDeleted, false)
                .orderByDesc(IpPool::getCreatedAt);
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

    public IpPoolDetailVO getById(Long id, String tenantId) {
        IpPool pool = findPoolOrThrow(id, tenantId);
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
    public IpPool create(CreateIpPoolRequest req, String tenantId, Long operatorId) {
        int totalCount = calculateTotalFromCidr(req.getCidr());

        IpPool pool = new IpPool();
        pool.setTenantId(tenantId);
        pool.setName(req.getName());
        pool.setDescription(req.getDescription());
        pool.setCidr(req.getCidr());
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
    public void update(Long id, UpdateIpPoolRequest req, String tenantId, Long operatorId) {
        IpPool pool = findPoolOrThrow(id, tenantId);
        if (req.getName() != null) pool.setName(req.getName());
        if (req.getDescription() != null) pool.setDescription(req.getDescription());
        if (req.getGateway() != null) pool.setGateway(req.getGateway());
        if (req.getDns() != null) pool.setDns(req.getDns());
        ipPoolMapper.updateById(pool);
        writeAudit(tenantId, "update", id, operatorId, "name=" + pool.getName());
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        IpPool pool = findPoolOrThrow(id, tenantId);
        // Check for active allocations
        int activeCount = ipPoolMapper.countAllocated(id);
        if (activeCount > 0) {
            throw new IllegalArgumentException("地址池中尚有 " + activeCount + " 个已分配的 IP，请先释放后再删除");
        }
        pool.setIsDeleted(true);
        pool.setDeletedAt(LocalDateTime.now());
        pool.setDeletedBy(operatorId);
        ipPoolMapper.updateById(pool);
        writeAudit(tenantId, "delete", id, operatorId, "name=" + pool.getName());
    }

    @Transactional
    public IpAllocationVO allocate(Long poolId, AllocateIpRequest req, String tenantId, Long operatorId) {
        IpPool pool = findPoolOrThrow(poolId, tenantId);
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
            if (!ipBelongsToCidr(ipAddress, pool.getCidr())) {
                throw new IllegalArgumentException("IP " + ipAddress + " 不属于 CIDR " + pool.getCidr() + " 的范围");
            }
            // Check if already allocated
            IpAllocation existing = ipAllocationMapper.findByPoolAndIp(poolId, ipAddress);
            if (existing != null) {
                throw new IllegalArgumentException("IP " + ipAddress + " 已分配");
            }
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
        int newCount = pool.getAllocatedCount() + 1;
        pool.setAllocatedCount(newCount);
        if (newCount >= pool.getTotalCount()) {
            pool.setStatus("full");
        }
        ipPoolMapper.updateById(pool);

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
    public void release(Long poolId, ReleaseIpRequest req, String tenantId, Long operatorId) {
        IpPool pool = findPoolOrThrow(poolId, tenantId);

        IpAllocation allocation = ipAllocationMapper.findByPoolAndIp(poolId, req.getIpAddress());
        if (allocation == null) {
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

    public IpPoolVO utilization(Long id, String tenantId) {
        IpPool pool = findPoolOrThrow(id, tenantId);
        return toPoolVO(pool);
    }

    public List<IpAllocationVO> getByCiInstanceId(Long ciInstanceId, String tenantId) {
        List<IpAllocation> allocations = ipAllocationMapper.findByCiInstanceId(ciInstanceId);
        Map<Long, String> userNames = resolveUserNames(allocations);
        Map<Long, String> ciNames = resolveCiNames(allocations);
        return allocations.stream()
                .map(a -> toAllocationVO(a, userNames, ciNames))
                .collect(Collectors.toList());
    }

    // ---- CIDR calculation helpers ----

    int calculateTotalFromCidr(String cidr) {
        try {
            String[] parts = cidr.split("/");
            if (parts.length != 2) throw new IllegalArgumentException("无效的 CIDR 格式");
            int prefixLength = Integer.parseInt(parts[1]);
            if (prefixLength < 0 || prefixLength > 32) throw new IllegalArgumentException("无效的前缀长度");

            if (prefixLength == 32) return 1;
            if (prefixLength == 31) return 2;
            return (1 << (32 - prefixLength)) - 2;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("无效的 CIDR 格式: " + cidr);
        }
    }

    private String findNextAvailableIp(String cidr, Long poolId) {
        try {
            String[] parts = cidr.split("/");
            int prefixLength = Integer.parseInt(parts[1]);
            byte[] networkBytes = InetAddress.getByName(parts[0]).getAddress();
            long networkInt = bytesToLong(networkBytes);

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

            long endIp = (prefixLength == 31) ? startIp + hostCount : hostCount;
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
            String[] parts = cidr.split("/");
            int prefixLength = Integer.parseInt(parts[1]);
            long network = bytesToLong(InetAddress.getByName(parts[0]).getAddress());
            long mask = prefixLength == 0 ? 0 : (-1L << (32 - prefixLength));
            long ip = bytesToLong(InetAddress.getByName(ipAddress).getAddress());
            return (ip & mask) == (network & mask);
        } catch (Exception e) {
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

    private IpPool findPoolOrThrow(Long id, String tenantId) {
        IpPool pool = ipPoolMapper.selectById(id);
        if (pool == null || pool.getIsDeleted() || !pool.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("地址池不存在");
        }
        return pool;
    }

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
