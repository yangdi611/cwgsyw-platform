package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.cmdb.dto.changes.ChangeHistoryV2VO;
import com.cwgsyw.platform.module.cmdb.dto.changes.ChangeStatsVO;
import com.cwgsyw.platform.module.cmdb.entity.CiChangeRecord;
import com.cwgsyw.platform.module.cmdb.mapper.CiChangeRecordMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.CiChangeService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CiChangeServiceTest {

    @Mock private CiChangeRecordMapper changeRecordMapper;
    @Mock private UserMapper userMapper;
    @Mock private CiInstanceMapper instanceMapper;
    @Mock private CiModelMapper modelMapper;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private CiChangeService service;

    @BeforeEach
    void setUp() {
        service = new CiChangeService(changeRecordMapper, userMapper, instanceMapper, modelMapper,
                new ObjectMapper(), redisTemplate);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Nested
    class ComputeChangedFields {

        @Test
        void createInstance_beforeIsNull() {
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("name", "server1");
            after.put("status", "online");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(null, after);

            assertThat(result.getFields()).containsExactlyInAnyOrder("name", "status");
            assertThat(result.getSummary()).isEqualTo("创建了实例");
        }

        @Test
        void deleteInstance_afterIsNull() {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("name", "server1");
            before.put("inner_ip", "10.0.0.1");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, null);

            assertThat(result.getFields()).containsExactlyInAnyOrder("name", "inner_ip");
            assertThat(result.getSummary()).isEqualTo("删除了实例");
        }

        @Test
        void bothNull_noChange() {
            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(null, null);

            assertThat(result.getFields()).isEmpty();
            assertThat(result.getSummary()).isEqualTo("无变更");
        }

        @Test
        void noActualChange_sameKeyValues() {
            Map<String, Object> before = Map.of("name", "server1", "status", "online");
            Map<String, Object> after = Map.of("name", "server1", "status", "online");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, after);

            assertThat(result.getFields()).isEmpty();
            assertThat(result.getSummary()).isEqualTo("无实质变更");
        }

        @Test
        void oneFieldChanged() {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("name", "server1");
            before.put("status", "online");

            Map<String, Object> after = new LinkedHashMap<>();
            after.put("name", "server1");
            after.put("status", "offline");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, after);

            assertThat(result.getFields()).containsExactly("status");
            assertThat(result.getSummary()).isEqualTo("修改了 1 个字段: status");
        }

        @Test
        void threeFieldsChanged() {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("hostname", "old-host");
            before.put("inner_ip", "10.0.0.1");
            before.put("status", "online");
            before.put("owner", "admin");

            Map<String, Object> after = new LinkedHashMap<>();
            after.put("hostname", "new-host");
            after.put("inner_ip", "10.0.0.2");
            after.put("status", "offline");
            after.put("owner", "admin");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, after);

            assertThat(result.getFields()).containsExactlyInAnyOrder("hostname", "inner_ip", "status");
            assertThat(result.getSummary()).isEqualTo("修改了 3 个字段: hostname, inner_ip, status");
        }

        @Test
        void moreThanThreeFields_summaryEndsWith等() {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("f1", "a");
            before.put("f2", "b");
            before.put("f3", "c");
            before.put("f4", "d");
            before.put("f5", "e");

            Map<String, Object> after = new LinkedHashMap<>();
            after.put("f1", "A");
            after.put("f2", "B");
            after.put("f3", "C");
            after.put("f4", "D");
            after.put("f5", "E");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, after);

            assertThat(result.getFields()).hasSize(5);
            assertThat(result.getSummary()).startsWith("修改了 5 个字段:");
            assertThat(result.getSummary()).endsWith(" 等");
            assertThat(result.getSummary()).contains("f1, f2, f3");
        }

        @Test
        void keyAddedInAfter() {
            Map<String, Object> before = Map.of("name", "server1");
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("name", "server1");
            after.put("status", "online");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, after);

            assertThat(result.getFields()).containsExactly("status");
        }

        @Test
        void keyRemovedFromAfter() {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("name", "server1");
            before.put("status", "online");

            Map<String, Object> after = Map.of("name", "server1");

            CiChangeService.ChangedFieldsResult result =
                    CiChangeService.computeChangedFields(before, after);

            assertThat(result.getFields()).containsExactly("status");
        }
    }

    @Nested
    class ChangeQueryContracts {

        @Test
        void globalChanges_passesKeywordToDatabasePagedQuery() {
            Page<CiChangeRecord> page = new Page<>(1, 20);
            page.setRecords(List.of());
            page.setTotal(0);
            when(changeRecordMapper.queryChanges(any(), eq("tenant-a"), eq(List.of("ci_instance")),
                    isNull(), isNull(), isNull(), isNull(), eq("needle"), isNull(), isNull()))
                    .thenReturn(page);

            PageResult<ChangeHistoryV2VO> result = service.getGlobalChanges(
                    "ci_instance", null, null, " needle ", null, null, null, null, 1, 20, "tenant-a");

            assertThat(result.getTotal()).isZero();
            verify(changeRecordMapper).queryChanges(any(), eq("tenant-a"), eq(List.of("ci_instance")),
                    isNull(), isNull(), isNull(), isNull(), eq("needle"), isNull(), isNull());
        }

        @Test
        void explicitStatsRange_usesOneWindowForCardsAndTop10() {
            when(valueOperations.get(anyString())).thenReturn(null);
            when(changeRecordMapper.queryDailyBreakdown(eq("tenant-a"), eq("2099-01-01T00:00:00"),
                    eq("2099-01-02T00:00:00"), isNull())).thenReturn(List.of());
            when(changeRecordMapper.queryTopChangedInstances(eq("tenant-a"), eq("2099-01-01T00:00:00"),
                    eq("2099-01-02T00:00:00"), isNull())).thenReturn(List.of());

            ChangeStatsVO stats = service.getStats(null, "2099-01-01T00:00:00", "2099-01-02T00:00:00", "tenant-a");

            assertThat(stats.getToday().getTotal()).isZero();
            assertThat(stats.getThisWeek().getTotal()).isZero();
            assertThat(stats.getThisMonth().getTotal()).isZero();
            verify(changeRecordMapper).queryTopChangedInstances("tenant-a", "2099-01-01T00:00:00",
                    "2099-01-02T00:00:00", null);
        }

        @Test
        void statsCacheKey_isTenantScopedAndTop10UsesModelFilter() {
            when(valueOperations.get(anyString())).thenReturn(null);
            when(changeRecordMapper.queryDailyBreakdown(eq("tenant-a"), anyString(), anyString(), eq("host")))
                    .thenReturn(List.of());
            when(changeRecordMapper.queryTopChangedInstances(eq("tenant-a"), anyString(), anyString(), eq("host")))
                    .thenReturn(List.of());

            service.getStats("host", null, null, "tenant-a");

            verify(valueOperations).get(startsWith("cmdb:stats:tenant-a:host:"));
            verify(changeRecordMapper).queryTopChangedInstances(eq("tenant-a"), anyString(), anyString(), eq("host"));
        }
    }
}
