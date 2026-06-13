package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface SharedFolderMapper extends BaseMapper<SharedFolder> {
    @Select("SELECT * FROM shared_folder WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY name")
    List<SharedFolder> findAllByTenant(@Param("tenantId") String tenantId);
}
