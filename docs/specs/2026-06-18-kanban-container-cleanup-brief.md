# Brief: Kanban 遗留容器清理与部署环境规范化

## 背景
用户在 `docker ps` 中看到多个 `t_<taskid>-*` 容器，判断为 Kanban/worktree 部署遗留。当前存在多个任务前缀容器：

- `t_a49c9ecd-*`: redis/minio 仍运行，backend/frontend/nginx 已停止
- `t_0b37ebfd-*`: postgres/minio 仍运行，其他服务 Created
- `t_7827bd5c-*`: 多个 Created 状态容器
- 还有非命名容器 `fervent_albattani`

这些容器造成环境混乱、端口占用、部署验证歧义。

## 当前风险
- Redis/MinIO/Postgres 属于数据容器，不能直接删除 volume。
- 旧 worktree 容器可能残留端口或网络，影响 nginx/backend/frontend 的启动。
- QA 已确认 CMDB P0 修复通过，但 nginx `/api` 有启动顺序/DNS race 老问题，需要在清理后复核。

## 清理原则
1. 先盘点，不直接删除。
2. 必须列出每个容器的 compose project、service、status、ports、mounts/volumes。
3. 运行中的数据容器（postgres/redis/minio）必须标记“保留/可删/需备份”。
4. 只清理明确无用的 Created/Exited worktree 容器和网络。
5. 删除 volume 前必须明确说明是否有数据和备份策略；默认不删 volume。
6. 清理后验证标准端口和当前服务可用性。

## 初始发现
```text
t_a49c9ecd-redis-1: Up, 6380->6379
t_a49c9ecd-minio-1: Up, 9010/9011
t_a49c9ecd-backend/frontend/nginx: Exited
t_0b37ebfd-postgres-1: Up healthy, no host port
t_0b37ebfd-minio-1: Up, no host port
t_7827bd5c-* Created
t_0b37ebfd-backend/frontend/nginx/redis Created
```

## 验收标准
- 输出完整容器/volume/network 清单。
- 用户可理解哪些被保留、哪些被清理。
- 无 Created/Exited 的 `t_*` 僵尸容器残留。
- 不误删 postgres/minio/redis 数据 volume。
- 标准端口占用清晰：80/3001/8081/5433/6380/9010/9011。
- 清理后 `docker ps` 可读，当前部署环境唯一且明确。
- 如 nginx `/api` 仍 502，需单独报告为启动顺序/DNS race 后续 issue，不混入本清理任务。
