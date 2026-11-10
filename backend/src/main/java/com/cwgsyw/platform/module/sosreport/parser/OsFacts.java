package com.cwgsyw.platform.module.sosreport.parser;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keyColonValues;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keyValues;

/** 操作系统：发行版、内核、时区、SELinux、启动方式，以及运行状态类的系统配置。 */
final class OsFacts {

    private static final Pattern ARCH = Pattern.compile(
        "\\b(x86_64|aarch64|arm64|loongarch64|mips64\\w*|ppc64\\w*|s390x|riscv64|i[3-6]86)\\b");

    private final SosParseContext ctx;

    OsFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        Map<String, String> osRelease = keyValues(ctx.text("etc/os-release"));
        ctx.put("os.name", osRelease.get("PRETTY_NAME"));
        ctx.put("os.versionId", osRelease.get("VERSION_ID"));
        String release = ctx.firstLine("etc/uos-release");
        if (release == null) release = ctx.firstLine("etc/system-release");
        if (release == null) release = osRelease.get("PRETTY_NAME");
        ctx.put("os.release", release);

        String[] uname = ctx.text("sos_commands/kernel/uname_-a").trim().split("\\s+");
        if (uname.length >= 3 && !uname[0].isBlank()) {
            ctx.put("os.family", uname[0].toLowerCase(Locale.ROOT));
            ctx.put("os.kernel", uname[2]);
        }
        Matcher arch = ARCH.matcher(ctx.text("sos_commands/kernel/uname_-a"));
        String lastArch = null;
        while (arch.find()) lastArch = arch.group(1);
        if (lastArch == null) lastArch = keyColonValues(ctx.text("sos_commands/processor/lscpu")).get("Architecture");
        ctx.put("os.arch", lastArch);

        String timedatectl = ctx.text("sos_commands/systemd/timedatectl");
        Matcher zone = Pattern.compile("(?m)^\\s*Time zone:\\s*(\\S+)").matcher(timedatectl);
        if (zone.find()) ctx.put("os.timezone", zone.group(1));

        Map<String, String> selinux = keyColonValues(ctx.text("sos_commands/selinux/sestatus"));
        String status = selinux.get("SELinux status");
        if ("disabled".equalsIgnoreCase(status)) {
            ctx.facts.put("os.selinux", "disabled");
        } else if ("enabled".equalsIgnoreCase(status)) {
            String mode = selinux.get("Current mode");
            if ("enforcing".equalsIgnoreCase(mode) || "permissive".equalsIgnoreCase(mode)) {
                ctx.facts.put("os.selinux", mode.toLowerCase(Locale.ROOT));
            }
        }

        String mounts = ctx.pathWithPrefix("sos_commands/filesys/df_-al").map(ctx::text).orElse("");
        if (!mounts.isEmpty()) {
            boolean uefi = mounts.lines().anyMatch(line -> line.startsWith("efivarfs ") || line.endsWith(" /boot/efi"));
            ctx.facts.put("os.bootMode", uefi ? "uefi" : "bios");
        }

        parseRuntime(timedatectl);
    }

    private void parseRuntime(String timedatectl) {
        // " 15:53:20 up 120 days,  3:01,  2 users,  load average: 0.00, 0.01, 0.05"
        String uptime = ctx.firstLine("sos_commands/host/uptime");
        if (uptime != null) {
            Matcher up = Pattern.compile("\\bup\\s+(.+?),\\s+\\d+\\s+users?,").matcher(uptime);
            if (up.find()) ctx.put("os.uptime", up.group(1).replaceAll("\\s+", " "));
            Matcher load = Pattern.compile("load average:\\s*(.+)$").matcher(uptime);
            if (load.find()) ctx.put("os.loadAverage", load.group(1));
        }

        String secureBoot = ctx.text("sos_commands/boot/mokutil_--sb-state").toLowerCase(Locale.ROOT);
        if (secureBoot.contains("secureboot enabled")) ctx.facts.put("os.secureBoot", "enabled");
        else if (secureBoot.contains("secureboot disabled")) ctx.facts.put("os.secureBoot", "disabled");
        else if (secureBoot.contains("not supported")) ctx.facts.put("os.secureBoot", "unsupported");

        Matcher tuned = Pattern.compile("(?m)^Current active profile:\\s*(\\S+)").matcher(ctx.text("sos_commands/tuned/tuned-adm_active"));
        if (tuned.find()) ctx.put("os.tunedProfile", tuned.group(1));

        String kdump = ctx.text("sos_commands/kdump/kdumpctl_status").toLowerCase(Locale.ROOT);
        if (kdump.contains("not operational")) {
            ctx.facts.put("os.kdumpStatus", "not_operational");
            ctx.issue("kdump 未就绪，系统崩溃时无法保存内存转储");
        } else if (kdump.contains("operational")) {
            ctx.facts.put("os.kdumpStatus", "operational");
        }

        String firewall = ctx.firstLine("sos_commands/firewalld/firewall-cmd_--state");
        if ("running".equals(firewall)) ctx.facts.put("os.firewall", "running");
        else if (firewall != null && firewall.startsWith("not running")) ctx.facts.put("os.firewall", "not_running");

        Integer tainted = SosParseContext.parseInteger(ctx.firstLine("proc/sys/kernel/tainted"));
        if (tainted != null) ctx.facts.put("os.kernelTainted", tainted);

        // systemd 239 起为 "System clock synchronized"，更早为 "NTP synchronized"。
        Map<String, String> time = keyColonValues(timedatectl);
        String synced = SosParseContext.firstNonNull(time.get("System clock synchronized"), time.get("NTP synchronized"));
        if ("yes".equalsIgnoreCase(synced)) ctx.facts.put("os.ntpSynchronized", true);
        else if ("no".equalsIgnoreCase(synced)) ctx.facts.put("os.ntpSynchronized", false);
        String service = SosParseContext.firstNonNull(time.get("NTP service"), time.get("NTP enabled"));
        ctx.putUseful("os.ntpService", service);

        Map<String, String> tracking = keyColonValues(ctx.text("sos_commands/chrony/chronyc_tracking"));
        ctx.putUseful("os.timeSource", tracking.get("Reference ID"));
        ctx.putUseful("os.timeOffset", tracking.get("System time"));
        ctx.putUseful("os.timeLeapStatus", tracking.get("Leap status"));
        if (Boolean.FALSE.equals(ctx.facts.get("os.ntpSynchronized"))) ctx.issue("系统时钟未与时间源同步");
    }
}
