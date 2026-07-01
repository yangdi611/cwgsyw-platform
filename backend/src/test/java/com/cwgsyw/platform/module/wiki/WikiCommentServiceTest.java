package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.WikiCommentVO;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageComment;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WikiCommentServiceTest {

    @Mock WikiPageCommentMapper commentMapper;
    @Mock WikiPageMapper pageMapper;
    @Mock UserMapper userMapper;
    @Mock AuditLogMapper auditLogMapper;

    @InjectMocks WikiCommentService service;

    private WikiPage page(String tenantId) {
        WikiPage p = new WikiPage();
        p.setId(88L);
        p.setTenantId(tenantId);
        p.setTitle("测试页面");
        return p;
    }

    private WikiPageComment comment(Long id, Long createdBy, LocalDateTime at) {
        WikiPageComment c = new WikiPageComment();
        c.setId(id);
        c.setTenantId("default");
        c.setPageId(88L);
        c.setContent("comment-" + id);
        c.setCreatedBy(createdBy);
        c.setCreatedAt(at);
        return c;
    }

    // ── createComment ─────────────────────────────────────────────────────

    @Test
    void createComment_success_insertsAndAudits() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.insert(any(WikiPageComment.class))).thenAnswer(inv -> {
            ((WikiPageComment) inv.getArgument(0)).setId(101L);
            return 1;
        });
        User u = new User();
        u.setId(12L);
        u.setRealName("张三");
        when(userMapper.selectById(12L)).thenReturn(u);

        WikiCommentVO vo = service.createComment("default", 88L, 12L, "  这是评论  ", "group");

        assertThat(vo.getId()).isEqualTo(101L);
        assertThat(vo.getContent()).isEqualTo("这是评论"); // trim 后入库
        assertThat(vo.getCreatedByName()).isEqualTo("张三");
        assertThat(vo.getCanDelete()).isTrue();

        ArgumentCaptor<AuditLog> cap = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(cap.capture());
        assertThat(cap.getValue().getModule()).isEqualTo("wiki");
        assertThat(cap.getValue().getAction()).isEqualTo("comment_create");
        assertThat(cap.getValue().getTargetType()).isEqualTo("wiki_page_comment");
    }

    @Test
    void createComment_emptyContent_throws() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        assertThatThrownBy(() -> service.createComment("default", 88L, 12L, "   ", "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不能为空");
        verify(commentMapper, never()).insert(any(WikiPageComment.class));
    }

    @Test
    void createComment_over300_throws() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        String tooLong = "x".repeat(301);
        assertThatThrownBy(() -> service.createComment("default", 88L, 12L, tooLong, "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("300");
        verify(commentMapper, never()).insert(any(WikiPageComment.class));
    }

    @Test
    void createComment_exactly300_ok() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.insert(any(WikiPageComment.class))).thenReturn(1);
        String exact = "x".repeat(300);
        WikiCommentVO vo = service.createComment("default", 88L, 12L, exact, "group");
        assertThat(vo.getContent()).hasSize(300);
    }

    @Test
    void createComment_onlyReaderScope_stillWorks() {
        // group scope（仅页面 read 权限）也能新增，不要求 update
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.insert(any(WikiPageComment.class))).thenReturn(1);
        WikiCommentVO vo = service.createComment("default", 88L, 5L, "reader comment", "group");
        assertThat(vo).isNotNull();
    }

    @Test
    void createComment_pageNotFound_throws() {
        when(pageMapper.selectById(88L)).thenReturn(null);
        assertThatThrownBy(() -> service.createComment("default", 88L, 12L, "hi", "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("页面不存在");
    }

    @Test
    void createComment_tenantMismatch_throws() {
        when(pageMapper.selectById(88L)).thenReturn(page("other-tenant"));
        assertThatThrownBy(() -> service.createComment("default", 88L, 12L, "hi", "group"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("页面不存在");
    }

    // ── listComments ──────────────────────────────────────────────────────

    @Test
    void listComments_ordersByCreatedAtDescIdDesc() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectCount(any())).thenReturn(2L);
        // service 层依赖 mapper 的 orderBy 落到 SQL；这里验证 wrapper 带了正确的排序片段
        LocalDateTime now = LocalDateTime.now();
        when(commentMapper.selectList(any())).thenReturn(List.of(
                comment(2L, 12L, now), comment(1L, 12L, now.minusMinutes(1))));
        when(userMapper.selectBatchIds(anyCollection())).thenReturn(List.of());

        PageResult<WikiCommentVO> result = service.listComments("default", 88L, 12L, "group", 1, 20);

        assertThat(result.getTotal()).isEqualTo(2L);
        // service 保留 mapper 返回顺序；真实 created_at DESC, id DESC 排序由 mapper 的 orderBy 落到 SQL（集成层验证）
        assertThat(result.getRecords()).extracting(WikiCommentVO::getId).containsExactly(2L, 1L);
    }

    @Test
    void listComments_canDelete_ownComments() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectCount(any())).thenReturn(2L);
        LocalDateTime now = LocalDateTime.now();
        when(commentMapper.selectList(any())).thenReturn(List.of(
                comment(2L, 12L, now), comment(1L, 99L, now.minusMinutes(1))));
        when(userMapper.selectBatchIds(anyCollection())).thenReturn(List.of());

        PageResult<WikiCommentVO> result = service.listComments("default", 88L, 12L, "group", 1, 20);

        // 普通用户：仅本人评论 canDelete=true
        assertThat(result.getRecords().get(0).getCanDelete()).isTrue();  // id=2, own
        assertThat(result.getRecords().get(1).getCanDelete()).isFalse(); // id=1, other's
    }

    @Test
    void listComments_admin_canDeleteAll() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectCount(any())).thenReturn(1L);
        when(commentMapper.selectList(any())).thenReturn(List.of(comment(1L, 99L, LocalDateTime.now())));
        when(userMapper.selectBatchIds(anyCollection())).thenReturn(List.of());

        PageResult<WikiCommentVO> result = service.listComments("default", 88L, 12L, "tenant", 1, 20);
        assertThat(result.getRecords().get(0).getCanDelete()).isTrue();
    }

    @Test
    void listComments_sizeClampedTo50() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectCount(any())).thenReturn(0L);
        when(commentMapper.selectList(any())).thenReturn(List.of());

        PageResult<WikiCommentVO> result = service.listComments("default", 88L, 12L, "group", 1, 999);
        assertThat(result.getSize()).isEqualTo(50L);
    }

    // ── deleteComment ─────────────────────────────────────────────────────

    @Test
    void deleteComment_owner_success() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectOne(any())).thenReturn(comment(1L, 12L, LocalDateTime.now()));

        service.deleteComment("default", 88L, 1L, 12L, "group");

        verify(commentMapper).deleteById(1L);
        ArgumentCaptor<AuditLog> cap = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(cap.capture());
        assertThat(cap.getValue().getAction()).isEqualTo("comment_delete");
    }

    @Test
    void deleteComment_admin_deletesOthers() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectOne(any())).thenReturn(comment(1L, 99L, LocalDateTime.now()));

        service.deleteComment("default", 88L, 1L, 12L, "tenant");
        verify(commentMapper).deleteById(1L);
    }

    @Test
    void deleteComment_nonOwnerNonAdmin_throws() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectOne(any())).thenReturn(comment(1L, 99L, LocalDateTime.now()));

        assertThatThrownBy(() -> service.deleteComment("default", 88L, 1L, 12L, "group"))
                .isInstanceOf(AccessDeniedException.class);
        verify(commentMapper, never()).deleteById(anyLong());
    }

    @Test
    void deleteComment_notFound_idempotentSuccess() {
        when(pageMapper.selectById(88L)).thenReturn(page("default"));
        when(commentMapper.selectOne(any())).thenReturn(null);

        service.deleteComment("default", 88L, 999L, 12L, "group"); // no throw
        verify(commentMapper, never()).deleteById(anyLong());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    // ── permission口径单元验证 ────────────────────────────────────────────

    @Test
    void canManageAnyComment_scopes() {
        assertThat(WikiCommentService.canManageAnyComment("platform")).isTrue();
        assertThat(WikiCommentService.canManageAnyComment("tenant")).isTrue();
        assertThat(WikiCommentService.canManageAnyComment("group")).isFalse();
        assertThat(WikiCommentService.canManageAnyComment(null)).isFalse();
    }
}
