package com.cwgsyw.platform.module.sosreport.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SosReportMapper extends BaseMapper<SosReport> {

    /** 到期任务，包含租约过期的 parsing 记录。不查 facts，避免无谓的大字段读取。 */
    @Select("""
        SELECT id, tenant_id, object_key, status, attempt_count, file_name
          FROM sos_report
         WHERE status IN ('pending', 'parsing') AND is_deleted = FALSE AND next_attempt_at <= #{now}
         ORDER BY next_attempt_at, id
         LIMIT #{limit}
        """)
    List<SosReport> findDue(@Param("now") LocalDateTime now, @Param("limit") int limit);

    /** 条件更新认领，多实例下只有一个能成功。 */
    @Update("""
        UPDATE sos_report
           SET status = 'parsing', attempt_count = attempt_count + 1,
               next_attempt_at = #{leaseUntil}, updated_at = #{now}
         WHERE tenant_id = #{tenantId} AND id = #{id} AND is_deleted = FALSE
           AND status IN ('pending', 'parsing') AND next_attempt_at <= #{now}
        """)
    int claim(@Param("tenantId") String tenantId, @Param("id") Long id,
              @Param("now") LocalDateTime now, @Param("leaseUntil") LocalDateTime leaseUntil);

    /** 仍保留原始压缩包、但已不再需要的记录，含已删除的记录。 */
    @Select("""
        SELECT id, tenant_id, object_key
          FROM sos_report
         WHERE object_key IS NOT NULL AND (status IN ('parsed', 'failed') OR is_deleted = TRUE)
         ORDER BY id
         LIMIT #{limit}
        """)
    List<SosReport> findPurgeable(@Param("limit") int limit);

    /** 清空对象 key。不经过逻辑删除条件，已删除的记录也要清理。 */
    @Update("UPDATE sos_report SET object_key = NULL WHERE id = #{id} AND object_key = #{objectKey}")
    int clearObjectKey(@Param("id") Long id, @Param("objectKey") String objectKey);
}
