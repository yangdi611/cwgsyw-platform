package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.clean;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.firstToken;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keyColonValues;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.pciKey;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfPresent;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.stripPrefix;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.useful;

/** 地址、路由、网卡、bond、VLAN、光模块、InfiniBand 和光纤通道。 */
final class NetworkFacts {

    private static final String NET = "sos_commands/networking/";
    /**
     * 网卡名不含 {@code @父接口} 后缀。iproute2 的地址行只打印设备名，后缀只出现在链路行；
     * 这里统一去掉，保证和 {@code ip -d link} 解析出的名称一致。
     */
    private static final Pattern IP_ADDR_LINE = Pattern.compile(
        "^\\d+:\\s+([^\\s@]+)(?:@\\S+)?\\s+inet\\s+(\\d+\\.\\d+\\.\\d+\\.\\d+)(?:/(\\d+))?\\s.*");
    private static final Pattern IP6_ADDR_LINE = Pattern.compile(
        "^\\d+:\\s+([^\\s@]+)(?:@\\S+)?\\s+inet6\\s+([0-9a-fA-F:]+)(?:/(\\d+))?\\s+scope\\s+global.*");
    private static final Pattern IPV4 = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");
    private static final Pattern SAFE_INTERFACE = Pattern.compile("^[A-Za-z0-9_.:-]{1,64}$");
    /** {@code 2: ens1f0.100@ens1f0: <BROADCAST,...> mtu 1500 qdisc ... state UP ...} */
    private static final Pattern LINK_HEADER = Pattern.compile("^\\d+:\\s+([^:@\\s]+)(?:@(\\S+?))?:\\s+<([^>]*)>\\s+(.*)$");
    private static final Pattern VLAN_DETAIL = Pattern.compile("^vlan protocol (\\S+) id (\\d+)");
    private static final Pattern BOND_MODE = Pattern.compile("^bond mode (\\S+)");
    /** 虚拟接口的驱动。它们在 ethtool -i 里报的 firmware-version（如 bonding 的 "2"）不是固件版本。 */
    private static final Set<String> VIRTUAL_DRIVERS = Set.of(
        "bonding", "team", "bridge", "802.1Q VLAN Support", "8021q", "veth", "tun", "macvlan", "ipvlan", "vxlan",
        "openvswitch", "dummy", "ipip", "gre", "ip_gre", "sit");
    private static final Set<String> LINK_KINDS = Set.of(
        "vlan", "bond", "bridge", "team", "veth", "macvlan", "ipvlan", "vxlan", "tun", "ipip", "gre", "openvswitch", "dummy");

    private final SosParseContext ctx;

    NetworkFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        Map<String, List<String>> ipsByInterface = new LinkedHashMap<>();
        Map<String, List<String>> ip6ByInterface = new LinkedHashMap<>();
        for (String line : ctx.text(NET + "ip_-o_addr").split("\\R")) {
            Matcher matcher = IP_ADDR_LINE.matcher(line);
            if (matcher.matches() && !matcher.group(1).equals("lo")) {
                String cidr = matcher.group(3) == null ? matcher.group(2) : matcher.group(2) + "/" + matcher.group(3);
                ipsByInterface.computeIfAbsent(matcher.group(1), k -> new ArrayList<>()).add(cidr);
                continue;
            }
            Matcher v6 = IP6_ADDR_LINE.matcher(line);
            if (v6.matches() && !v6.group(1).equals("lo")) {
                String cidr = v6.group(3) == null ? v6.group(2) : v6.group(2) + "/" + v6.group(3);
                ip6ByInterface.computeIfAbsent(v6.group(1), k -> new ArrayList<>()).add(cidr.toLowerCase(Locale.ROOT));
            }
        }

