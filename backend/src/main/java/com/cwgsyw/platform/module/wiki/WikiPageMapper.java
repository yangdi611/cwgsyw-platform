package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface WikiPageMapper extends BaseMapper<WikiPage> {

    @Select("WITH RECURSIVE chain AS (" +
            "SELECT * FROM wiki_page WHERE id=#{pageId} AND tenant_id=#{tenantId} AND is_deleted=FALSE " +
            "UNION ALL " +
            "SELECT p.* FROM wiki_page p JOIN chain c ON p.id=c.parent_id WHERE p.is_deleted=FALSE" +
            ") SELECT * FROM chain")
    List<WikiPage> findAncestorChain(@Param("tenantId") String tenantId, @Param("pageId") Long pageId);

    @Select("WITH RECURSIVE descend AS (" +
            "SELECT id FROM wiki_page WHERE id=#{pageId} AND is_deleted=FALSE " +
            "UNION ALL " +
            "SELECT p.id FROM wiki_page p JOIN descend d ON p.parent_id=d.id WHERE p.is_deleted=FALSE" +
            ") SELECT id FROM descend")
    List<Long> findDescendantIds(@Param("pageId") Long pageId);

    @Select("SELECT id, space_id, title, " +
            "CASE WHEN title ILIKE '%'||#{kw}||'%' THEN title " +
            "ELSE substring(content, greatest(1, position(#{kw} in content)-50), 100) END AS highlight, " +
            "updated_at FROM wiki_page " +
            "WHERE tenant_id=#{tenantId} AND is_deleted=FALSE AND status='published' " +
            "AND (title ILIKE '%'||#{kw}||'%' OR content ILIKE '%'||#{kw}||'%') " +
            "ORDER BY updated_at DESC LIMIT #{size} OFFSET #{offset}")
    List<Map<String, Object>> search(@Param("tenantId") String tenantId, @Param("kw") String kw,
                                     @Param("size") int size, @Param("offset") int offset);

    @Select("SELECT COUNT(*) FROM wiki_page WHERE tenant_id=#{tenantId} AND is_deleted=FALSE " +
            "AND status='published' " +
            "AND (title ILIKE '%'||#{kw}||'%' OR content ILIKE '%'||#{kw}||'%')")
    long searchCount(@Param("tenantId") String tenantId, @Param("kw") String kw);

    @Select("SELECT id, space_id, title, " +
            "CASE WHEN title ILIKE '%'||#{kw}||'%' THEN title " +
            "ELSE substring(content, greatest(1, position(#{kw} in content)-50), 100) END AS highlight, " +
            "updated_at FROM wiki_page " +
            "WHERE tenant_id=#{tenantId} AND space_id=#{spaceId} AND is_deleted=FALSE AND status='published' " +
            "AND (title ILIKE '%'||#{kw}||'%' OR content ILIKE '%'||#{kw}||'%') " +
            "ORDER BY updated_at DESC LIMIT #{size} OFFSET #{offset}")
    List<Map<String, Object>> searchInSpace(@Param("tenantId") String tenantId, @Param("spaceId") Long spaceId,
                                            @Param("kw") String kw, @Param("size") int size, @Param("offset") int offset);

    @Select("SELECT COUNT(*) FROM wiki_page WHERE tenant_id=#{tenantId} AND space_id=#{spaceId} " +
            "AND is_deleted=FALSE AND status='published' " +
            "AND (title ILIKE '%'||#{kw}||'%' OR content ILIKE '%'||#{kw}||'%')")
    long searchCountInSpace(@Param("tenantId") String tenantId, @Param("spaceId") Long spaceId, @Param("kw") String kw);
}
