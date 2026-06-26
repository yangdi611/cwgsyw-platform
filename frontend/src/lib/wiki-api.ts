/**
 * Wiki 模块 API 客户端
 *
 * 后端统一 R<T> 包裹：{ code, message, data }。
 * src/lib/api.ts 的响应拦截器不做解包，因此这里用 `.then(r => r.data.data)`
 * 取出业务数据。请求体一律 snake_case。
 */
import api from './api'
import type {
  WikiSpace,
  WikiPageTree,
  WikiPage,
  WikiBacklink,
  WikiVersion,
  WikiSearchResult,
  WikiGraph,
  WikiAcl,
  PageResult,
} from '@/types/wiki'

/**
 * 通过带 JWT 的 axios 请求下载文件（blob），再触发浏览器保存。
 * 不能用 window.open —— 那是普通 GET，不走 axios 拦截器，不带 Authorization 头，会 403。
 * 文件名优先取响应头 Content-Disposition，回退到 fallbackName。
 */
async function downloadBlob(url: string, fallbackName: string): Promise<void> {
  const resp = await api.get(url, { responseType: 'blob' })
  let filename = fallbackName
  const cd = resp.headers['content-disposition'] as string | undefined
  if (cd) {
    // 支持 filename*=UTF-8''xxx 和 filename="xxx"
    const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)
    const plain = /filename="?([^";]+)"?/i.exec(cd)
    if (star) filename = decodeURIComponent(star[1])
    else if (plain) filename = plain[1]
  }
  const blobUrl = URL.createObjectURL(resp.data as Blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

export const wikiApi = {
  // ── Spaces ────────────────────────────────────────────────────────────────
  listSpaces: (): Promise<WikiSpace[]> =>
    api.get('/wiki/spaces').then((r) => r.data.data),

  createSpace: (body: { name: string; description: string }): Promise<WikiSpace> =>
    api.post('/wiki/spaces', body).then((r) => r.data.data),

  updateSpace: (id: number, body: { name: string; description: string }): Promise<WikiSpace> =>
    api.put(`/wiki/spaces/${id}`, body).then((r) => r.data.data),

  deleteSpace: (id: number): Promise<void> =>
    api.delete(`/wiki/spaces/${id}`).then(() => undefined),

  getTree: (spaceId: number): Promise<WikiPageTree[]> =>
    api.get(`/wiki/spaces/${spaceId}/tree`).then((r) => r.data.data),

  getGraph: (spaceId: number): Promise<WikiGraph> =>
    api.get(`/wiki/spaces/${spaceId}/graph`).then((r) => r.data.data),

  exportSpace: (spaceId: number): Promise<void> =>
    downloadBlob(`/wiki/spaces/${spaceId}/export`, `wiki-space-${spaceId}.zip`),

  // ── Pages ─────────────────────────────────────────────────────────────────
  getPage: (id: number): Promise<WikiPage> =>
    api.get(`/wiki/pages/${id}`).then((r) => r.data.data),

  createPage: (body: {
    space_id: number
    parent_id: number | null
    title: string
  }): Promise<WikiPage> => api.post('/wiki/pages', body).then((r) => r.data.data),

  savePage: (
    id: number,
    body: { title: string; content: string; comment?: string },
  ): Promise<WikiPage> => api.put(`/wiki/pages/${id}`, body).then((r) => r.data.data),

  deletePage: (id: number): Promise<void> =>
    api.delete(`/wiki/pages/${id}`).then(() => undefined),

  movePage: (id: number, body: { parent_id: number | null; sort_order: number }): Promise<void> =>
    api.post(`/wiki/pages/${id}/move`, body).then(() => undefined),

  submitPage: (id: number): Promise<void> =>
    api.post(`/wiki/pages/${id}/submit`).then(() => undefined),

  publishPage: (id: number): Promise<void> =>
    api.post(`/wiki/pages/${id}/publish`).then(() => undefined),

  getVersions: (id: number): Promise<WikiVersion[]> =>
    api.get(`/wiki/pages/${id}/versions`).then((r) => r.data.data),

  revertPage: (id: number, version: number): Promise<WikiPage> =>
    api.post(`/wiki/pages/${id}/revert/${version}`).then((r) => r.data.data),

  exportPage: (id: number): Promise<void> =>
    downloadBlob(`/wiki/pages/${id}/export`, `wiki-page-${id}.md`),

  getBacklinks: (id: number): Promise<WikiBacklink[]> =>
    api.get(`/wiki/pages/${id}/backlinks`).then((r) => r.data.data),

  getAcl: (id: number): Promise<WikiAcl> =>
    api.get(`/wiki/pages/${id}/acl`).then((r) => r.data.data),

  setAcl: (id: number, body: WikiAcl): Promise<WikiAcl> =>
    api.put(`/wiki/pages/${id}/acl`, body).then((r) => r.data.data),

  // ── Attachments ─────────────────────────────────────────────────────────────
  uploadAttachment: (pageId: number, file: File): Promise<{ file_id: string; url: string }> => {
    const form = new FormData()
    form.append('file', file)
    form.append('page_id', String(pageId))
    return api
      .post('/wiki/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data)
  },

  // ── Search ──────────────────────────────────────────────────────────────────
  search: (params: {
    keyword: string
    space_id?: number
    page?: number
    size?: number
  }): Promise<PageResult<WikiSearchResult>> =>
    api
      .get('/wiki/search', {
        params: {
          keyword: params.keyword,
          space_id: params.space_id,
          page: params.page ?? 1,
          size: params.size ?? 20,
        },
      })
      .then((r) => r.data.data),
}
