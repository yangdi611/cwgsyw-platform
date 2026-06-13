package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface SharedFileMapper extends BaseMapper<SharedFile> {

    @Results(id = "sharedFileMap", value = {
        @Result(column = "id", property = "id"),
        @Result(column = "tenant_id", property = "tenantId"),
        @Result(column = "folder_id", property = "folderId"),
        @Result(column = "name", property = "name"),
        @Result(column = "original_name", property = "originalName"),
        @Result(column = "file_type", property = "fileType"),
        @Result(column = "size_bytes", property = "sizeBytes"),
        @Result(column = "minio_key", property = "minioKey"),
        @Result(column = "md_key", property = "mdKey"),
        @Result(column = "visible_groups", property = "visibleGroups",
                javaType = List.class, typeHandler = JacksonTypeHandler.class),
        @Result(column = "source_type", property = "sourceType"),
        @Result(column = "source_id", property = "sourceId"),
        @Result(column = "created_by", property = "createdBy"),
        @Result(column = "created_at", property = "createdAt"),
        @Result(column = "updated_at", property = "updatedAt"),
        @Result(column = "is_deleted", property = "isDeleted"),
        @Result(column = "deleted_at", property = "deletedAt"),
        @Result(column = "deleted_by", property = "deletedBy")
    })
    @Select("SELECT * FROM shared_file WHERE tenant_id = #{tenantId} AND folder_id = #{folderId} AND is_deleted = FALSE ORDER BY created_at DESC")
    Page<SharedFile> findByFolder(Page<SharedFile> page,
                                   @Param("tenantId") String tenantId,
                                   @Param("folderId") Long folderId);

    @Select("SELECT * FROM shared_file WHERE tenant_id = #{tenantId} AND is_deleted = FALSE AND to_tsvector('simple', name) @@ plainto_tsquery('simple', #{keyword}) ORDER BY created_at DESC")
    @ResultMap("sharedFileMap")
    Page<SharedFile> searchByKeyword(Page<SharedFile> page,
                                      @Param("tenantId") String tenantId,
                                      @Param("keyword") String keyword);
}
