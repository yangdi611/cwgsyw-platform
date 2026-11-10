package com.cwgsyw.platform.module.sosreport.parser;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.clean;

/** 软件包、systemd 服务和内核模块。 */
final class SoftwareFacts {

    private static final Pattern RPM_LINE = Pattern.compile(
        "^(\\S+)\\s+\\w{3}\\s+(\\w{3})\\s+(\\d{1,2})\\s+\\d{2}:\\d{2}:\\d{2}\\s+(\\d{4})\\s*$");
    /** {@code ii  bash  5.0-4  amd64  GNU Bourne Again SHell} */
    private static final Pattern DPKG_LINE = Pattern.compile("^ii\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s.*$");

    private final SosParseContext ctx;

    SoftwareFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        Optional<String> rpmPath = ctx.pathWithPrefix("sos_commands/rpm/sh_-c_rpm_");
        if (rpmPath.isPresent()) {
            List<String> packages = new ArrayList<>();
            LocalDate earliest = null;
            for (String line : ctx.text(rpmPath.get()).split("\\R")) {
                Matcher matcher = RPM_LINE.matcher(line);
                if (!matcher.matches()) continue;
                packages.add(clean(matcher.group(1)));
                try {
                    LocalDate date = LocalDate.parse(
                        matcher.group(2) + " " + String.format("%2s", matcher.group(3)).replace(' ', '0') + " " + matcher.group(4),
                        DateTimeFormatter.ofPattern("MMM dd yyyy", Locale.ENGLISH));
                    if (earliest == null || date.isBefore(earliest)) earliest = date;
                } catch (DateTimeParseException ignored) {
                    // 单行日期不规范不影响其他包。
                }
            }
            if (!packages.isEmpty()) {
                ctx.facts.put("software.packageCount", packages.size());
                ctx.putList("software.packages", packages);
                ctx.facts.put("software.packageFormat", "rpm");
            }
            if (earliest != null) ctx.facts.put("os.installDate", earliest.toString());
        }
        if (!ctx.facts.containsKey("software.packages")) parseDpkg();

        List<String> running = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (String line : ctx.text("sos_commands/systemd/systemctl_list-units").split("\\R")) {
            String[] parts = line.replace("●", " ").replace("*", " ").trim().split("\\s+");
            if (parts.length < 4 || !parts[0].endsWith(".service")) continue;
            if ("running".equals(parts[3])) running.add(clean(parts[0]));
            if ("failed".equals(parts[2]) || "failed".equals(parts[3])) failed.add(clean(parts[0]));
        }
        ctx.putList("software.runningServices", running);
        ctx.putList("software.failedServices", failed);
        for (String service : failed) ctx.issue("服务失败：" + service);

        List<String> enabled = new ArrayList<>();
        for (String line : ctx.text("sos_commands/systemd/systemctl_list-unit-files").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 2 && parts[0].endsWith(".service") && "enabled".equals(parts[1])) enabled.add(parts[0]);
        }
        ctx.putList("software.enabledServices", enabled);

        List<String> modules = new ArrayList<>();
        for (String line : ctx.text("sos_commands/kernel/lsmod").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 2 && !parts[0].equals("Module") && parts[0].matches("[A-Za-z0-9_-]{1,64}")) modules.add(parts[0]);
        }
        modules.sort(String::compareTo);
        ctx.putList("software.kernelModules", modules);
    }

    /** Debian 系（含部分麒麟、UOS 桌面版）用 dpkg。只统计已安装（ii）的包。 */
    private void parseDpkg() {
        List<String> packages = new ArrayList<>();
        for (String line : ctx.text("sos_commands/dpkg/dpkg_-l").split("\\R")) {
            Matcher matcher = DPKG_LINE.matcher(line);
            if (matcher.matches()) packages.add(matcher.group(1) + "_" + matcher.group(2) + "_" + matcher.group(3));
        }
        if (packages.isEmpty()) return;
        ctx.facts.put("software.packageCount", packages.size());
        ctx.putList("software.packages", packages);
        ctx.facts.put("software.packageFormat", "deb");
    }
}
