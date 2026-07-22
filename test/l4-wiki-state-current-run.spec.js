const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_1715_remp1029'
const runId = `${l4RunId}_WIKI_STATE`
const manifestPath = path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId, 'test-data-manifest.json')

function updateManifest(objects) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId: l4RunId, objects, cleanupFailures: 0 }, null, 2) + '\n')
}

test('stWiki001002003CurrentRunReviewRejectAndPublishLifecycle', async () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  let headers
  let spaceId
  let pageId
  try {
    const login = await api.post('/api/auth/login', { data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD } })
    expect(login.status()).toBe(200)
    headers = { Authorization: `Bearer ${(await login.json()).data.token}` }
    const space = await api.post('/api/wiki/spaces', { headers, data: { name: runId, description: runId, ownerGroupId: 1 } })
    expect(space.status()).toBe(200)
    spaceId = (await space.json()).data.id
    updateManifest([{ caseId: 'ST-WIKI-001', type: 'wiki-space', id: spaceId, runId }])
    const page = await api.post('/api/wiki/pages', { headers, data: { spaceId, title: `${runId}_page` } })
    expect(page.status()).toBe(200)
    pageId = (await page.json()).data.id
    updateManifest([{ caseId: 'ST-WIKI-001', type: 'wiki-space', id: spaceId, runId }, { caseId: 'ST-WIKI-001', type: 'wiki-page', id: pageId, runId }])

    async function submitAndTask() {
      expect((await api.post(`/api/wiki/pages/${pageId}/submit`, { headers })).status()).toBe(200)
      expect((await (await api.get(`/api/wiki/pages/${pageId}`, { headers })).json()).data.status).toBe('review')
      const tasks = await api.get('/api/workflow/center/tasks/my', { headers })
      expect(tasks.status()).toBe(200)
      const task = (await tasks.json()).data.find(item => item.businessType === 'wiki_page' && item.businessId === String(pageId))
      expect(task).toBeTruthy()
      return task.taskId
    }

    const rejectedTask = await submitAndTask()
    expect((await api.post('/api/workflow/approve', { headers, data: { taskId: rejectedTask, approved: false, comment: `${runId} reject` } })).status()).toBe(200)
    expect((await (await api.get(`/api/wiki/pages/${pageId}`, { headers })).json()).data.status).toBe('draft')
    expect((await api.put(`/api/wiki/pages/${pageId}`, { headers, data: { title: `${runId}_revised`, content: '# revised', comment: runId } })).status()).toBe(200)
    const approvedTask = await submitAndTask()
    expect((await api.post('/api/workflow/approve', { headers, data: { taskId: approvedTask, approved: true, comment: `${runId} approve` } })).status()).toBe(200)
    expect((await (await api.get(`/api/wiki/pages/${pageId}`, { headers })).json()).data.status).toBe('published')
  } finally {
    if (pageId) expect((await api.delete(`/api/wiki/pages/${pageId}`, { headers })).status()).toBe(200)
    if (spaceId) expect((await api.delete(`/api/wiki/spaces/${spaceId}`, { headers })).status()).toBe(200)
    updateManifest([])
    await api.dispose()
  }
})
