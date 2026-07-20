const { test, expect, request } = require('@playwright/test')
const fs = require('fs')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = process.env.FQA_L4_RUN_ID || 'REM_P1_053_20260720'
const manifestPath = process.env.FQA_MANIFEST_PATH

function updateManifest(objects, cleanupFailures = 0) {
  const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(current.runId).toBe(runId)
  const temporaryPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ ...current, objects, cleanupFailures }, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporaryPath, manifestPath)
}

async function data(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

test('remP1053WikiApprovalKeepsLongCommentAndBoundsAuditRemark', async () => {
  test.skip(!manifestPath, 'FQA_MANIFEST_PATH is required')
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  const api = await request.newContext({ baseURL })
  const objects = []
  let headers
  let spaceId
  let pageId
  let cleanupFailures = 0

  try {
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).objects).toEqual([])
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    headers = { Authorization: `Bearer ${(await data(login)).token}` }

    spaceId = (await data(await api.post('/api/wiki/spaces', {
      headers,
      data: { name: `${runId}_wiki_${Date.now()}`, description: runId, ownerGroupId: 1 },
    }))).id
    objects.push({ caseId: 'REM-P1-053', type: 'wiki-space', id: spaceId, runId }); updateManifest(objects)

    pageId = (await data(await api.post('/api/wiki/pages', {
      headers,
      data: { spaceId, title: `${runId}_page_${Date.now()}` },
    }))).id
    objects.push({ caseId: 'REM-P1-053', type: 'wiki-page', id: pageId, runId }); updateManifest(objects)

    expect((await api.post(`/api/wiki/pages/${pageId}/submit`, { headers })).status()).toBe(200)
    const tasks = await data(await api.get('/api/workflow/center/tasks/my', { headers }))
    const task = tasks.find((candidate) => candidate.businessType === 'wiki_page' && candidate.businessId === String(pageId))
    expect(task).toBeTruthy()
    const longComment = `${runId} Wiki 驳回意见🙂`.repeat(300)
    expect((await api.post('/api/workflow/approve', {
      headers,
      data: { taskId: task.taskId, approved: false, comment: longComment },
    })).status()).toBe(200)
    expect((await data(await api.get(`/api/wiki/pages/${pageId}`, { headers }))).status).toBe('draft')

    const auditPage = await data(await api.get('/api/audit-logs', {
      headers,
      params: { module: 'wiki', action: 'reject', keyword: runId, page: 1, size: 20 },
    }))
    const rejectionAudit = auditPage.records.find((record) => record.targetId === pageId)
    expect(rejectionAudit).toBeTruthy()
    expect([...rejectionAudit.remark]).toHaveLength(512)
    expect(rejectionAudit.remark).toMatch(/\.\.\.$/)

    const notifications = await data(await api.get('/api/notifications', { headers, params: { page: 1, size: 100 } }))
    const rejectionNotice = notifications.records.find((notice) => notice.refType === 'wiki_page' && notice.refId === pageId)
    expect(rejectionNotice).toBeTruthy()
    expect(rejectionNotice.content).toContain('审批被拒绝')
  } finally {
    if (headers && pageId) {
      const response = await api.delete(`/api/wiki/pages/${pageId}`, { headers })
      if (response.status() === 200) objects.splice(objects.findIndex((object) => object.type === 'wiki-page'), 1)
      else cleanupFailures += 1
      updateManifest(objects, cleanupFailures)
    }
    if (headers && spaceId) {
      const response = await api.delete(`/api/wiki/spaces/${spaceId}`, { headers })
      if (response.status() === 200) objects.splice(objects.findIndex((object) => object.type === 'wiki-space'), 1)
      else cleanupFailures += 1
    }
    updateManifest(objects, cleanupFailures)
    await api.dispose()
    expect(objects).toEqual([])
    expect(cleanupFailures).toBe(0)
  }
})
