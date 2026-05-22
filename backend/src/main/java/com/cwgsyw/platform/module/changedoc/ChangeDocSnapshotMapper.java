package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ChangeDocSnapshotMapper extends BaseMapper<ChangeDocSnapshot> {
    @Select("SELECT * FROM change_doc_snapshot WHERE change_doc_id = #{docId} ORDER BY created_at DESC")
    List<ChangeDocSnapshot> findByDocId(@Param("docId") Long docId);
}
