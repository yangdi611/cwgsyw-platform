package com.cwgsyw.platform.module.workflow.binding;

import com.cwgsyw.platform.module.workflow.adapter.DailyReportWorkflowAdapter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 日报流程绑定 seeder（启动期，Flyway + Flowable 自动部署之后）。
 *
 * <p>为什么不是 Flyway：Flowable 的 {@code process_definition_id}（如 {@code dailyReportApproval:1:<uuid>}）
 * 在部署期生成，SQL 迁移期不可知，且自动部署与 Flyway 的先后不确定。故用幂等启动期 seeder：
 * 仅当 {@code daily_report} 尚无绑定时，将其绑定到最新版 {@code dailyReportApproval} 流程定义。
 *
 * <p>语义：<b>只在缺失时补齐，绝不覆盖</b>。已有绑定（含管理员手动绑定或旧 admin/config 兼容配置）时跳过。
 * 找不到流程定义时只记日志，不阻断启动。
 */
@Component
@Order(102)
@RequiredArgsConstructor
@Slf4j
public class DailyReportBindingSeeder implements ApplicationRunner {

    private static final String TENANT = "default";
    private static final Long SYSTEM_USER = 0L;
    private static final String PROCESS_KEY = "dailyReportApproval";

    private final ProcessBindingService bindingService;
    private final RepositoryService repositoryService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (bindingService.getActiveBinding(TENANT, DailyReportWorkflowAdapter.BUSINESS_TYPE) != null) {
                return; // 已有绑定（含兼容配置），不覆盖
            }
            ProcessDefinition def = repositoryService.createProcessDefinitionQuery()
                .processDefinitionKey(PROCESS_KEY)
                .latestVersion()
                .singleResult();
            if (def == null) {
                log.warn("日报流程定义 {} 未部署，跳过默认绑定 seeding", PROCESS_KEY);
                return;
            }
            bindingService.bind(TENANT, DailyReportWorkflowAdapter.BUSINESS_TYPE, def.getId(),
                null, SYSTEM_USER, "启动期默认绑定");
            log.info("已为 daily_report 绑定默认流程定义 {}", def.getId());
        } catch (Exception e) {
            log.warn("日报默认绑定 seeding 失败（不阻断启动）: {}", e.getMessage(), e);
        }
    }
}
