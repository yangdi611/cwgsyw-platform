const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const runId = `REM_P1_052_${Date.now()}`
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation', '03-cmdb-assets', 'REM-P1-052-cmdb-instance-reference-delete-guards', 'test-data-manifest.json')

function updateManifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, JSON.stringify({ runId, objects, cleanupFailures }, null, 2) + '\n')
}

test('cmdbInstanceDeleteGuardsDocumentAndDailyReferencesThenAllowsCleanup', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  let headers
  let modelGroupId
  let modelId
  let instanceId
  let documentId
  let reportId
  let dailyGroupId
  const pageErrors = []
  const failedRequests = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) failedRequests.push(`${response.status()} ${response.url()}`)
  })
  const record = (object) => {
    objects.push({ runId, ...object })
    updateManifest(objects)
  }
  const forget = (type) => {
    const index = objects.findIndex((object) => object.type === type)
    if (index >= 0) objects.splice(index, 1)
    updateManifest(objects)
  }
  const auditCount = async () => {
    const response = await api.get('/api/audit-logs', {
      headers,
      params: { module: 'cmdb', action: 'delete_instance', keyword: String(instanceId), page: 1, size: 100 },
    })
    expect(response.status()).toBe(200)
    return (await response.json()).data.total
  }
  const createDailyReport = async () => {
    for (let offset = 10; offset < 90; offset++) {
      const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10)
      const payload = {
        reportDate: date,
        completedItems: runId,
        tomorrowPlan: runId,
        issues: runId,
        workHours: 1,
        groupId: dailyGroupId,
        ciInstanceIds: [instanceId],
      }
      const response = await api.post('/api/daily-reports', { headers, data: payload })
      if (response.status() === 200) return { id: (await response.json()).data.id, payload }
      expect(response.status()).toBe(400)
    }
    throw new Error('No free historical daily-report date')
  }

  try {
    const login = await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    expect(login.status()).toBe(200)
    const loginData = (await login.json()).data
    headers = { Authorization: `Bearer ${loginData.token}` }
    const templates = (await (await api.get('/api/admin/change-doc-templates', { headers })).json()).data
    const applicationTemplate = templates.find((template) => template.active && template.docType !== 'plan')
    expect(applicationTemplate).toBeTruthy()
    const groups = (await (await api.get('/api/groups', { headers })).json()).data
    dailyGroupId = groups.find((group) => group.groupType === 'business' && group.status !== 'archived')?.id
    expect(dailyGroupId).toBeTruthy()

    const groupCode = `g_${runId}`.toLowerCase()
    const modelCode = `m_${runId}`.toLowerCase()
    const group = await api.post('/api/cmdb/model-groups', {
      headers,
      data: { code: groupCode, name: runId, sortOrder: 1 },
    })
    expect(group.status()).toBe(200)
    modelGroupId = (await group.json()).data.id
    record({ type: 'cmdb-model-group', id: modelGroupId })
    const model = await api.post('/api/cmdb/models', {
      headers,
      data: { modelId: modelCode, name: runId, groupCode },
    })
    expect(model.status()).toBe(200)
    modelId = (await model.json()).data.id
    record({ type: 'cmdb-model', id: modelId, modelCode })
    const instance = await api.post('/api/cmdb/instances', {
      headers,
      data: { modelId: modelCode, name: runId, fieldsData: {} },
    })
    expect(instance.status()).toBe(200)
    instanceId = (await instance.json()).data.id
    record({ type: 'cmdb-instance', id: instanceId })
    const auditBefore = await auditCount()

    const document = await api.post('/api/change-docs', {
      headers,
      data: {
        title: runId,
        applicationTemplateId: applicationTemplate.id,
        fieldsData: { runId },
        ciSnapshots: [{ instanceId, impactLevel: 'high' }],
      },
    })
    expect(document.status()).toBe(200)
    documentId = (await document.json()).data.id
    record({ type: 'change-doc', id: documentId })
    const documentDenied = await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })
    expect(documentDenied.status()).toBe(400)
    expect(await documentDenied.text()).toContain('变更文档引用')
    expect((await api.get(`/api/cmdb/instances/${instanceId}`, { headers })).status()).toBe(200)
    expect(await auditCount()).toBe(auditBefore)

    expect((await api.delete(`/api/change-docs/${documentId}/ci-links/${instanceId}`, { headers })).status()).toBe(200)
    const daily = await createDailyReport()
    reportId = daily.id
    record({ type: 'daily-report', id: reportId })
    const dailyDenied = await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })
    expect(dailyDenied.status()).toBe(400)
    expect(await dailyDenied.text()).toContain('日报引用')
    expect((await api.get(`/api/cmdb/instances/${instanceId}`, { headers })).status()).toBe(200)
    expect(await auditCount()).toBe(auditBefore)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/cmdb/instances/by-model/${modelCode}`)
    await expect(page.getByText(runId, { exact: true }).first()).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    const deniedResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/cmdb/instances/${instanceId}`) && response.request().method() === 'DELETE')
    await page.getByTitle('删除').click()
    expect((await deniedResponse).status()).toBe(400)
    await expect(page.getByText(/日报引用/)).toBeVisible()
    await expect(page.getByText(runId, { exact: true }).first()).toBeVisible()
    expect(await auditCount()).toBe(auditBefore)

    expect((await api.put(`/api/daily-reports/${reportId}`, {
      headers,
      data: { ...daily.payload, ciInstanceIds: [] },
    })).status()).toBe(200)
    page.once('dialog', (dialog) => dialog.accept())
    const deletedResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/cmdb/instances/${instanceId}`) && response.request().method() === 'DELETE')
    await page.getByTitle('删除').click()
    expect((await deletedResponse).status()).toBe(200)
    await expect(page.getByText('已删除')).toBeVisible()
    await expect(page.getByText(runId, { exact: true })).toHaveCount(0)
    expect((await api.get(`/api/cmdb/instances/${instanceId}`, { headers })).status()).toBe(400)
    expect(await auditCount()).toBe(auditBefore + 1)
    forget('cmdb-instance')
    instanceId = undefined
    expect(pageErrors).toEqual([])
    expect(failedRequests).toEqual([])
  } finally {
    let cleanupFailures = 0
    if (reportId) {
      const response = await api.delete(`/api/daily-reports/${reportId}/remediation-test`, {
        headers,
        params: { remediationRunId: runId },
      })
      if (response.status() === 200) forget('daily-report')
      else cleanupFailures += 1
    }
    if (documentId) {
      const response = await api.delete(`/api/change-docs/${documentId}/remediation-test`, {
        headers,
        params: { remediationRunId: runId },
      })
      if (response.status() === 200) forget('change-doc')
      else cleanupFailures += 1
    }
    if (instanceId) {
      const response = await api.delete(`/api/cmdb/instances/${instanceId}`, { headers })
      if (response.status() === 200) forget('cmdb-instance')
      else cleanupFailures += 1
    }
    if (modelId) {
      const response = await api.delete(`/api/cmdb/models/${modelId}`, { headers })
      if (response.status() === 200) forget('cmdb-model')
      else cleanupFailures += 1
    }
    if (modelGroupId) {
      const response = await api.delete(`/api/cmdb/model-groups/${modelGroupId}`, { headers })
      if (response.status() === 200) forget('cmdb-model-group')
      else cleanupFailures += 1
    }
    updateManifest(objects, cleanupFailures)
    await api.dispose()
  }
})
