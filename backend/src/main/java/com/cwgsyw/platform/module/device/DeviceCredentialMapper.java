package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.device.dto.CredentialVO;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface DeviceCredentialMapper extends BaseMapper<DeviceCredential> {
    @Select("SELECT * FROM device_credential WHERE device_id = #{deviceId} AND is_deleted = false")
    List<DeviceCredential> findByDeviceId(Long deviceId);

    @Select("""
        SELECT dc.id, dc.device_id, dc.group_id, dc.username,
               dc.password_enc AS password, dc.description, dc.ci_instance_id,
               ci.name AS ci_instance_name, dc.created_at
        FROM device_credential dc
        LEFT JOIN ci_instance ci ON ci.id = dc.ci_instance_id
        WHERE dc.ci_instance_id = #{ciInstanceId} AND dc.is_deleted = false
        """)
    @Results(id = "credentialVOResult", value = {
        @Result(column = "id", property = "id"),
        @Result(column = "device_id", property = "deviceId"),
        @Result(column = "group_id", property = "groupId"),
        @Result(column = "username", property = "username"),
        @Result(column = "password", property = "password"),
        @Result(column = "description", property = "description"),
        @Result(column = "ci_instance_id", property = "ciInstanceId"),
        @Result(column = "ci_instance_name", property = "ciInstanceName"),
        @Result(column = "created_at", property = "createdAt"),
    })
    List<CredentialVO> findCredentialVOsByCiInstanceId(Long ciInstanceId);
}
