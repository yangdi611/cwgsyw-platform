package com.cwgsyw.platform.module.sosreport.mapping;

import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SosMappingEngineTest {

    private static final Map<String, Object> FACTS = Map.of(
        "cpu.cores", 64,
        "memory.usableGb", 503.7,
        "memory.installedGb", 512,
        "os.arch", "aarch64",
        "network.dnsServers", List.of("10.0.0.1", "10.0.0.2"),
        "network.interfaces", List.of(Map.of("name", "a"), Map.of("name", "b")),
        "os.installDate", "2026-09-20");

    private static SosRule rule(String factKey, String transform, Map<String, Object> args) {
        return new SosRule("field", factKey, transform, args, null);
    }

    @Test
    void acceptsCompatibleRules() {
        assertNull(SosMappingEngine.incompatibility("cpu.cores", "direct", null, SosTestSupport.attribute("f", "int")));
        assertNull(SosMappingEngine.incompatibility("cpu.cores", "direct", null, SosTestSupport.attribute("f", "singlechar")));
        assertNull(SosMappingEngine.incompatibility("memory.usableGb", "round", null, SosTestSupport.attribute("f", "int")));
        assertNull(SosMappingEngine.incompatibility("memory.usableGb", "direct", null, SosTestSupport.attribute("f", "float")));
        assertNull(SosMappingEngine.incompatibility("memory.installedGb", "gb_to_mb", null, SosTestSupport.attribute("f", "int")));
        assertNull(SosMappingEngine.incompatibility("network.interfaces", "count", null, SosTestSupport.attribute("f", "int")));
        assertNull(SosMappingEngine.incompatibility("network.dnsServers", "join", null, SosTestSupport.attribute("f", "longchar")));
        assertNull(SosMappingEngine.incompatibility("os.installDate", "direct", null, SosTestSupport.attribute("f", "date")));
    }

    @Test
    void rejectsIncompatibleRules() {
        CiAttribute integer = SosTestSupport.attribute("f", "int");
        CiAttribute text = SosTestSupport.attribute("f", "singlechar");
        assertNotNull(SosMappingEngine.incompatibility("not.a.fact", "direct", null, text), "事实必须在目录内");
        assertNotNull(SosMappingEngine.incompatibility("cpu.cores", "exec", null, text), "转换方式是封闭集合");
        assertNotNull(SosMappingEngine.incompatibility("cpu.cores", null, null, text));
        assertNotNull(SosMappingEngine.incompatibility("os.kernel", "direct", null, integer), "字符串不能写入整数字段");
        assertNotNull(SosMappingEngine.incompatibility("memory.usableGb", "direct", null, integer), "小数写入整数字段要先取整");
        assertNotNull(SosMappingEngine.incompatibility("network.dnsServers", "direct", null, text), "列表不能直接写入文本字段");
        assertNotNull(SosMappingEngine.incompatibility("network.interfaces", "join", null, text), "对象列表不能拼接");
        assertNotNull(SosMappingEngine.incompatibility("cpu.cores", "gb_to_mb", null, integer), "只有容量事实能换算");
        assertNotNull(SosMappingEngine.incompatibility("os.kernel", "direct", null, SosTestSupport.attribute("f", "date")));
    }

    @Test
    void refusesFieldTypesThatOnlyHumansFill() {
        for (String type : List.of("table", "enummulti", "objuser")) {
            CiAttribute attribute = SosTestSupport.attribute("f", type);
            assertFalse(SosMappingEngine.isSupported(attribute), type);
            assertNotNull(SosMappingEngine.incompatibility("cpu.cores", "direct", null, attribute), type);
        }
    }

    @Test
    void enumFieldsRequireMapIntoRealOptions() {
        CiAttribute arch = SosTestSupport.enumAttribute("arch", "x86_64", "arm64");
        Map<String, Object> valid = Map.of(SosTransform.ARG_MAP, Map.of("aarch64", "arm64"));
        Map<String, Object> invalid = Map.of(SosTransform.ARG_MAP, Map.of("aarch64", "not-an-option"));

        assertNull(SosMappingEngine.incompatibility("os.arch", "enum_map", valid, arch));
        assertNotNull(SosMappingEngine.incompatibility("os.arch", "enum_map", invalid, arch));
        assertNotNull(SosMappingEngine.incompatibility("os.arch", "enum_map", Map.of(), arch));
        assertNotNull(SosMappingEngine.incompatibility("os.arch", "direct", null, arch));
    }

    @Test
    void evaluatesTransforms() {
        assertEquals(64L, SosMappingEngine.evaluate(rule("cpu.cores", "direct", null), FACTS, SosTestSupport.attribute("f", "int")).value());
        assertEquals("64", SosMappingEngine.evaluate(rule("cpu.cores", "direct", null), FACTS, SosTestSupport.attribute("f", "singlechar")).value());
        assertEquals(504L, SosMappingEngine.evaluate(rule("memory.usableGb", "round", null), FACTS, SosTestSupport.attribute("f", "int")).value());
        assertEquals(524288L, SosMappingEngine.evaluate(rule("memory.installedGb", "gb_to_mb", null), FACTS, SosTestSupport.attribute("f", "int")).value());
        assertEquals(new BigDecimal("0.50"), SosMappingEngine.evaluate(rule("memory.installedGb", "gb_to_tb", null), FACTS, SosTestSupport.attribute("f", "float")).value());
        assertEquals(2L, SosMappingEngine.evaluate(rule("network.interfaces", "count", null), FACTS, SosTestSupport.attribute("f", "int")).value());
        assertEquals("10.0.0.1,10.0.0.2", SosMappingEngine.evaluate(rule("network.dnsServers", "join", null), FACTS, SosTestSupport.attribute("f", "singlechar")).value());
    }

    @Test
    void normalizesArchThroughPreset() {
        SosRule preset = SosPresetRules.find("arch").orElseThrow();
        SosMappingEngine.Evaluation evaluation = SosMappingEngine.evaluate(preset, FACTS, SosTestSupport.enumAttribute("arch", "x86_64", "arm64"));
        assertEquals("arm64", evaluation.value());
    }

    @Test
    void reportsWhyAValueIsMissing() {
        SosMappingEngine.Evaluation missing = SosMappingEngine.evaluate(rule("system.uuid", "direct", null), FACTS, SosTestSupport.attribute("f", "singlechar"));
        assertNull(missing.value());
        assertNotNull(missing.problem());

        SosMappingEngine.Evaluation unmapped = SosMappingEngine.evaluate(
            rule("os.arch", "enum_map", Map.of(SosTransform.ARG_MAP, Map.of("x86_64", "x86_64"))),
            FACTS, SosTestSupport.enumAttribute("arch", "x86_64"));
        assertNull(unmapped.value());
        assertTrue(unmapped.problem().contains("aarch64"));
    }

    @Test
    void literalPresetRespectsFieldOptions() {
        SosRule literal = SosPresetRules.find("data_source").orElseThrow();
        assertEquals("script", SosMappingEngine.evaluate(literal, Map.of(), SosTestSupport.enumAttribute("data_source", "manual", "script")).value());
        assertNull(SosMappingEngine.evaluate(literal, Map.of(), SosTestSupport.enumAttribute("data_source", "manual")).value());
    }

    @Test
    void fingerprintChangesWithTypeOrOptionsOnly() {
        CiAttribute base = SosTestSupport.enumAttribute("f", "a", "b");
        String fingerprint = SosMappingEngine.fingerprint(base);

        assertEquals(fingerprint, SosMappingEngine.fingerprint(SosTestSupport.enumAttribute("renamed", "b", "a")), "顺序和字段名不影响");
        assertNotEquals(fingerprint, SosMappingEngine.fingerprint(SosTestSupport.enumAttribute("f", "a", "b", "c")));
        assertNotEquals(fingerprint, SosMappingEngine.fingerprint(SosTestSupport.attribute("f", "singlechar")));
    }

    @Test
    void comparesValuesLoosely() {
        assertTrue(SosMappingEngine.sameValue(64, "64"));
        assertTrue(SosMappingEngine.sameValue(64L, 64.0));
        assertTrue(SosMappingEngine.sameValue("a", "a"));
        assertFalse(SosMappingEngine.sameValue("a", "b"));
        assertFalse(SosMappingEngine.sameValue(null, "b"));
    }

    @Test
    void everyPresetIsConsistentWithTheCatalog() {
        for (String key : List.of("sn", "inner_ip", "hostname", "os_version", "cpu_cores", "mem_gb", "disk_gb", "dns_servers", "ntp_servers")) {
            SosRule rule = SosPresetRules.find(key).orElseThrow();
            assertTrue(SosFactCatalog.find(rule.factKey()).isPresent(), key);
        }
    }
}
