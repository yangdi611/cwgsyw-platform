# nginx 证书目录

生产环境（Cloudflare Origin 证书 + Full strict）下，这里放两个文件：

- `fullchain.pem` — Cloudflare 后台签发的 Origin 证书内容
- `privkey.pem`   — Origin 证书对应的私钥

## 获取步骤

1. Cloudflare 后台 → SSL/TLS → Origin Server → Create Certificate
2. 主机名填 `yourdomain.com` 和 `*.yourdomain.com`，有效期选 15 年
3. 把「Origin Certificate」那段文本保存为 `fullchain.pem`
4. 把「Private Key」那段文本保存为 `privkey.pem`

## 注意

- 这两个 `.pem` 文件已被 `.gitignore` 忽略，**不会进仓库**（私钥严禁提交）
- 权限建议：`chmod 600 privkey.pem`
- 证书有效期 15 年，无需像 Let's Encrypt 那样定期续期
- 替换证书后重载：`docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload`
