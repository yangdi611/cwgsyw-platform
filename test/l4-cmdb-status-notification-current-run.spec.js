const { test, expect, request } = require('@playwright/test')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const suffix = `${Date.now()}_${process.pid}`
const marker = `FQA_L4_CMDB_STATUS_${suffix}`
const groupCode = `fqa_l4_status_g_${suffix}`.replace(/[^a-z0-9_]/gi, '').slice(0, 48)
const modelCode = `fqa_l4_status_m_${suffix}`.replace(/[^a-z0-9_]/gi, '').slice(0, 48)
const runId = process.env.REMEDIATION_RUN_ID || 'REM_P1_074_20260721'
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation',
  '03-cmdb-assets', 'REM-P1-074-cmdb-status-change-notification-chain', 'test-data-manifest.json')

function writeManifest(objects, cleanupFailures = 0) {
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId, objects, cleanupFailures }, null, 2)}\n`)
}

function environmentValue(environment, name) {
  return environment.split('\n').find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1)
}

function queryDatabase(sql) {
  const container = 'cwgsyw-platform-postgres-1'
  const environment = execFileSync('docker', [
    'inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}',
  ], { encoding: 'utf8' })
  return execFileSync('docker', [
    'exec', container, 'psql',
    '-U', environmentValue(environment, 'POSTGRES_USER'),
    '-d', environmentValue(environment, 'POSTGRES_DB'),
    '-At', '-F', '\t', '-c', sql,
  ], { encoding: 'utf8' }).trim()
}

async function responseData(response) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(200)
  return body.data
}

test('xlCmdb006StatusChangeCreatesChangeRecordAndNotification', async ({ page }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  let headers
  let modelGroupId
  let modelId
  let instanceId
  const instanceIds = []
  const cleanupErrors = []
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) {
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
    }
  })

  try {
    const login = await responseData(await api.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    }))
    headers = { Authorization: `Bearer ${login.token}` }
    const users = await responseData(await api.get('/api/users', {
      headers,
      params: { page: 1, size: 100 },
    }))
    const owner = users.records.find((user) => user.username !== 'superadmin' && user.status === 1)
    expect(owner, 'an active non-operator owner is required').toBeTruthy()

    modelGroupId = (await responseData(await api.post('/api/cmdb/model-groups', {
      headers,
      data: { code: groupCode, name: marker, sortOrder: 1 },
    }))).id
    objects.push({ type: 'cmdb-model-group', id: modelGroupId, code: groupCode, runId })
    writeManifest(objects)
    modelId = (await responseData(await api.post('/api/cmdb/models', {
      headers,
      data: { modelId: modelCode, name: marker, groupCode },
    }))).id
    objects.push({ type: 'cmdb-model', id: modelId, code: modelCode, runId })
    writeManifest(objects)
    instanceId = (await responseData(await api.post('/api/cmdb/instances', {
      headers,
      data: {
        modelId: modelCode,
        name: marker,
        status: 'online',
        owner: owner.username,
        description: marker,
        fieldsData: {},
      },
    }))).id
    instanceIds.push(instanceId)
    objects.push({ type: 'cmdb-instance', id: instanceId, runId })
    writeManifest(objects)

    const updated = await responseData(await api.put(`/api/cmdb/instances/${instanceId}`, {
      headers,
      data: { status: 'offline' },
    }))
    expect(updated).toMatchObject({ id: instanceId, status: 'offline' })

    const history = await responseData(await api.get(`/api/cmdb/instances/${instanceId}/history`, {
      headers,
      params: { page: 1, size: 20 },
    }))
    expect(history.total).toBeGreaterThanOrEqual(2)
    const persistedStatusChange = queryDatabase(`
      SELECT field_changes::text FROM ci_change_record
      WHERE tenant_id = 'default' AND instance_id = ${instanceId} AND action = 'update'
      ORDER BY id DESC LIMIT 1
    `)
    expect(persistedStatusChange).toContain('"field": "status"')
    expect(persistedStatusChange).toContain('"before": "online"')
    expect(persistedStatusChange).toContain('"after": "offline"')

    const notificationCount = Number(queryDatabase(`
      SELECT COUNT(*) FROM notification_message
      WHERE tenant_id = 'default' AND ref_type = 'ci_instance'
        AND ref_id = ${instanceId} AND NOT is_deleted
    `))
    expect(notificationCount, 'status change notification count').toBeGreaterThan(0)

    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill('superadmin')
    await page.locator('#password').fill(process.env.FQA_SUPERADMIN_PASSWORD)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    const detailResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/cmdb/instances/${instanceId}`) && response.request().method() === 'GET')
    await page.goto(`${baseURL}/cmdb/instances/by-model/${modelCode}/${instanceId}`)
    const detailResponse = await detailResponsePromise
    expect((await detailResponse.json()).data.status).toBe('offline')
    await expect(page.getByRole('heading', { name: marker })).toBeVisible()
    await page.getByRole('button', { name: '变更历史', exact: true }).click()
    await expect(page.locator('button').filter({ hasText: '更新' }).first()).toBeVisible()

    await responseData(await api.put(`/api/cmdb/instances/${instanceId}`, {
      headers,
      data: { status: 'offline' },
    }))
    const sameStatusNotificationCount = Number(queryDatabase(`
      SELECT COUNT(*) FROM notification_message
      WHERE tenant_id = 'default' AND ref_type = 'ci_instance'
        AND ref_id = ${instanceId} AND NOT is_deleted
    `))
    expect(sameStatusNotificationCount, 'same status must stay silent').toBe(notificationCount)

    const batchInstanceId = (await responseData(await api.post('/api/cmdb/instances', {
      headers,
      data: {
        modelId: modelCode,
        name: `${marker}_batch`,
        status: 'online',
        owner: owner.username,
        description: marker,
        fieldsData: {},
      },
    }))).id
    instanceIds.push(batchInstanceId)
    objects.push({ type: 'cmdb-instance', id: batchInstanceId, runId })
    writeManifest(objects)
    const batchResult = await responseData(await api.post('/api/cmdb/instances/batch-update', {
      headers,
      data: { ids: [instanceId, batchInstanceId], fields: { status: 'maintenance' } },
    }))
    expect(batchResult).toMatchObject({ total: 2, succeeded: 2, failed: 0, failures: [] })
    const batchNotificationRefs = queryDatabase(`
      SELECT ref_id FROM notification_message
      WHERE tenant_id = 'default' AND ref_type = 'ci_instance'
        AND ref_id IN (${instanceId}, ${batchInstanceId}) AND NOT is_deleted
      GROUP BY ref_id ORDER BY ref_id
    `).split('\n').map(Number)
    expect(batchNotificationRefs).toEqual([instanceId, batchInstanceId].sort((a, b) => a - b))
    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
  } finally {
    for (const id of [...instanceIds].reverse()) {
      if (!headers) break
      const response = await api.delete(`/api/cmdb/instances/${id}`, { headers })
      if (response.status() !== 200) cleanupErrors.push(`instance:${id}:${response.status()}`)
      else objects.splice(objects.findIndex((object) => object.type === 'cmdb-instance' && object.id === id), 1)
      writeManifest(objects, cleanupErrors.length)
    }
    if (headers && modelId) {
      const response = await api.delete(`/api/cmdb/models/${modelId}`, { headers })
      if (response.status() !== 200) cleanupErrors.push(`model:${response.status()}`)
      else objects.splice(objects.findIndex((object) => object.type === 'cmdb-model'), 1)
      writeManifest(objects, cleanupErrors.length)
    }
    if (headers && modelGroupId) {
      const response = await api.delete(`/api/cmdb/model-groups/${modelGroupId}`, { headers })
      if (response.status() !== 200) cleanupErrors.push(`model-group:${response.status()}`)
      else objects.splice(objects.findIndex((object) => object.type === 'cmdb-model-group'), 1)
      writeManifest(objects, cleanupErrors.length)
    }
    await api.dispose()
    expect(cleanupErrors).toEqual([])
    expect(objects).toEqual([])
    const activeResidue = queryDatabase(`
      SELECT
        (SELECT COUNT(*) FROM ci_instance WHERE name = '${marker}' AND NOT is_deleted),
        (SELECT COUNT(*) FROM ci_model WHERE model_id = '${modelCode}' AND NOT is_deleted),
        (SELECT COUNT(*) FROM ci_model_group WHERE code = '${groupCode}' AND NOT is_deleted)
    `)
    expect(activeResidue).toBe('0\t0\t0')
  }
})
