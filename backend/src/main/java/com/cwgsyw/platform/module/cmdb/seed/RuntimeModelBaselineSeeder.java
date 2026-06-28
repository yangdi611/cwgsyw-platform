package com.cwgsyw.platform.module.cmdb.seed;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 运行时模型基线属性 seeder（启动期，Flyway 之后 @Order(101)，紧跟 WikiManualSeeder）。
 *
 * <p>为什么不是 Flyway：K8s 聚合模型 {@code resource_pool}（含 standard_rack/gpu_servier）是用户
 * 在「模型管理」UI 运行时创建的，不是 Flyway 种子（实库查证 2026-06-28，is_built_in=false）。
 * 其 model_id 与字段集合可能随用户操作变化，Flyway 迁移无法假定其存在。故用幂等启动期 seeder：
 * 仅当模型已存在时，为其补齐与 V56 其他预制模型对齐的「维保信息」组 + 维保字段 + 云资源专属标量。
 *
 * <p>语义：<b>只增不改不删</b>。每个属性/属性组 insert 前用 selectCount 判存在，已存在则跳过。
 * 不存在的模型直接跳过（绝不在此创建模型——创建是用户的职责）。任何异常只记日志，不阻断启动。
 *
 * <p>仅写 P1 标量字段；table 类型字段（P2）与连接（P3）不在此。详见 spec §3。
 */
@Component
@Order(101)
@RequiredArgsConstructor
@Slf4j
public class RuntimeModelBaselineSeeder implements ApplicationRunner {

    private static final String TENANT = "default";
    private static final Long SYSTEM_USER = 0L;

    /** 需要补齐基线维保字段的运行时模型 model_id（实库查证：仅 resource_pool 有实际意义）。 */
    private static final List<String> TARGET_MODELS = List.of("resource_pool");

    private final CiModelMapper modelMapper;
    private final CiAttributeMapper attributeMapper;
    private final CiAttributeGroupMapper attributeGroupMapper;

    @Override
    public void run(ApplicationArguments args) {
        int seededGroups = 0, seededAttrs = 0;
        for (String modelId : TARGET_MODELS) {
            try {
                if (!modelExists(modelId)) {
                    log.info("[RuntimeSeeder] 模型 {} 不存在，跳过", modelId);
                    continue;
                }
                seededGroups += ensureMaintenanceGroup(modelId);
                seededAttrs += ensureMaintenanceAttributes(modelId);
                seededAttrs += ensureCloudPoolAttributes(modelId);
            } catch (Exception e) {
                log.warn("[RuntimeSeeder] 模型 {} 基线补齐失败（不阻断启动）: {}", modelId, e.getMessage());
            }
        }
        if (seededGroups > 0 || seededAttrs > 0) {
            log.info("[RuntimeSeeder] 完成：新增 {} 个属性组、{} 个属性", seededGroups, seededAttrs);
        } else {
            log.info("[RuntimeSeeder] 无需补齐（已是最新）");
        }
    }

