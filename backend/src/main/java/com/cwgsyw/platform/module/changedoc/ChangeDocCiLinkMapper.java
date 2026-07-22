package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ChangeDocCiLinkMapper extends BaseMapper<ChangeDocCiLink> {
    @Select("""
        SELECT COUNT(*)
        FROM change_doc_ci_link link
        JOIN change_doc doc ON doc.id = link.change_doc_id AND doc.tenant_id = link.tenant_id
        WHERE link.tenant_id = #{tenantId}
          AND link.instance_id = #{instanceId}
          AND NOT link.is_deleted
          AND NOT doc.is_deleted
        """)
    long countActiveDocumentReferences(@Param("tenantId") String tenantId,
                                       @Param("instanceId") Long instanceId);
}
