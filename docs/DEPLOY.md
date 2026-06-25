# UAT/生产部署指南（云服务器 + Cloudflare + HTTPS）

适用：有**固定公网 IP** 的云服务器，域名托管在 Cloudflare（开启橙色云朵代理）。
整套 6 容器（PG/Redis/MinIO/backend/frontend/nginx）在云服务器上直接构建运行，nginx 用 Cloudflare Origin 证书提供 HTTPS。

> 把下文 `your-uat-domain.com` 替换为你的真实 UAT 域名。
> 本机 dev 环境是纯 HTTP（CGNAT 无公网 IP），与此文无关，见 CLAUDE.md「部署环境」。

---

## 0. 前置条件

- 云服务器已装 Docker + Compose：`docker compose version` 有输出
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- 域名已托管在 Cloudflare，DNS 记录指向云服务器公网 IP，**开启橙色云朵代理**
- 云厂商安全组**只放行 22 / 80 / 443**

---

## 1. 拉代码

```bash
git clone -b development https://github.com/yangdi611/cwgsyw-platform.git
cd cwgsyw-platform
```

> 用 development 分支：最新代码 + prod 部署文件都在这里（master 落后很多）。

---

## 2. 建本地数据目录

`./data/` 已被 .gitignore 忽略，clone 下来没有，需手动建（避免 Docker 自动建成 root 属主）：

```bash
mkdir -p data/postgres data/redis data/minio data/backups
```

> PostgreSQL 数据已改为绑定挂载到 `./data/postgres`（便于备份和迁移）。
> ⚠️ postgres:16-alpine 容器内 postgres 用户是 UID 70。全新部署通常自动设好属主；
> 若启动报 `data directory has wrong ownership` 或权限错误，执行：
> ```bash
> sudo chown -R 70:70 data/postgres
> ```
> 想放到独立数据盘时，把 docker-compose.prod.yml 里 `./data/postgres` 改成绝对路径（如 `/mnt/data/postgres`），其余 `./data/*` 同理。

---

## 3. 配置 .env

```bash
cp .env.example .env
```

生成强密钥：

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPT_KEY=$(openssl rand -base64 32)"   # 一次性，生成后永久保管
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)"
```

逐项写进 `.env`，并设置：
- `POSTGRES_DB=platform_user`、`POSTGRES_USER=platform_user`
- `MINIO_ROOT_USER=`（自定义，别用 minioadmin）
- `NEXT_PUBLIC_API_URL=https://your-uat-domain.com/api`

> `ENCRYPT_KEY` 务必单独备份——改了它，设备密码库已加密的密码全部解不开。

---

## 4. 放 Cloudflare Origin 证书

prod 用 HTTPS。开了 Cloudflare 代理后，浏览器↔Cloudflare 这段证书由 Cloudflare 自动提供；
只需给 Cloudflare↔源站这段配一张 Origin 证书（15 年有效，免续期）：

1. Cloudflare 后台 → **SSL/TLS → Origin Server → Create Certificate**
2. 主机名填 `your-uat-domain.com`，有效期选 **15 年**
3. 「Origin Certificate」存为 `nginx/certs/fullchain.pem`
4. 「Private Key」存为 `nginx/certs/privkey.pem`，并 `chmod 600 nginx/certs/privkey.pem`
5. Cloudflare → SSL/TLS → Overview，模式设为 **Full (strict)**；Edge Certificates 开 **Always Use HTTPS**

> 两个 `.pem` 已被 `nginx/certs/.gitignore` 忽略，不会进仓库。

---

## 5. 构建并启动

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

prod 配置：仅 nginx 暴露 80/443，其余服务走 Docker 内网；nginx 含真实访客 IP 还原（CF-Connecting-IP）。

看后端起来 + Flyway 迁移成功：

```bash
docker compose -f docker-compose.prod.yml logs backend -f
```

---

## 6. 验证

```bash
curl -k https://localhost/api/health     # 期望 {"status":"UP"}
```

浏览器打开 `https://your-uat-domain.com`，应为绿锁。

**部署后第一件事**：用 `superadmin / Admin@123` 登录，立即修改超管密码。

---

## 7. 日常运维

```bash
C="docker compose -f docker-compose.prod.yml"

git pull && $C up -d --build                      # 更新代码后重新部署
$C build --no-cache backend && $C up -d backend   # 改了 migration 用 --no-cache
$C exec nginx nginx -s reload                     # 改了 nginx.prod.conf / 换了证书
$C logs backend -f                                # 看日志
$C ps                                             # 看状态
```

---

## 8. 数据与备份

- 数据落盘：PG、Redis、MinIO 均在 `./data/`（postgres/redis/minio 子目录），平台备份在 `./data/backups/`
- 平台自带备份模块 `/admin/backup`（admin-only，PG dump + MinIO 全量打包）
- 宿主机层面也建议定期 `tar` 打包 `./data/` 异地存放（含 PG 数据，停容器后打包最稳妥）

---

## 9. 上线前安全清单

- [ ] `data/postgres`、`data/redis`、`data/minio`、`data/backups` 已建好（postgres 如有权限报错 `chown -R 70:70 data/postgres`）
- [ ] `.env` 所有 `change_me_*` 已替换为强随机值
- [ ] `ENCRYPT_KEY` 已单独备份（不可再改）
- [ ] Origin 证书已放入 `nginx/certs/`，私钥 `chmod 600`
- [ ] Cloudflare SSL 模式为 Full (strict)，Always Use HTTPS 已开
- [ ] 云安全组只放行 22 / 80 / 443
- [ ] `$C ps` 确认 PG/Redis/backend/frontend/MinIO 无对外端口映射
- [ ] superadmin 默认密码 `Admin@123` 已修改
- [ ] 公网 `https://your-uat-domain.com` 绿锁正常
