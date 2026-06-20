# Issue #64 Final Extreme Review Notes — AC2 Test Debt

> 日期: 2026-06-21  
> 作者: Docs (kanban task t_ec0a8490)  
> 状态: Final review required (non-blocking for AC2 merge)  
> 关联任务: QA AC2 t_94d43168 | ENG AC2 t_627f2e3e | ENG AC2b t_e3dca134  
> 分支: feature/cmdb-architecture-debt-phase2

---

## 背景

Issue #64 AC2（ci_instance_rel topology SQL column cleanup）的代码修复已完成并经过 QA 验证通过。ENG AC2（t_627f2e3e，commit 3d46e8fa3）修复了 CiInstanceRelMapper.findTopologyEdges 中 15 处递归 CTE SQL 列名引用，ENG AC2b（t_e3dca134，commit c25415fa5）修复了 ImpactAnalysisService.buildCteSql 中 19 处镜像问题。QA（t_94d43168）确认所有 AC2 准入标准均已满足：schema 验证通过、Maven 编译通过、迁移安全、零表/实体变更。

QA 在验证过程中发现了两项非阻塞但需要纳入最终极端审查（Final Extreme Review）的问题。这两个问题**不是 AC2 缺陷**，而是**既有技术债务或 Spec 不准确之处**，必须在合入 development 之前完成审查决策。

---

## 最终审查清单

### 1. 既有过期测试桩导致 Maven test-compile 失败

**发现来源**：QA AC2 任务 t_94d43168 — 在执行 `mvn test` 时发现 test-compile 阶段失败。

**问题描述**：

| 文件 | 缺失/重命名的引用类型 |
|------|---------------------|
| `CiInstanceRelServiceTest.java` | `CreateRelRequest`, `CiInstanceRelService`, `CiInstanceRelMapper`, `CiAssociationDefMapper`, `CiAssociationKindMapper`, `CiInstanceMapper`, `CiModelMapper` |
| `UserServiceTest.java` | `UserDetailVO` |

这两个测试文件引用了在早期重构中已被移除或重命名的类，导致整个测试套件无法完成编译。

**因果关系确认**：QA 在 AC2 的父提交 `ef6f68656` 上重现了完全相同的编译错误，**证明这些错误在 AC2 之前就已存在，不是 AC2 引入的**。

**影响**：
- AC2 的变更是纯 SQL 字符串修复，不影响 main compile。
- 但过期测试桩阻止了 `mvn test` 的执行，使得无法通过单元测试验证 AC2 变更的正确性（QA 只能通过代码审查 + Maven compile + schema 验证来确认）。
- 如果 main compile 依赖了相关类型，完整测试套件将有编译级阻断风险。

**最终审查需决策**：

- [ ] **选项 A: 移植缺失类** — 将 CreateRelRequest、CiInstanceRelService 等被引用的类型从 git 历史中恢复或重新创建，使测试桩恢复可编译。
- [ ] **选项 B: 更新 Mock** — 修改测试文件中的 import 和 mock 引用，对齐当前代码库的实际类型。
- [ ] **选项 C: 删除过期测试** — 如果被测试的功能已被完全移除或重构，则删除 CiInstanceRelServiceTest.java 和 UserServiceTest.java。
- [ ] **选项 D: 标记 @Disabled 并记录** — 暂时保留但禁用测试，创建独立清理任务在后续 Sprint 中处理。

**审查决策记录**（由 Final Reviewer 填写）：

```
决策: [A/B/C/D / 其他]
理由:
执行人:
日期:
```

---

### 2. Spec/测试守卫不匹配 — CiInstanceRelMapperTest 缺失

**发现来源**：QA AC2 任务 t_94d43168 — Spec §6 AC2 描述中存在与事实不符的断言。

**问题描述**：

| 项目 | 内容 |
|------|------|
| Spec 声称 | "CiInstanceRelMapperTest 已有回归 guard（见 mapper 注释 :19-26），扩展用例覆盖新列名" |
| QA 实测 | 该测试**不存在且从未存在过**。`git log --all -S 'findTopologyEdges'` 仅显示最初引入 Mapper 的 commit，无伴随测试。Mapper 自身的内联注释（L19-26）引用此回归守卫如同其存在，但实际并未实现。 |

