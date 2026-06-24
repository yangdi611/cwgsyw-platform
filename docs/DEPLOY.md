# 生产部署指南（云服务器 + Docker Compose + HTTPS）

适用：单台云服务器（≥4GB 内存），有域名，需 HTTPS。整套 6 容器（PG/Redis/MinIO/backend/frontend/nginx）在服务器上直接构建运行。

> 把下文 `your-domain.com` 全部替换为你的真实域名。

---

## 0. 前置条件

- 域名已解析到服务器公网 IP（A 记录）
- 云厂商**安全组只放行 22 / 80 / 443**，其余端口（5433/6380/9010 等）一律不开
- 服务器已装 Docker + Compose 插件：
  ```bash
  curl -fsSL https://get.docker.com | sh
  docker compose version   # 确认有输出
  ```

---

## 1. 拉代码 + 配置 .env

```bash
git clone https://github.com/yangdi611/cwgsyw-platform.git
cd cwgsyw-platform
cp .env.example .env
```

生成强密钥并填入 `.env`：

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPT_KEY=$(openssl rand -base64 32)"   # ⚠️ 一次性，生成后永久保管
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)"
```

把输出逐项写进 `.env`，并设置：
- `POSTGRES_DB=platform_user`、`POSTGRES_USER=platform_user`（与当前实现一致，见 CLAUDE.md DB 命名说明）
- `MINIO_ROOT_USER=`（自定义一个非 minioadmin 的名字）
- `NEXT_PUBLIC_API_URL=https://your-domain.com/api`

> `.env` 已被 `.gitignore` 忽略，不会进仓库。务必把 `ENCRYPT_KEY` 单独备份到密码管理器——改了它，设备密码库里所有已加密的密码都解不开。

---

## 2. 首次签发 HTTPS 证书（解决「先有鸡还是先有蛋」）

nginx 的 443 配置需要证书文件才能启动，但签证书又需要 80 端口可达。所以先用临时 HTTP-only nginx 完成 ACME 校验：

```bash
mkdir -p nginx/certs nginx/certbot-webroot

# 临时起一个只监听 80、提供 webroot 的 nginx
docker run -d --name certbot-nginx -p 80:80 \
  -v "$PWD/nginx/certbot-webroot:/usr/share/nginx/html" \
  nginx:alpine

# 用 certbot 通过 webroot 方式签发
docker run --rm \
  -v "$PWD/nginx/certs:/etc/letsencrypt/live-out" \
  -v "$PWD/nginx/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d your-domain.com --email you@example.com --agree-tos --no-eff-email \
  --cert-name app

# certbot 把证书放在 /etc/letsencrypt/live/app/，拷到 nginx 期望路径
docker run --rm -v "$PWD/nginx/certs:/c" certbot/certbot \
  sh -c "cp /etc/letsencrypt/live/app/fullchain.pem /c/ && cp /etc/letsencrypt/live/app/privkey.pem /c/" 2>/dev/null \
  || echo "若上一步证书在容器内，见下方备注"

docker rm -f certbot-nginx
```

> 备注：certbot 的 live 目录是符号链接，跨容器拷贝可能失败。更稳妥的做法见第 6 节「证书续期」里的持久化卷方式；首次也可直接用宿主机 certbot：`apt install certbot && certbot certonly --webroot -w nginx/certbot-webroot -d your-domain.com`，再把 `/etc/letsencrypt/live/your-domain.com/{fullchain,privkey}.pem` 复制到 `nginx/certs/`。

---

## 3. 构建并启动整套服务

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`prod` override 的作用：移除 PG/Redis/backend/frontend 的对外端口，MinIO 仅绑 `127.0.0.1`，nginx 开 80+443 并挂载 `nginx.prod.conf` 和证书。对外只剩 80/443。

确认后端起来 + Flyway 迁移成功（应能看到 V51 已应用）：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend -f
```

---

## 4. 验证

```bash
curl -k https://your-domain.com/api/health      # 期望 {"status":"UP"}
```

浏览器打开 `https://your-domain.com`，证书应为绿锁。

**部署后第一件事**：用 `superadmin / Admin@123` 登录，立即在用户管理里改掉超管密码。

---

## 5. 数据与备份

- 数据落盘位置：PG 在 `pgdata_*` 卷，MinIO/Redis 在 `./data/`，平台备份在 `./data/backups/`
- 平台自带备份模块 `/admin/backup`（admin-only，PG dump + MinIO 全量打包）
- 宿主机层面也建议定期 `tar` 打包 `./data/` 并异地存放

---

## 6. 证书自动续期（Let's Encrypt 90 天有效）

用宿主机 certbot 续期最省心。建一个 cron（每月 1 号 3:17 续期并重载 nginx，避开整点）：

```bash
# crontab -e
17 3 1 * * certbot renew --webroot -w /path/to/cwgsyw-platform/nginx/certbot-webroot --quiet --deploy-hook "cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/cwgsyw-platform/nginx/certs/ && cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/cwgsyw-platform/nginx/certs/ && docker compose -f /path/to/cwgsyw-platform/docker-compose.yml -f /path/to/cwgsyw-platform/docker-compose.prod.yml exec nginx nginx -s reload"
```

---

## 7. 日常运维

```bash
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# 更新代码后重新部署
git pull && $C up -d --build

# 只重建后端（改了 migration 要 --no-cache 确保打进 JAR）
$C build --no-cache backend && $C up -d backend

# 改了 nginx.prod.conf（bind mount，无需 rebuild）
$C exec nginx nginx -s reload

# 看日志 / 状态
$C logs backend -f
$C ps
```

---

## 8. 上线前安全清单

- [ ] `.env` 所有 `change_me_*` 已替换为强随机值
- [ ] `ENCRYPT_KEY` 已单独备份（不可再改）
- [ ] 云安全组只放行 22 / 80 / 443
- [ ] `docker compose ps` 确认 PG/Redis/backend/frontend 无 `0.0.0.0` 端口映射
- [ ] superadmin 默认密码 `Admin@123` 已修改
- [ ] HTTPS 绿锁正常，HTTP 自动跳转 HTTPS
- [ ] 证书续期 cron 已配置

