package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WikiExportServiceTest {

    @Mock private WikiPageMapper pageMapper;
    @Mock private WikiSpaceMapper spaceMapper;
    @Mock private WikiAttachmentService attachmentService;
    @Mock private MinioStorageService minioStorage;
    @InjectMocks private WikiExportService service;

    @Test
    void exportPageWithAttachmentReferencesAlwaysDownloadsMarkdown() throws Exception {
        WikiPage page = new WikiPage();
        page.setId(54L);
        page.setTitle("含图片页面");
        page.setContent("![image](/api/wiki/attachments/18)");
        when(pageMapper.selectById(54L)).thenReturn(page);
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.exportPage(54L, "default", response);

        assertThat(response.getContentType()).isEqualTo("text/markdown;charset=UTF-8");
        assertThat(response.getHeader("Content-Disposition")).isEqualTo("attachment; filename=\"含图片页面.md\"");
        assertThat(response.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(page.getContent());
    }
}
