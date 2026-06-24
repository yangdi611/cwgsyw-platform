package com.cwgsyw.platform.module.backup;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.backup.entity.BackupRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BackupMapper extends BaseMapper<BackupRecord> {

    /** 物理清空表（配合恢复后重建目录），不触发逻辑删除。 */
    @Update("TRUNCATE TABLE backup_record")
    void truncate();
}
