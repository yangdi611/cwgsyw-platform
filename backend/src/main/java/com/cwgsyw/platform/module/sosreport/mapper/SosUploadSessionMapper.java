package com.cwgsyw.platform.module.sosreport.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.sosreport.entity.SosUploadSession;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SosUploadSessionMapper extends BaseMapper<SosUploadSession> {

    @Select("""
        SELECT id, tenant_id, chunk_count, status
          FROM sos_upload_session
         WHERE expires_at <= #{now}
         ORDER BY expires_at, id
         LIMIT #{limit}
        """)
    List<SosUploadSession> findExpired(@Param("now") LocalDateTime now, @Param("limit") int limit);

    /** 收到分片后续期。返回 0 表示会话已被取消或过期，刚写入的分片要删除。 */
    @Update("""
        UPDATE sos_upload_session
           SET expires_at = #{expiresAt}, updated_at = #{now}
         WHERE id = #{id} AND status = 'uploading' AND expires_at > #{now}
        """)
    int touch(@Param("id") String id, @Param("now") LocalDateTime now, @Param("expiresAt") LocalDateTime expiresAt);

    /** 条件更新认领合并，重复或并发的完成请求只有一个能成功。 */
    @Update("""
        UPDATE sos_upload_session
           SET status = 'assembling', expires_at = #{leaseUntil}, updated_at = #{now}
         WHERE id = #{id} AND status = 'uploading' AND expires_at > #{now}
        """)
    int claimForAssembly(@Param("id") String id, @Param("now") LocalDateTime now, @Param("leaseUntil") LocalDateTime leaseUntil);

    /** 合并遇到临时故障时退回，保留分片供重试。 */
    @Update("""
        UPDATE sos_upload_session
           SET status = 'uploading', expires_at = #{expiresAt}, updated_at = #{now}
         WHERE id = #{id} AND status = 'assembling'
        """)
    int releaseAssembly(@Param("id") String id, @Param("now") LocalDateTime now, @Param("expiresAt") LocalDateTime expiresAt);

    /**
     * 保留到期前，让响应丢失后的重试能拿到同一份报告。
     * 租约已过的不能完成：清理任务可能已经在删除合并结果。
     */
    @Update("""
        UPDATE sos_upload_session
           SET status = 'completed', report_id = #{reportId}, expires_at = #{expiresAt}, updated_at = #{now}
         WHERE id = #{id} AND status = 'assembling' AND expires_at > #{now}
        """)
    int markCompleted(@Param("id") String id, @Param("reportId") Long reportId,
                      @Param("now") LocalDateTime now, @Param("expiresAt") LocalDateTime expiresAt);

    /** 立即到期。清理失败时由定时任务重试。 */
    @Update("UPDATE sos_upload_session SET expires_at = #{now}, updated_at = #{now} WHERE id = #{id}")
    int expireNow(@Param("id") String id, @Param("now") LocalDateTime now);

    /** 只删除仍处于到期状态的行，避免删掉刚续期的会话。 */
    @Delete("DELETE FROM sos_upload_session WHERE id = #{id} AND expires_at <= #{now}")
    int deleteExpired(@Param("id") String id, @Param("now") LocalDateTime now);
}
