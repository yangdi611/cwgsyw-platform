package com.cwgsyw.platform.module.task.runtime.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraftAttachment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TaskDraftAttachmentMapper extends BaseMapper<TaskDraftAttachment> {
    @Update("UPDATE task_draft_attachment SET draft_revision = #{nextRevision} WHERE tenant_id = #{tenantId} AND task_id = #{taskId} AND draft_revision = #{currentRevision}")
    int carryForward(@Param("tenantId") String tenantId, @Param("taskId") Long taskId,
                     @Param("currentRevision") Integer currentRevision, @Param("nextRevision") Integer nextRevision);
}
