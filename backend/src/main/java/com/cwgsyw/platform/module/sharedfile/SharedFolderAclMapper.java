package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolderAcl;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SharedFolderAclMapper extends BaseMapper<SharedFolderAcl> {
    // ACL 行通过 LambdaQueryWrapper + selectList 读取，确保 JacksonTypeHandler 生效
    // （自定义 @Select 会绕过 autoResultMap，导致 permissions JSONB 反序列化为 null）
}
