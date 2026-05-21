package com.cwgsyw.platform.common;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {}
