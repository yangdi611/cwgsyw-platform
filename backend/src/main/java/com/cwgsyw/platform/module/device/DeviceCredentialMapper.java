package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface DeviceCredentialMapper extends BaseMapper<DeviceCredential> {
    @Select("SELECT * FROM device_credential WHERE device_id = #{deviceId} AND is_deleted = false")
    List<DeviceCredential> findByDeviceId(Long deviceId);
}
