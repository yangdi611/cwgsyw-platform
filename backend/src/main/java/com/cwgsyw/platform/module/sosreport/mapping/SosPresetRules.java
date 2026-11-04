package com.cwgsyw.platform.module.sosreport.mapping;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 内置 host 字段的预置规则。不经过 AI，AI 关闭时流程照常可用，也不允许被手动规则覆盖。
 */
public final class SosPresetRules {

    public static final String MODEL_CODE = "host";
    public static final String FIELD_SN = "sn";
    public static final String FIELD_INNER_IP = "inner_ip";
    public static final String FIELD_HOSTNAME = "hostname";

    private static final List<SosRule> RULES = List.of(
        SosRule.of(FIELD_SN, "system.serialNumber"),
        SosRule.of(FIELD_INNER_IP, "network.primaryIp"),
        SosRule.of(FIELD_HOSTNAME, "system.hostname"),
        SosRule.enumMap("os_type", "os.family", Map.of("linux", "linux")),
        SosRule.of("os_version", "os.release"),
        SosRule.enumMap("host_type", "system.hostType", Map.of("physical", "physical", "virtual", "virtual")),
        SosRule.of("manufacturer", "system.manufacturer"),
        SosRule.of("product_model", "system.productName"),
        SosRule.of("cpu_model", "cpu.model"),
        SosRule.of("cpu_sockets", "cpu.sockets"),
        SosRule.of("cpu_cores", "cpu.cores"),
        SosRule.of("mem_gb", "memory.installedGb"),
        SosRule.of("mem_slots", "memory.slotsTotal"),
        SosRule.of("disk_gb", "storage.totalDiskGb"),
        SosRule.of("kernel_version", "os.kernel"),
        SosRule.enumMap("arch", "os.arch", Map.of("x86_64", "x86_64", "aarch64", "arm64", "arm64", "arm64")),
        SosRule.enumMap("boot_mode", "os.bootMode", Map.of("uefi", "uefi", "bios", "bios")),
        SosRule.enumMap("selinux", "os.selinux",
            Map.of("enforcing", "enforcing", "permissive", "permissive", "disabled", "disabled")),
        SosRule.of("timezone", "os.timezone"),
        SosRule.of("swap_gb", "memory.swapGb"),
        SosRule.of("os_install_date", "os.installDate"),
        SosRule.join("dns_servers", "network.dnsServers"),
        SosRule.join("ntp_servers", "network.ntpServers"),
        SosRule.of("default_gateway", "network.defaultGateway"),
        SosRule.literal("data_source", "script"));

    private static final Map<String, SosRule> BY_FIELD =
        RULES.stream().collect(Collectors.toUnmodifiableMap(SosRule::fieldKey, Function.identity()));

    private SosPresetRules() {
    }

    public static Optional<SosRule> find(String fieldKey) {
        return Optional.ofNullable(BY_FIELD.get(fieldKey));
    }

    public static boolean isPreset(String fieldKey) {
        return BY_FIELD.containsKey(fieldKey);
    }
}
