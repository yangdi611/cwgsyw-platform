package com.cwgsyw.platform.module.backup;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.backup.entity.BackupRecord;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface BackupMapper extends BaseMapper<BackupRecord> {
}