**影响**：
- `findTopologyEdges` 递归 CTE 是 CRITICAL P1 路径（`GET /cmdb/topology/{instanceId}` 和 `GET /api/cmdb/instances/{id}/impact`）。
- 当前没有自动化测试验证 CTE SQL 的列名正确性 — AC2 修复后变为运行时正确，但未来的 Schema 变更（添加/重命名 ci_instance_rel 列）不会触发任何测试告警。
- Spec 中的不准确描述可能导致后续开发者误以为已有测试覆盖而跳过回归验证。

**最终审查需决策**：

- [ ] **添加 CiInstanceRelMapperTest（推荐）** — 编写真实测试，验证 `findTopologyEdges` 的 CTE SQL 输出列（srcInstanceId, dstInstanceId, associationKind, distance）与 MyBatis 映射字段一致。使用 H2/Testcontainers 内存数据库，确保列名变更时立即失败。
- [ ] **添加 Mapper 注释守卫（备选）** — 仅增强 CiInstanceRelMapper.java 中的注释，将其作为文档级别的"列名合约"而非 Spec 中声称的回归测试。
- [ ] **明确记录不添加原因** — 如果决定不添加测试，必须在此文档中明确记录原因（例如：上下游已覆盖、测试环境限制、优先级较低等）。

**审查决策记录**（由 Final Reviewer 填写）：

```
决策: [添加测试 / 注释守卫 / 明确不添加 / 其他]
理由:
执行人:
日期:
```

---

## 关联任务摘要

| 任务 ID | 角色 | 标题 | 状态 | 关键产出 |
|---------|------|------|------|----------|
| t_627f2e3e | Engineer | AC2 CiInstanceRelMapper CTE SQL 修复 | ✅ Done | commit 3d46e8fa3, 15 token 修复 |
| t_e3dca134 | Engineer | AC2b ImpactAnalysisService CTE SQL 修复 | ✅ Done | commit c25415fa5, 19 token 修复 |
| t_94d43168 | QA | AC2 验证 | ✅ Approved | 5/5 AC 通过, 3 项发现 |

---

## AC2-AC4 QA findings to revisit during final extreme review

> 本节汇总 AC2（t_94d43168）、AC2b（t_e3dca134）、AC3（t_fc14bd61）、AC4（t_d29a79e2）的 QA 审查发现中尚未加入上述最终审查清单的项目。其中 AC2 第 1、2 项已在上方详述，此处仅补充第 3 项及 AC3/AC4 的发现。

---

### 3. ImpactAnalysisService CRITICAL 递归 CTE 列名 Bug — 回归检查

| 字段 | 内容 |
|------|------|
| **发现来源** | QA AC2 任务 t_94d43168 |
| **修复任务** | ENG AC2b t_e3dca134 |
| **修复提交** | commit c25415fa5 |
| **修复内容** | ImpactAnalysisService.java:99-116，19 处递归 CTE SQL 列名引用修复（与 AC2 CiInstanceRelMapper 镜像问题） |
| **严重级别** | CRITICAL — 影响 `GET /api/cmdb/instances/{id}/impact` 拓扑影响分析 |
| **当前状态** | ✅ 已修复（AC2b） |

**最终审查需验证**：

- [ ] **回归验证**：确认 ImpactAnalysisService.buildCteSql 中所有递归 CTE 列名引用（ci_instance_rel 表列）与当前 Schema 一致。运行 `mvn test -Dtest=ImpactAnalysisServiceTest`（若测试存在）或手动审查 `ImpactAnalysisService.java` L99-116 的 `buildCteSql` 方法。
- [ ] **拓扑/影响分析 SQL 列名一致性**：确保 CiInstanceRelMapper.findTopologyEdges（AC2，commit 3d46e8fa3）和 ImpactAnalysisService.buildCteSql（AC2b，commit c25415fa5）两处 CTE SQL 的列名引用策略一致，未来 Schema 变更时不会出现单边修复导致的遗漏。
- [ ] **迁移安全性**：确认 AC2b 的 `V41__fix_impact_analysis_cte_columns.sql` 迁移脚本（若有）与 AC2 的 `V40__fix_topology_cte_columns.sql` 无冲突、可独立回滚。

---

### 4. AC3 回归清单（t_fc14bd61）

