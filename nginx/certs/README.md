# nginx 证书目录（仅 prod/UAT 使用）

放置 Cloudflare Origin 证书（15 年有效，免续期）：
- `fullchain.pem` — Cloudflare 后台 Origin Certificate
- `privkey.pem`   — 对应私钥（`chmod 600`）

获取：Cloudflare → SSL/TLS → Origin Server → Create Certificate
（主机名填正式域名 + 通配，有效期 15 年），并把 SSL 模式设为 Full (strict)。

dev 环境为纯 HTTP，不需要本目录。
