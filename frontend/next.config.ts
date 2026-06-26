import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: 'standalone',
  // 构建期注入版本信息：APP_VERSION 取自 package.json，GIT_COMMIT 由 CI 传入构建参数
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_COMMIT: process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'dev',
  },
  async redirects() {
    return [
      // AC10 (Issue #64): 拓扑对比模式已从拓扑页分离为独立子路由
      // /cmdb/topology/[instanceId]/compare。旧入口 /cmdb/topology/[instanceId]?compare=1
      // 在兼容期内 307 redirect 到新路径，下版本删除。
      {
        source: '/cmdb/topology/:instanceId',
        has: [{ type: 'query', key: 'compare' }],
        destination: '/cmdb/topology/:instanceId/compare',
        permanent: false,
      },
      // AC10 (Issue #64): 模型详情统一走管理端 /cmdb/admin/models/[modelCode]，
      // 旧 /cmdb/models/:modelCode 路径 redirect 一个版本（/cmdb/models 列表不受影响）。
      {
        source: '/cmdb/models/:modelCode',
        destination: '/cmdb/admin/models/:modelCode',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