        String gateway = null;
        String primaryInterface = null;
        for (String line : ctx.text(NET + "route_-n").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 8 && parts[0].equals("0.0.0.0") && parts[3].contains("G")) {
                gateway = parts[1];
                primaryInterface = parts[7];
                break;
            }
        }
        if (gateway == null) {
            Matcher matcher = Pattern.compile("(?m)^default via (\\S+) dev (\\S+)")
                .matcher(ctx.text(NET + "ip_route_show_table_all"));
            if (matcher.find()) {
                gateway = matcher.group(1);
                primaryInterface = matcher.group(2);
            }
        }
        if (gateway != null && IPV4.matcher(gateway).matches()) ctx.facts.put("network.defaultGateway", gateway);
        ctx.put("network.primaryInterface", primaryInterface);

        String primaryIp = null;
        if (primaryInterface != null && ipsByInterface.containsKey(primaryInterface)) {
            primaryIp = stripPrefix(ipsByInterface.get(primaryInterface).get(0));
        } else if (primaryInterface == null && ipsByInterface.size() == 1) {
            primaryIp = stripPrefix(ipsByInterface.values().iterator().next().get(0));
        }
        ctx.put("network.primaryIp", primaryIp);

        ctx.putList("network.ipv4Addresses", ipsByInterface.values().stream().flatMap(List::stream).map(SosParseContext::stripPrefix).distinct().toList());
        ctx.putList("network.ipv6Addresses", ip6ByInterface.values().stream().flatMap(List::stream).map(SosParseContext::stripPrefix).distinct().toList());

        ctx.putList("network.dnsServers", ctx.text("etc/resolv.conf").lines()
            .map(String::trim)
            .filter(line -> line.startsWith("nameserver"))
            .map(line -> line.substring("nameserver".length()).trim())
            .map(SosParseContext::firstToken)
            .filter(token -> token != null && !token.isEmpty())
            .toList());

        List<String> ntp = new ArrayList<>(ntpServers("etc/chrony.conf"));
        ntp.addAll(ntpServers("etc/ntp.conf"));
        ctx.putList("network.ntpServers", ntp);

        Map<String, Map<String, Object>> links = parseLinks();
        // /proc/net/bonding 最详细；报告里没有时（如 sos 复制 /proc/net 超出大小上限），退回 ip -d link。
        List<Map<String, Object>> bonds = parseBonds();
        if (bonds.isEmpty()) bonds = bondsFromLinks(links);
        if (!bonds.isEmpty()) ctx.facts.put("network.bonds", bonds);
        for (Map<String, Object> bond : bonds) {
            if (!(bond.get("members") instanceof List<?> members)) continue;
            for (Object item : members) {
                if (item instanceof Map<?, ?> member && !"up".equalsIgnoreCase(String.valueOf(member.get("status")))) {
                    ctx.issue("bond " + bond.get("name") + " 的成员 " + member.get("name") + " 链路状态：" + member.get("status"));
                }
            }
        }
        List<Map<String, Object>> interfaces = parseInterfaces(ipsByInterface, ip6ByInterface, bonds, links);
        if (!interfaces.isEmpty()) ctx.facts.put("network.interfaces", interfaces);
        ctx.putRows("network.vlans", links.values().stream().filter(link -> "vlan".equals(link.get("kind"))).map(link -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", link.get("name"));
            putIfPresent(row, "parent", link.get("parent"));
            putIfPresent(row, "vlanId", link.get("vlanId"));
            putIfPresent(row, "protocol", link.get("vlanProtocol"));
            putIfPresent(row, "state", link.get("state"));
            putIfPresent(row, "ipv4", ipsByInterface.get(String.valueOf(link.get("name"))));
            return row;
        }).toList());
        List<Map<String, Object>> ports = parseListeningPorts();
        if (!ports.isEmpty()) ctx.facts.put("network.listeningPorts", ports);
        parseInfiniband();
        parseFibreChannel();
    }

    private List<String> ntpServers(String path) {
        return ctx.text(path).lines()
            .map(String::trim)
            .filter(line -> line.startsWith("server ") || line.startsWith("pool "))
            .map(line -> line.split("\\s+")[1])
            // ntpd 的本地时钟伪地址不是真正的时间源。
            .filter(server -> !server.startsWith("127.127."))
            .toList();
    }

    private List<Map<String, Object>> parseBonds() {
        String prefix = "proc/net/bonding/";
        List<Map<String, Object>> bonds = new ArrayList<>();
        for (String path : ctx.sortedPaths(prefix)) {
            Map<String, Object> bond = new LinkedHashMap<>();
            bond.put("name", path.substring(prefix.length()));
            List<Map<String, Object>> members = new ArrayList<>();
            Map<String, Object> member = null;
            for (String line : ctx.text(path).split("\\R")) {
                int colon = line.indexOf(':');
                if (colon < 0) continue;
                String key = line.substring(0, colon).trim();
                String value = clean(line.substring(colon + 1));
                switch (key) {
                    case "Bonding Mode" -> bond.put("mode", value);
                    case "Slave Interface" -> {
                        member = new LinkedHashMap<>();
                        member.put("name", value);
                        members.add(member);
                    }
                    case "MII Status" -> (member == null ? bond : member).put("status", value);
                    case "Speed" -> {
                        // 链路断开时为 Unknown。
                        if (member != null && useful(known(value)) != null) member.put("speed", value);
                    }
                    case "Permanent HW addr" -> {
                        if (member != null) member.put("mac", value);
                    }
                    case "Currently Active Slave" -> {
                        // 没有可用成员时写 None。
                        if (member == null && useful(value) != null) bond.put("activeMember", value);
                    }
                    case "Link Failure Count" -> {
                        if (member != null) putIfPresent(member, "linkFailures", parseInteger(value));
                    }
                    default -> {
                    }
                }
            }
            bond.put("members", members);
            bonds.add(bond);
        }
        return bonds;
    }

    /** 从 {@code ip -d link} 还原 bond：主接口带 bond mode，成员带 master 和 bond_slave 状态。 */
    private static List<Map<String, Object>> bondsFromLinks(Map<String, Map<String, Object>> links) {
        List<Map<String, Object>> bonds = new ArrayList<>();
        for (Map<String, Object> link : links.values()) {
            if (!"bond".equals(link.get("kind"))) continue;
            Map<String, Object> bond = new LinkedHashMap<>();
            bond.put("name", link.get("name"));
            putIfPresent(bond, "mode", link.get("bondMode"));
            Object state = link.get("state");
            if (state != null) bond.put("status", String.valueOf(state).toLowerCase(Locale.ROOT));
            List<Map<String, Object>> members = new ArrayList<>();
            for (Map<String, Object> member : links.values()) {
                if (!bond.get("name").equals(member.get("master"))) continue;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("name", member.get("name"));
                Object mii = member.get("miiStatus");
                row.put("status", mii != null ? String.valueOf(mii).toLowerCase(Locale.ROOT)
                    : String.valueOf(member.getOrDefault("state", "unknown")).toLowerCase(Locale.ROOT));
                putIfPresent(row, "mac", member.get("permHwaddr"));
                putIfPresent(row, "slaveState", member.get("slaveState"));
                putIfPresent(row, "linkFailures", member.get("linkFailures"));
                if ("ACTIVE".equals(member.get("slaveState"))) bond.putIfAbsent("activeMember", member.get("name"));
                members.add(row);
            }
            bond.put("members", members);
            bond.put("source", "ip link");
            bonds.add(bond);
        }
        return bonds;
    }

    /** {@code ip -s -d link}：MTU、状态、类型、VLAN。 */
    private Map<String, Map<String, Object>> parseLinks() {
        Map<String, Map<String, Object>> links = new LinkedHashMap<>();
        Map<String, Object> current = null;
        for (String line : ctx.text(NET + "ip_-s_-d_link").split("\\R")) {
            Matcher header = LINK_HEADER.matcher(line);
            if (header.matches()) {
                String name = header.group(1);
                if (!SAFE_INTERFACE.matcher(name).matches() || name.equals("lo")) {
                    current = null;
                    continue;
                }
                current = new LinkedHashMap<>();
                current.put("name", name);
                if (header.group(2) != null && !header.group(2).startsWith("if")) current.put("parent", clean(header.group(2)));
                String[] attrs = header.group(4).split("\\s+");
                for (int i = 0; i + 1 < attrs.length; i++) {
                    switch (attrs[i]) {
                        case "mtu" -> putIfPresent(current, "mtu", parseInteger(attrs[i + 1]));
                        case "state" -> current.put("state", clean(attrs[i + 1]));
                        case "master" -> current.put("master", clean(attrs[i + 1]));
                        default -> {
                        }
                    }
                }
                links.put(name, current);
                continue;
            }
            if (current == null || !Character.isWhitespace(line.isEmpty() ? 'x' : line.charAt(0))) continue;
            String trimmed = line.trim();
            Matcher vlan = VLAN_DETAIL.matcher(trimmed);
            if (vlan.find()) {
                current.put("kind", "vlan");
                current.put("vlanProtocol", vlan.group(1));
                current.put("vlanId", Integer.valueOf(vlan.group(2)));
                continue;
            }
            String kind = firstToken(trimmed);
            if (kind != null && LINK_KINDS.contains(kind) && !current.containsKey("kind")) current.put("kind", kind);
            // bond mode 802.3ad miimon 100 ...
            Matcher mode = BOND_MODE.matcher(trimmed);
            if (mode.find()) current.putIfAbsent("bondMode", clean(mode.group(1)));
            // bond_slave state ACTIVE mii_status UP link_failure_count 0 perm_hwaddr 4c:74:a7:43:c8:f6 ...
            if (trimmed.startsWith("bond_slave ")) {
                String[] tokens = trimmed.split("\\s+");
                for (int i = 1; i + 1 < tokens.length; i++) {
                    switch (tokens[i]) {
                        case "state" -> current.put("slaveState", clean(tokens[i + 1]));
                        case "mii_status" -> current.put("miiStatus", clean(tokens[i + 1]));
                        case "perm_hwaddr" -> current.put("permHwaddr", clean(tokens[i + 1]));
                        case "link_failure_count" -> putIfPresent(current, "linkFailures", parseInteger(tokens[i + 1]));
                        default -> {
                        }
                    }
                }
            }
        }
        return links;
    }

    private List<Map<String, Object>> parseInterfaces(Map<String, List<String>> ips, Map<String, List<String>> ip6,
                                                      List<Map<String, Object>> bonds, Map<String, Map<String, Object>> links) {
        String prefix = NET + "ethtool_";
        Set<String> names = new LinkedHashSet<>();
        for (String path : ctx.sortedPaths(prefix)) {
            String rest = path.substring(prefix.length());
            if (rest.startsWith("-i_") || rest.startsWith("-P_") || rest.startsWith("-m_")) rest = rest.substring(3);
            if (!rest.startsWith("-") && !rest.equals("lo") && SAFE_INTERFACE.matcher(rest).matches()) names.add(rest);
        }
        names.addAll(ips.keySet());

        Map<String, String> masterByMember = new LinkedHashMap<>();
        for (Map<String, Object> bond : bonds) {
            if (bond.get("members") instanceof List<?> members) {
                for (Object member : members) {
                    if (member instanceof Map<?, ?> row) {
                        masterByMember.put(String.valueOf(row.get("name")), String.valueOf(bond.get("name")));
                    }
                }
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (String name : names) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", name);
            Map<String, String> ethtool = keyColonValues(ctx.text(prefix + name));
            Map<String, String> driver = keyColonValues(ctx.text(prefix + "-i_" + name));
            Matcher permanent = Pattern.compile("Permanent address:\\s*([0-9a-fA-F:]{17})").matcher(ctx.text(prefix + "-P_" + name));
            if (permanent.find() && !permanent.group(1).equals("00:00:00:00:00:00")) row.put("mac", permanent.group(1));
            putIfUseful(row, "speed", known(ethtool.get("Speed")));
            putIfUseful(row, "linkDetected", ethtool.get("Link detected"));
            putIfUseful(row, "driver", driver.get("driver"));
            boolean virtual = VIRTUAL_DRIVERS.contains(String.valueOf(driver.get("driver")));
            if (!virtual) putIfUseful(row, "firmware", driver.get("firmware-version"));
            putIfUseful(row, "busInfo", driver.get("bus-info"));
            if (masterByMember.containsKey(name)) row.put("master", masterByMember.get(name));
            if (ips.containsKey(name)) row.put("ipv4", ips.get(name));

            // 以下为扩展字段，取不到就不写。
            putIfUseful(row, "driverVersion", driver.get("version"));
            putIfUseful(row, "duplex", known(ethtool.get("Duplex")));
            if (!virtual) putIfUseful(row, "port", known(ethtool.get("Port")));
            putIfUseful(row, "autoNegotiation", ethtool.get("Auto-negotiation"));
            if (ip6.containsKey(name)) row.put("ipv6", ip6.get(name));
            Map<String, Object> link = links.get(name);
            if (link != null) {
                putIfPresent(row, "mtu", link.get("mtu"));
                putIfPresent(row, "state", link.get("state"));
                putIfPresent(row, "kind", link.get("kind"));
                if (!row.containsKey("master")) putIfPresent(row, "master", link.get("master"));
            }
            enrichFromPci(row);
            Map<String, Object> transceiver = transceiver(name);
            if (!transceiver.isEmpty()) row.put("transceiver", transceiver);
            if (row.get("firmware") != null) {
                ctx.firmware("网卡", (String) row.getOrDefault("model", row.get("driver")),
                    name + (row.get("location") != null ? "（" + row.get("location") + "）" : ""), (String) row.get("firmware"));
            }
            rows.add(row);
        }
        return rows;
    }

    /** ethtool 取不到值时输出 "Unknown!" 或 "Unknown! (255)"。 */
    private static String known(String value) {
        return value == null || value.trim().toLowerCase(Locale.ROOT).startsWith("unknown") ? null : value;
    }

    private void enrichFromPci(Map<String, Object> row) {
        String key = pciKey((String) row.get("busInfo"));
        Map<String, Object> device = key == null ? null : ctx.pciByAddress.get(key);
        if (device == null) return;
        device.put("interface", row.get("name"));
        putIfPresent(row, "vendor", device.get("vendor"));
        putIfPresent(row, "model", PciFacts.model(device));
        putIfPresent(row, "location", device.get("location"));
        putIfPresent(row, "numaNode", device.get("numaNode"));
        putIfPresent(row, "pcieLink", device.get("linkStatus"));
        putIfPresent(row, "partNumber", device.get("partNumber"));
        putIfPresent(row, "serialNumber", device.get("vpdSerialNumber"));
    }

    /** {@code ethtool -m}：SFP/QSFP 光模块信息。 */
    private Map<String, Object> transceiver(String name) {
        Map<String, String> values = keyColonValues(ctx.text(NET + "ethtool_-m_" + name));
        Map<String, Object> row = new LinkedHashMap<>();
        putIfUseful(row, "identifier", stripCode(values.get("Identifier")));
        putIfUseful(row, "connector", stripCode(values.get("Connector")));
        putIfUseful(row, "type", values.get("Transceiver type"));
        putIfUseful(row, "vendor", values.get("Vendor name"));
        putIfUseful(row, "partNumber", values.get("Vendor PN"));
        putIfUseful(row, "serialNumber", values.get("Vendor SN"));
        putIfUseful(row, "revision", values.get("Vendor rev"));
        putIfUseful(row, "wavelength", values.get("Laser wavelength"));
        putIfUseful(row, "length", firstPresent(values, "Length (SMF,km)", "Length (OM3)", "Length (OM4)", "Length (OM2)", "Length (Copper or Active cable)"));
        putIfUseful(row, "dateCode", values.get("Date code"));
        return row;
    }

    /** 去掉 ethtool 的十六进制前缀，如 "0x03 (SFP)" → "SFP"。 */
    private static String stripCode(String value) {
        if (value == null) return null;
        Matcher matcher = Pattern.compile("^0x[0-9a-fA-F]+\\s+\\((.*)\\)\\s*$").matcher(value.trim());
        return matcher.matches() ? matcher.group(1) : value;
    }

    private static String firstPresent(Map<String, String> values, String... keys) {
        for (String key : keys) {
            String value = useful(values.get(key));
            if (value != null && !value.startsWith("0")) return value;
        }
        return null;
    }

    private List<Map<String, Object>> parseListeningPorts() {
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String line : ctx.text(NET + "netstat_-W_-neopa").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 6 || !parts[0].startsWith("tcp") || !"LISTEN".equals(parts[5])) continue;
            int colon = parts[3].lastIndexOf(':');
            if (colon < 0) continue;
            String address = parts[3].substring(0, colon);
            Integer port = parseInteger(parts[3].substring(colon + 1));
            if (port == null) continue;
            String process = null;
            if (parts.length >= 9 && parts[8].contains("/")) {
                // 只保留进程名，不保留路径和参数。
                String name = parts[8].substring(parts[8].indexOf('/') + 1);
                process = clean(name.substring(name.lastIndexOf('/') + 1));
            }
            if (!seen.add(parts[0] + "|" + address + "|" + port)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("protocol", parts[0]);
            row.put("address", clean(address));
            row.put("port", port);
            if (process != null) row.put("process", process);
            rows.add(row);
            if (rows.size() >= SosParseContext.MAX_LIST_ITEMS) break;
        }
        return rows;
    }

    // ─── InfiniBand ──────────────────────────────────────────────────────────

    /** {@code ibstat}：每个 HCA 的每个端口一行。 */
    private void parseInfiniband() {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Object> ca = null;
        Map<String, Object> port = null;
        for (String line : ctx.text("sos_commands/infiniband/ibstat").split("\\R")) {
            String trimmed = line.trim();
            Matcher caLine = Pattern.compile("^CA '([^']{1,64})'$").matcher(trimmed);
            if (caLine.matches()) {
                ca = new LinkedHashMap<>();
                ca.put("device", clean(caLine.group(1)));
                port = null;
                continue;
            }
            if (ca == null) continue;
            Matcher portLine = Pattern.compile("^Port (\\d+):$").matcher(trimmed);
            if (portLine.matches()) {
                port = new LinkedHashMap<>(ca);
                port.put("port", Integer.valueOf(portLine.group(1)));
                rows.add(port);
                continue;
            }
            int colon = trimmed.indexOf(':');
            if (colon <= 0) continue;
            String key = trimmed.substring(0, colon);
            String value = trimmed.substring(colon + 1).trim();
            Map<String, Object> target = port != null ? port : ca;
            switch (key) {
                case "CA type" -> putIfUseful(target, "type", value);
                case "Firmware version" -> putIfUseful(target, "firmware", value);
                case "Hardware version" -> putIfUseful(target, "hardwareVersion", value);
                case "Node GUID" -> putIfUseful(target, "nodeGuid", value);
                case "State" -> putIfUseful(target, "state", value);
                case "Physical state" -> putIfUseful(target, "physicalState", value);
                case "Rate" -> putIfUseful(target, "rate", value);
                case "Port GUID" -> putIfUseful(target, "portGuid", value);
                case "Link layer" -> putIfUseful(target, "linkLayer", value);
                default -> {
                }
            }
        }
        ctx.putRows("network.infiniband", rows);
        Set<String> seen = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            if (row.get("firmware") != null && seen.add(String.valueOf(row.get("device")))) {
                ctx.firmware("InfiniBand HCA", (String) row.get("type"), (String) row.get("device"), (String) row.get("firmware"));
            }
        }
    }

    // ─── 光纤通道 ────────────────────────────────────────────────────────────

    /** fibrechannel 插件对每个 fc_host 运行 {@code udevadm info -a}，第一个设备段就是 fc_host 本身。 */
    private void parseFibreChannel() {
        String prefix = "sos_commands/fibrechannel/udevadm_info_-a_.sys.class.fc_host.";
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String path : ctx.sortedPaths(prefix)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("host", clean(path.substring(prefix.length())));
            boolean started = false;
            for (String line : ctx.text(path).split("\\R")) {
                String trimmed = line.trim();
                if (trimmed.startsWith("looking at")) {
                    if (started) break;
                    started = true;
                    continue;
                }
                Matcher attr = Pattern.compile("^ATTR\\{(\\w+)}==\"(.*)\"$").matcher(trimmed);
                if (!attr.matches()) continue;
                String value = attr.group(2);
                switch (attr.group(1)) {
                    case "port_name" -> putIfUseful(row, "wwpn", wwn(value));
                    case "node_name" -> putIfUseful(row, "wwnn", wwn(value));
                    case "fabric_name" -> putIfUseful(row, "fabricName", wwn(value));
                    case "port_state" -> putIfUseful(row, "state", value);
                    case "port_type" -> putIfUseful(row, "portType", value);
                    case "speed" -> putIfUseful(row, "speed", value);
                    case "supported_speeds" -> putIfUseful(row, "supportedSpeeds", value);
                    case "symbolic_name" -> putIfUseful(row, "symbolicName", value);
                    default -> {
                    }
                }
            }
            if (row.size() > 1) rows.add(row);
            String symbolic = String.valueOf(row.getOrDefault("symbolicName", ""));
            Matcher fw = Pattern.compile("\\bFW:\\s*v?(\\S+)").matcher(symbolic);
            if (fw.find()) ctx.firmware("FC HBA", firstToken(symbolic), String.valueOf(row.get("host")), fw.group(1));
            if (row.get("state") != null && !"Online".equalsIgnoreCase(String.valueOf(row.get("state")))) {
                ctx.issue("FC 端口 " + row.get("host") + " 状态：" + row.get("state"));
            }
        }
        ctx.putRows("network.fcHosts", rows);
    }

    /** 0x21000024ff123456 → 21:00:00:24:ff:12:34:56 */
    private static String wwn(String value) {
        String hex = value.toLowerCase(Locale.ROOT).replaceFirst("^0x", "");
        if (!hex.matches("[0-9a-f]{16}") || hex.matches("0+|f+")) return null;
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < 16; i += 2) {
            if (i > 0) out.append(':');
            out.append(hex, i, i + 2);
        }
        return out.toString();
    }
}
