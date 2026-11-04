package com.cwgsyw.platform.module.sosreport;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.security.SecurityUser;
import org.apache.ibatis.builder.MapperBuilderAssistant;

import java.util.List;
import java.util.Map;
import java.util.Set;

public final class SosTestSupport {

    private SosTestSupport() {
    }

    /** Lambda 条件构造器依赖 MyBatis-Plus 的表信息缓存。 */
    public static void initTables() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "sosReportTest");
        for (Class<?> type : List.of(SosReport.class, SosFieldMapping.class, SosCmdbRequest.class, CiInstance.class)) {
            TableInfoHelper.initTableInfo(assistant, type);
        }
    }

    public static SecurityUser user(String tenantId, Long id, String... permissions) {
        return new SecurityUser(id, "user" + id, "x", tenantId, 1L, "tenant", Set.of(permissions));
    }

    public static CiAttribute attribute(String key, String type) {
        CiAttribute attribute = new CiAttribute();
        attribute.setFieldKey(key);
        attribute.setName(key);
        attribute.setFieldType(type);
        attribute.setGroupId("base");
        attribute.setIsRequired(false);
        attribute.setIsEditable(true);
        attribute.setIsUnique(false);
        attribute.setIsBuiltIn(false);
        return attribute;
    }

    public static CiAttribute enumAttribute(String key, String... ids) {
        CiAttribute attribute = attribute(key, "enum");
        attribute.setOption(java.util.Arrays.stream(ids).map(id -> Map.of("id", id, "name", id)).toList());
        return attribute;
    }

    /** 与种子数据一致：sn 和 inner_ip 必填、唯一、不可编辑。 */
    public static CiAttribute identity(String key) {
        CiAttribute attribute = attribute(key, "singlechar");
        attribute.setIsRequired(true);
        attribute.setIsEditable(false);
        attribute.setIsUnique(true);
        attribute.setIsBuiltIn(true);
        return attribute;
    }
}
