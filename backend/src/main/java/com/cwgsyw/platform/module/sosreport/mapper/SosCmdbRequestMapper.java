package com.cwgsyw.platform.module.sosreport.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SosCmdbRequestMapper extends BaseMapper<SosCmdbRequest> {

    /** 同一系统 UUID 历史上成功写入过的 CI。host 模型没有 UUID 字段，只能从入库记录追溯。 */
    @Select("""
        SELECT DISTINCT request.result_instance_id
          FROM sos_cmdb_request request
          JOIN sos_report report ON report.id = request.report_id AND report.tenant_id = request.tenant_id
         WHERE request.tenant_id = #{tenantId}
           AND request.model_code = #{modelCode}
           AND request.status = 'applied'
           AND request.is_deleted = FALSE
           AND request.result_instance_id IS NOT NULL
           AND report.system_uuid = #{systemUuid}
        """)
    List<Long> findAppliedInstanceIdsByUuid(@Param("tenantId") String tenantId,
                                            @Param("modelCode") String modelCode,
                                            @Param("systemUuid") String systemUuid);

    /** 同一身份的并发审批串行化，事务结束或回滚到保存点时自动释放。 */
    @Select("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(#{key}, 0))")
    Integer lockIdentity(@Param("key") String key);
}
