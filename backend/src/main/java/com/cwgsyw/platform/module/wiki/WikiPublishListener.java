package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.springframework.stereotype.Component;

@Component("wikiPublishListener")
@RequiredArgsConstructor
@Slf4j
public class WikiPublishListener implements ExecutionListener {

    private final WikiPageService wikiPageService;
    private final NotificationService notificationService;

    @Override
    public void notify(DelegateExecution execution) {
        Long pageId = ((Number) execution.getVariable("pageId")).longValue();
        Boolean approved = (Boolean) execution.getVariable("approved");
        String comment = (String) execution.getVariable("comment");
        WikiPage page = wikiPageService.handleApprovalResult(
                execution.getProcessInstanceId(), pageId, Boolean.TRUE.equals(approved), comment);
        if (page != null) {
            String title = Boolean.TRUE.equals(approved) ? "Wiki 审批通过" : "Wiki 审批被拒绝";
            String body = Boolean.TRUE.equals(approved)
                    ? "《" + page.getTitle() + "》已审批通过并发布。"
                    : "《" + page.getTitle() + "》审批被拒绝：" + comment;
            notificationService.notify(page.getTenantId(), page.getCreatedBy(),
                    title, body, "wiki_publish_approval", "wiki_page", pageId);
        }
    }
}