| 字段 | 内容 |
|------|------|
| **发现来源** | QA AC3 任务 t_fc14bd61 |
| **审查结论** | ✅ Approved — 无阻塞发现，3 项信息性备注 |
| **审查范围** | CiInstanceRel 创建向导：defId 选择 → model 匹配 → 去重 → 1:1 基数 → 元数据 schema |

最终审查回归验证项：

- [ ] **defId 存在 → model 匹配 → 去重 → 1:1 基数 → metadata schema**：完整链路端到端验证，确保每步的边界条件（无效 defId、空 model 匹配、重复关联、违反基数约束、metadata schema 不匹配）均有正确错误处理。
- [ ] **V41 回填幂等性（RAISE NOTICE）**：验证 V41 迁移脚本对已有数据的回填使用 RAISE NOTICE 而非 RAISE EXCEPTION，确保重复执行不产生硬错误。
- [ ] **前端向导流程**：确认前端先选择关联定义（def），再按 def.dst_model_id 过滤 peer 搜索，搜索结果的 model 类型与 def 的 dst_model 一致。

---

### 5. AC4 遗留项（t_d29a79e2）

| 字段 | 内容 |
|------|------|
| **发现来源** | QA AC4 任务 t_d29a79e2 |
| **审查范围** | CSV 批量导入 / 前端路由兼容性 |

#### 5a. 旧 [modelId] 路由重定向 — 延期至 AC10

- [ ] **AC10 验证**：Spec 第 548 行将 `/cmdb/resource/[modelId]` → `/cmdb/resource/[modelCode]` 重定向标记为 AC10 范围。最终审查需确认 AC10 是否已完成此迁移，或是否有明确的延期记录。
- [ ] **重定向 / 404 行为**：确认旧路由被移除后返回 301/308 重定向还是 404。如有外部链接依赖旧路由，需确保不少于 2 个版本的过渡期。

#### 5b. CiInstanceSearchVO.modelId 蛇形别名 — 兼容性决策

- [ ] **别名移除决策**：`CiInstanceSearchVO.modelId` 当前保留 `@JsonProperty("model_id")` 蛇形命名别名。前端消费者仍从搜索响应中读取 `model_id`（蛇形）。最终审查需决定：
  - **选项 A**：保持兼容窗口，待前端全部迁移至 `modelId`（驼峰）后统一移除别名。
  - **选项 B**：在 AC10 或独立任务中同步移除别名并更新前端消费点。
  - **选项 C**：保留别名作为永久兼容层。
- [ ] **前端消费者审计**：搜索所有前端代码中对 `model_id`（蛇形）的引用，确认数量及迁移成本。

#### 5c. layout.tsx activeModelCode 比较 — 兼容性窗口检查

- [ ] **兼容性验证**：`layout.tsx` 中 `activeModelCode === m.modelId` 比较在当前兼容窗口内成立（因为 `modelId` 取值为 `model.name`）。最终审查需确认：
  - 若 `modelId` 改为数字 ID（非 `model.name`），此比较是否会断裂。
  - 是否需要改为 `m.modelCode` 的比较。

#### 5d. 过期测试桩（与 AC2 发现 #1 相同）

- [ ] **确认是否已处理**：AC4 QA 发现与 AC2 相同的过期测试桩编译失败。在最终审查时确认此项已按上方 §1 的决策执行完毕。

---

## 关联任务扩展摘要

| 任务 ID | 角色 | 标题 | 状态 | 关键产出 |
|---------|------|------|------|----------|
| t_627f2e3e | Engineer | AC2 CiInstanceRelMapper CTE SQL 修复 | ✅ Done | commit 3d46e8fa3, 15 token 修复 |
| t_e3dca134 | Engineer | AC2b ImpactAnalysisService CTE SQL 修复 | ✅ Done | commit c25415fa5, 19 token 修复 |
| t_94d43168 | QA | AC2 验证 | ✅ Approved | 5/5 AC 通过, 3 项发现 |
| t_fc14bd61 | QA | AC3 验证 | ✅ Approved | 无阻塞, 3 项信息性备注 |
| t_d29a79e2 | QA | AC4 验证 | ✅ Approved | 4 项遗留/兼容性发现 |

---

## 审查签名

| 角色 | 姓名 | 审查结论 | 日期 |
|------|------|---------|------|
| Final Reviewer | | ⬜ 待审查 | |
| Tech Lead | | ⬜ 待审查 | |
| PM | | ⬜ 待审查 | |
