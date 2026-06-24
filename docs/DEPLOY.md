# 部署指南（本地部署 + Cloudflare 代理 + HTTPS）

本平台部署在**本地机器**（如 `192.168.50.101`），通过路由器 DDNS + 端口转发暴露公网，再经 **Cloudflare 代理**对外提供 HTTPS 访问。整套 6 容器（PG/Redis/MinIO/backend/frontend/nginx）在本地机器上直接构建运行。

```
访客浏览器 ──HTTPS──▶ Cloudflare 边缘 ──HTTPS(Origin证书)──▶ 路由器(端口转发443) ──▶ 本地机器:443(nginx)
            CF 自带边缘证书          Full(strict) 校验 Origin 证书
```

> 把下文 `your-domain.com` 全部替换为你的真实域名。

---

## 0. 前置条件

- 本地机器已装 Docker + Compose 插件：`docker compose version` 有输出
- 域名已托管在 Cloudflare，DNS 记录（CNAME 指向 DDNS 域名，或 A 记录）已开启**橙色云朵代理**
- 路由器已配置 DDNS + 端口转发：外网 **443 → 192.168.50.101:443**（80 可选）
- 路由器/本地防火墙只放行 443（及可选 80）

---

## 1. 拉代码 + 配置 .env

```bash
git clone -b development https://github.com/yangdi611/cwgsyw-platform.git
cd cwgsyw-platform
cp .env.example .env
```

生成强密钥并填入 `.env`：

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPT_KEY=$(openssl rand -base64 32)"   # 一次性，生成后永久保管
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)"
```

逐项写进 `.env`，并设置：
- `POSTGRES_DB=platform_user`、`POSTGRES_USER=platform_user`（与当前实现一致）
- `MINIO_ROOT_USER=`（自定义一个非 minioadmin 的名字）
- `NEXT_PUBLIC_API_URL=https://your-domain.com/api`

> `.env` 已被 `.gitignore` 忽略。`ENCRYPT_KEY` 务必单独备份——改了它，设备密码库已加密的密码全部解不开。

---

## 2. 获取 Cloudflare Origin 证书

开了 Cloudflare 代理后，浏览器→Cloudflare 这段 HTTPS 由 Cloudflare 自动提供，**无需 Let's Encrypt**。只给 Cloudflare→本地这段配一张 Origin 证书（15 年有效，免续期）：

1. Cloudflare 后台 → **SSL/TLS → Origin Server → Create Certificate**
2. 主机名填 `your-domain.com` 和 `*.your-domain.com`，有效期选 **15 年**
3. 「Origin Certificate」存为 `nginx/certs/fullchain.pem`
4. 「Private Key」存为 `nginx/certs/privkey.pem`，并 `chmod 600 nginx/certs/privkey.pem`

然后在 Cloudflare 后台：
- **SSL/TLS → Overview** 模式改为 **Full (strict)**
- **SSL/TLS → Edge Certificates** 开启 **Always Use HTTPS**

> 两个 `.pem` 已被 `nginx/certs/.gitignore` 忽略，私钥不会进仓库。

---

## 3. 构建并启动

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`prod` override 的作用：移除 PG/Redis/backend/frontend/MinIO 的对外端口（仅走 Docker 内部网络），只让 nginx 暴露 80/443，并挂载 `nginx.prod.conf` 与 `nginx/certs/`。

确认后端起来 + Flyway 迁移成功（应能看到 V51 已应用）：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend -f
```

---

## 4. 验证

- 本地直连源站（跳过 Cloudflare，证书是 Origin 证书所以加 -k）：
  ```bash
  curl -k https://192.168.50.101/api/health     # 期望 {"status":"UP"}
  ```
- 公网经 Cloudflare：浏览器打开 `https://your-domain.com`，应为绿锁、无警告

**部署后第一件事**：用 `superadmin / Admin@123` 登录，立即修改超管密码。

---

## 5. nginx 配置要点（已在 nginx.prod.conf 中配好）

- **Origin 证书路径**：`/etc/nginx/certs/fullchain.pem` + `privkey.pem`
- **真实访客 IP 还原**：经 Cloudflare 代理后，源站看到的是 CF 节点 IP；配置已用 `set_real_ip_from`（Cloudflare 官方 IP 段）+ `real_ip_header CF-Connecting-IP` 还原真实 IP，审计日志才能记录正确 operatorIp
- **备份接口超时**：`/api/backups` 已单独放宽到 600s + 2g body
- 若 Cloudflare 官方 IP 段更新（https://www.cloudflare.com/ips/），需同步 `nginx.prod.conf` 里的 `set_real_ip_from`

---

## 6. 数据与备份

- 数据落盘：PG 在 `pgdata_*` 卷，MinIO/Redis 在 `./data/`，平台备份在 `./data/backups/`
- 平台自带备份模块 `/admin/backup`（admin-only，PG dump + MinIO 全量打包）
- 本机层面也建议定期 `tar` 打包 `./data/` 异地存放

---

## 7. 日常运维

```bash
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

git pull && $C up -d --build           # 更新代码后重新部署
$C build --no-cache backend && $C up -d backend   # 改了 migration 用 --no-cache
$C exec nginx nginx -s reload          # 改了 nginx.prod.conf / 换了证书
$C logs backend -f                     # 看日志
$C ps                                  # 看状态
```

---

## 8. 上线前安全清单

- [ ] `.env` 所有 `change_me_*` 已替换为强随机值
- [ ] `ENCRYPT_KEY` 已单独备份（不可再改）
- [ ] Origin 证书已放入 `nginx/certs/`，私钥 `chmod 600`
- [ ] Cloudflare SSL 模式为 Full (strict)，Always Use HTTPS 已开
- [ ] 路由器端口转发仅 443（及可选 80），未暴露其他端口
- [ ] `docker compose ps` 确认 PG/Redis/backend/frontend/MinIO 无对外端口映射
- [ ] superadmin 默认密码 `Admin@123` 已修改
- [ ] 公网 `https://your-domain.com` 绿锁正常
