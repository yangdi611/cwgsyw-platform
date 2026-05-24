package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

/**
 * 变更文档邮件模板服务
 * 生成用于通知的 HTML 邮件正文
 */
@Service
@Slf4j
public class EmailTemplateService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public enum EmailType {
        CHANGE_DOC_SUBMITTED,   // 变更申请已提交，通知审批人
        CHANGE_DOC_APPROVED,    // 变更申请已审批通过，通知申请人
        CHANGE_DOC_REJECTED,    // 变更申请已拒绝，通知申请人
        CHANGE_DOC_EXPORTED,    // 文档已导出，发送给收件人
        NOTIFICATION_GENERIC    // 通用站内信邮件通知
    }

    /**
     * 构建邮件 HTML 正文
     *
     * @param type    邮件类型
     * @param doc     变更文档 VO（generic 类型可为 null）
     * @param extra   附加说明文字（如审批意见、备注等）
     * @return HTML 字符串
     */
    public String buildEmailBody(EmailType type, ChangeDocVO doc, String extra) {
        return switch (type) {
            case CHANGE_DOC_SUBMITTED -> buildSubmittedEmail(doc, extra);
            case CHANGE_DOC_APPROVED  -> buildApprovedEmail(doc, extra);
            case CHANGE_DOC_REJECTED  -> buildRejectedEmail(doc, extra);
            case CHANGE_DOC_EXPORTED  -> buildExportedEmail(doc, extra);
            case NOTIFICATION_GENERIC -> buildGenericEmail(extra);
        };
    }

    /** 变更申请提交 — 通知审批人 */
    private String buildSubmittedEmail(ChangeDocVO doc, String extra) {
        String applyTime = doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "—";
        return wrap("新变更申请待审批", """
                <p>您好，</p>
                <p>您有一份新的变更申请需要审批，详情如下：</p>
                %s
                <p>请登录系统及时处理。</p>
                %s
                """.formatted(
                    buildDocTable(doc, applyTime),
                    extra != null && !extra.isBlank() ? "<p><b>备注：</b>" + esc(extra) + "</p>" : ""
                ));
    }

    /** 变更申请审批通过 — 通知申请人 */
    private String buildApprovedEmail(ChangeDocVO doc, String extra) {
        String applyTime    = doc.getApplyTime()    != null ? doc.getApplyTime().format(FMT)    : "—";
        String approvedTime = doc.getApprovedAt()   != null ? doc.getApprovedAt().format(FMT)   : "—";
        return wrap("变更申请已审批通过", """
                <p>您好，</p>
                <p>您提交的变更申请已<span style="color:#16a34a;font-weight:bold;">审批通过</span>，详情如下：</p>
                %s
                <tr><td class="label">审批人</td><td>%s</td></tr>
                <tr><td class="label">审批时间</td><td>%s</td></tr>
                %s
                <p>请按计划执行变更操作，祝工作顺利！</p>
                """.formatted(
                    buildDocTableOpen(doc, applyTime),
                    esc(doc.getApproverName()),
                    approvedTime,
                    buildDocTableClose(doc.getApproverComment())
                ));
    }

    /** 变更申请被拒绝 — 通知申请人 */
    private String buildRejectedEmail(ChangeDocVO doc, String extra) {
        String applyTime    = doc.getApplyTime()  != null ? doc.getApplyTime().format(FMT)  : "—";
        String approvedTime = doc.getApprovedAt() != null ? doc.getApprovedAt().format(FMT) : "—";
        return wrap("变更申请已被拒绝", """
                <p>您好，</p>
                <p>您提交的变更申请<span style="color:#dc2626;font-weight:bold;">未通过审批</span>，详情如下：</p>
                %s
                <tr><td class="label">审批人</td><td>%s</td></tr>
                <tr><td class="label">审批时间</td><td>%s</td></tr>
                %s
                <p>如有疑问，请联系审批人或管理员。</p>
                """.formatted(
                    buildDocTableOpen(doc, applyTime),
                    esc(doc.getApproverName()),
                    approvedTime,
                    buildDocTableClose(doc.getApproverComment())
                ));
    }

    /** 文档导出通知 — 发送给收件人 */
    private String buildExportedEmail(ChangeDocVO doc, String extra) {
        String applyTime = doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "—";
        return wrap("变更文档已导出", """
                <p>您好，</p>
                <p>以下变更文档已生成并作为附件随本邮件发送，请查收。</p>
                %s
                %s
                <p>如有问题，请联系申请人。</p>
                """.formatted(
                    buildDocTable(doc, applyTime),
                    extra != null && !extra.isBlank() ? "<p><b>说明：</b>" + esc(extra) + "</p>" : ""
                ));
    }

    /** 通用通知邮件 */
    private String buildGenericEmail(String content) {
        return wrap("IT 运维平台通知", """
                <p>您好，</p>
                <p>%s</p>
                <p>如有疑问，请登录系统查看详情。</p>
                """.formatted(esc(content != null ? content : "您有一条新的系统通知")));
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private String buildDocTable(ChangeDocVO doc, String applyTime) {
        return buildDocTableOpen(doc, applyTime) + buildDocTableClose(null);
    }

    /** 返回 <table>...<tr> 行，末尾不关闭 </table>（允许调用方插入额外行） */
    private String buildDocTableOpen(ChangeDocVO doc, String applyTime) {
        return """
                <table>
                  <tr><td class="label">变更编号</td><td>%s</td></tr>
                  <tr><td class="label">变更标题</td><td>%s</td></tr>
                  <tr><td class="label">申请人</td>  <td>%s</td></tr>
                  <tr><td class="label">申请时间</td><td>%s</td></tr>
                  <tr><td class="label">影响范围</td><td>%s</td></tr>
                """.formatted(
                    esc(doc.getChangeNo()),
                    esc(doc.getTitle()),
                    esc(doc.getApplicantName()),
                    applyTime,
                    esc(doc.getImpactScope())
                );
    }

    /** 关闭表格，可选地附加审批意见行 */
    private String buildDocTableClose(String approverComment) {
        StringBuilder sb = new StringBuilder();
        if (approverComment != null && !approverComment.isBlank()) {
            sb.append("  <tr><td class=\"label\">审批意见</td><td>").append(esc(approverComment)).append("</td></tr>\n");
        }
        sb.append("</table>");
        return sb.toString();
    }

    /** 整体 HTML 包裹，包含内联样式 */
    private String wrap(String title, String bodyHtml) {
        return """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                  <meta charset="UTF-8">
                  <title>%s</title>
                </head>
                <body style="font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
                  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:8px;
                              box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;">
                    <!-- header -->
                    <div style="background:#1d4ed8;padding:24px 32px;">
                      <h2 style="color:#fff;margin:0;font-size:18px;">%s</h2>
                      <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">IT 基础设施运维运营管理平台</p>
                    </div>
                    <!-- body -->
                    <div style="padding:28px 32px;color:#374151;font-size:14px;line-height:1.8;">
                      <style>
                        table { width:100%%; border-collapse:collapse; margin:16px 0; }
                        td    { padding:8px 12px; border:1px solid #e5e7eb; font-size:14px; }
                        td.label { background:#f9fafb; font-weight:600; width:30%%; color:#111827; }
                      </style>
                      %s
                    </div>
                    <!-- footer -->
                    <div style="background:#f9fafb;padding:16px 32px;text-align:center;
                                color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">
                      此邮件由系统自动发送，请勿直接回复。<br>
                      © IT 运维运营管理平台
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(esc(title), esc(title), bodyHtml);
    }

    /** 简单 HTML 转义（防止内容注入） */
    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