    private boolean modelExists(String modelId) {
        return modelMapper.selectCount(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, TENANT)
                .eq(CiModel::getModelId, modelId)) > 0;
    }

    /** 确保「维保信息」属性组存在，sort_order=20 置末尾。返回新增数（0 或 1）。 */
    private int ensureMaintenanceGroup(String modelId) {
        boolean exists = attributeGroupMapper.selectCount(new LambdaQueryWrapper<CiAttributeGroup>()
                .eq(CiAttributeGroup::getTenantId, TENANT)
                .eq(CiAttributeGroup::getModelId, modelId)
                .eq(CiAttributeGroup::getCode, "maintenance")) > 0;
        if (exists) return 0;
        CiAttributeGroup g = new CiAttributeGroup();
        g.setTenantId(TENANT);
        g.setModelId(modelId);
        g.setCode("maintenance");        // → group_id 列
        g.setName("维保信息");
        g.setSortOrder(20);
        g.setCreatedBy(SYSTEM_USER);     // ApplicationRunner 无请求上下文，自动填充拿不到用户，显式置 0
        g.setUpdatedBy(SYSTEM_USER);
        attributeGroupMapper.insert(g);
        return 1;
    }

    /** 维保 9 字段（与 V56 块 5 完全一致）。返回新增个数。 */
    private int ensureMaintenanceAttributes(String modelId) {
        List<AttrDef> defs = List.of(
                AttrDef.of("vendor", "维保厂商", "singlechar", 1),
                AttrDef.of("maint_level", "维保级别", "enum", 2,
                        opts("oem:原厂:1", "gold:金牌", "silver:银牌", "thirdparty:第三方", "none:无维保")),
                AttrDef.of("maint_status", "维保状态", "enum", 3,
                        opts("active:在保", "expiring:即将到期", "expired:已过保", "none:未维保:1")),
                AttrDef.of("maint_start", "维保起始", "date", 4),
                AttrDef.of("maint_expire", "维保到期", "date", 5),
                AttrDef.of("maint_contract_no", "维保合同号", "singlechar", 6),
                AttrDef.of("maint_contact", "维保联系人", "singlechar", 7),
                AttrDef.of("maint_response_sla", "响应SLA", "singlechar", 8),
                AttrDef.of("maint_remark", "维保备注", "longchar", 9)
        );
        return insertMissing(modelId, "maintenance", defs);
    }

    /** 云资源池/K8s 专属标量（resource_pool 现有 12 字段未覆盖的运维/版本信息）。返回新增个数。 */
    private int ensureCloudPoolAttributes(String modelId) {
        List<AttrDef> defs = List.of(
                AttrDef.of("k8s_version", "K8s版本", "singlechar", 30),
                AttrDef.of("api_server", "API Server", "singlechar", 31),
                AttrDef.of("cni_plugin", "网络插件", "singlechar", 32),
                AttrDef.of("runtime", "容器运行时", "enum", 33,
                        opts("containerd:containerd:1", "docker:docker", "cri-o:CRI-O")),
                AttrDef.of("ha_enabled", "高可用", "bool", 34),
                AttrDef.of("monitor_enabled", "监控纳管", "bool", 35)
        );
        return insertMissing(modelId, "capacity", defs);
    }

    /** 对一组属性定义逐个判存在后插入，返回实际新增数。 */
    private int insertMissing(String modelId, String groupId, List<AttrDef> defs) {
        int n = 0;
        for (AttrDef d : defs) {
            boolean exists = attributeMapper.selectCount(new LambdaQueryWrapper<CiAttribute>()
                    .eq(CiAttribute::getTenantId, TENANT)
                    .eq(CiAttribute::getModelId, modelId)
                    .eq(CiAttribute::getFieldKey, d.fieldKey)) > 0;
            if (exists) continue;
            CiAttribute a = new CiAttribute();
            a.setTenantId(TENANT);
            a.setModelId(modelId);
            a.setFieldKey(d.fieldKey);
            a.setName(d.name);
            a.setGroupId(groupId);
            a.setFieldType(d.fieldType);
            a.setIsRequired(false);
            a.setIsEditable(true);
            a.setIsUnique(false);
            a.setIsBuiltIn(true);
            a.setSortOrder(d.sortOrder);
            a.setCreatedBy(SYSTEM_USER);     // 同 ensureMaintenanceGroup：显式置 0 避开自动填充缺失
            a.setUpdatedBy(SYSTEM_USER);
            if (d.option != null) a.setOption(d.option);
            attributeMapper.insert(a);
            n++;
        }
        return n;
    }

    // ---- enum option 构造：每项 "id:name" 或 "id:name:1"（末位 1 = is_default） ----
    private static List<Map<String, Object>> opts(String... items) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String it : items) {
            String[] p = it.split(":");
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", p[0]);
            m.put("name", p.length > 1 ? p[1] : p[0]);
            m.put("is_default", p.length > 2 && "1".equals(p[2]));
            list.add(m);
        }
        return list;
    }

    private record AttrDef(String fieldKey, String name, String fieldType, int sortOrder,
                           List<Map<String, Object>> option) {
        static AttrDef of(String k, String n, String t, int s) {
            return new AttrDef(k, n, t, s, null);
        }
        static AttrDef of(String k, String n, String t, int s, List<Map<String, Object>> opt) {
            return new AttrDef(k, n, t, s, opt);
        }
    }
}
