package com.cwgsyw.platform.module.ipam;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.ipam.entity.IpAllocation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IpAllocationMapper extends BaseMapper<IpAllocation> {

    @Select("SELECT * FROM ip_allocation WHERE pool_id = #{poolId} AND ip_address = #{ipAddress} AND is_deleted = FALSE LIMIT 1")
    IpAllocation findByPoolAndIp(@Param("poolId") Long poolId, @Param("ipAddress") String ipAddress);

    @Select("SELECT * FROM ip_allocation WHERE pool_id = #{poolId} AND is_deleted = FALSE ORDER BY ip_address")
    List<IpAllocation> findByPoolId(@Param("poolId") Long poolId);

    @Select("SELECT * FROM ip_allocation WHERE ci_instance_id = #{ciInstanceId} AND is_deleted = FALSE ORDER BY allocated_at DESC")
    List<IpAllocation> findByCiInstanceId(@Param("ciInstanceId") Long ciInstanceId);

    @Select("SELECT a.* FROM ip_allocation a JOIN ip_pool p ON a.pool_id = p.id " +
            "WHERE p.cidr = #{cidr} AND a.ip_address = #{ipAddress} AND a.is_deleted = FALSE LIMIT 1")
    IpAllocation findByCidrAndIp(@Param("cidr") String cidr, @Param("ipAddress") String ipAddress);
}
