package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class CiInstanceRelMapperTopologySqlTest {

    @Test
    void topologyTraversalKeepsVisitedInstancePathBeforeExpandingNeighbors() throws NoSuchMethodException {
        Method method = CiInstanceRelMapper.class.getMethod("findTopologyEdges", Long.class, String.class, int.class);
        String sql = String.join("\n", method.getAnnotation(Select.class).value());

        assertThat(sql).contains("current_id", "visited_ids", "= ANY(t.visited_ids)");
        assertThat(sql).contains("INNER JOIN topo t ON (r.src_id = t.current_id OR r.dst_id = t.current_id)");
    }
}
