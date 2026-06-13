package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.device.entity.Device;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DeviceMapper extends BaseMapper<Device> {

    @Select("SELECT name FROM ci_instance WHERE id = #{ciInstanceId} AND is_deleted = false")
    String findCiInstanceName(@Param("ciInstanceId") Long ciInstanceId);
}
