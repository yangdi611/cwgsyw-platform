package com.cwgsyw.platform.module.ipam;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.ipam.entity.IpPool;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface IpPoolMapper extends BaseMapper<IpPool> {

    @Select("SELECT COUNT(*) FROM ip_allocation WHERE pool_id = #{poolId} AND is_deleted = FALSE AND status = 'allocated'")
    int countAllocated(@Param("poolId") Long poolId);
}
