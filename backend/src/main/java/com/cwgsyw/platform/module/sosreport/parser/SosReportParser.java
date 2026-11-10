package com.cwgsyw.platform.module.sosreport.parser;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 把白名单文件解析成结构化事实。纯函数，不依赖 Spring。
 *
 * <p>输入来自不可信归档：每个字段都做长度限制和控制字符清理，取不到就留空，不抛异常。
 * 输出的 key 全部来自 {@link SosFactCatalog}。各领域的取值规则见同包的 {@code *Facts} 类，
 * 数据来源与 sos 插件的对应关系见 {@code docs/plan/sos-report/hardware-inventory.md}。
 */
public final class SosReportParser {

    /** 解析规则变化时递增，便于识别旧版本解析的结果。2：硬件明细、BMC、RAID 卡、固件清单和健康告警。 */
    public static final int PARSER_VERSION = 2;

    private final SosParseContext ctx;

    private SosReportParser(Map<String, String> files) {
        this.ctx = new SosParseContext(files);
    }

    public static Result parse(Map<String, String> files) {
        SosReportParser parser = new SosReportParser(files);
        parser.run();
        return new Result(parser.ctx.facts, parser.ctx.warnings, parser.sosVersion(), parser.collectedAt());
    }

    public record Result(Map<String, Object> facts, List<String> warnings, String sosVersion, String collectedAt) {
    }

    private void run() {
        SystemFacts system = new SystemFacts(ctx);
        system.parse();
        new OsFacts(ctx).parse();
        new CpuMemoryFacts(ctx).parse();
        // PCI 设备要先解析，网卡、RAID 卡和 GPU 依靠它补充型号和物理位置。
        PciFacts pci = new PciFacts(ctx);
        pci.parse();
        new NetworkFacts(ctx).parse();
        pci.publishDevices();
        new StorageFacts(ctx).parse();
        new RaidFacts(ctx).parse();
        new BmcFacts(ctx).parse();
        new AcceleratorFacts(ctx).parse();
        new SoftwareFacts(ctx).parse();
        system.parseHostType(system.system());

        ctx.putRows("hardware.firmwareInventory", ctx.firmware);
        ctx.putList("health.issues", ctx.issues);

        if (!ctx.facts.containsKey("system.serialNumber")) ctx.warnings.add("未取得整机序列号，提交入库前需要人工填写");
        if (!ctx.facts.containsKey("network.primaryIp")) ctx.warnings.add("未取得主 IP，提交入库前需要人工填写");
        if (!ctx.has("sos_commands/hardware/dmidecode")) ctx.warnings.add("报告不含 dmidecode，硬件信息可能不完整");
    }

    private String sosVersion() {
        Matcher matcher = Pattern.compile("(?m)^sos(?:report)?(?:\\s+version)?:?\\s*(\\S+)\\s*$").matcher(ctx.text("version.txt"));
        return matcher.find() ? SosParseContext.limit(SosParseContext.clean(matcher.group(1)), 64) : null;
    }

    private String collectedAt() {
        String value = ctx.firstLine("sos_commands/date/date");
        return value == null ? null : SosParseContext.limit(value, 64);
    }
}
