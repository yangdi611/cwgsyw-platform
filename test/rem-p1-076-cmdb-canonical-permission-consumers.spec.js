const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const eventRunId = process.env.FQA_EVENT_RUN_ID || 'REM_P1_076_20260722'
const evidenceDir = process.env.FQA_EVENT_EVIDENCE_DIR
const suffix = Date.now()
const runId = `${eventRunId}_${suffix}`
const manifestPath = path.join(__dirname, '..', 'docs', 'plan', 'full-platform-remediation', '03-cmdb-assets', 'REM-P1-076-cmdb-canonical-permission-consumers', 'test-data-manifest.json')

async function dataOf(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

test('canonical CMDB consumers allow canonical permissions and reject legacy substitutes', async ({ browser }) => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  test.skip(!evidenceDir, 'FQA_EVENT_EVIDENCE_DIR is required')
  test.setTimeout(240_000)

  const api = await request.newContext({ baseURL })
  const objects = []
  const cleanupErrors = []
  const roles = []
  const users = []
  const assignments = []
  const identities = {}
  const canonicalConsoleErrors = []
  const explainedLegacyDenials = []
  const pageErrors = []
  const serverErrors = []
  let adminHeaders
  let modelGroupId
  let modelId
  let instanceId
  let modelCode

  const sync = () => fs.writeFileSync(manifestPath, `${JSON.stringify({ runId: eventRunId, objects, cleanupFailures: cleanupErrors.length }, null, 2)}\n`)
  const add = (object) => { objects.push({ ...object, runId }); sync() }
  const remove = (type, id) => {
    const index = objects.findIndex((object) => object.type === type && String(object.id) === String(id))
    if (index >= 0) objects.splice(index, 1)
    sync()
  }
  const cleanup = async (label, operation, type, id) => {
    if (!id || !adminHeaders) return
    try {
      const response = await operation()
      if (![200, 400, 404].includes(response.status())) cleanupErrors.push(`${label}:${response.status()}`)
      else remove(type, id)
    } catch (error) {
      cleanupErrors.push(`${label}:${error instanceof Error ? error.message : String(error)}`)
      sync()
    }
  }
  const login = async (username, password) => {
    const loginData = await dataOf(await api.post('/api/auth/login', { data: { username, password } }))
    return { headers: { Authorization: `Bearer ${loginData.token}` }, permissions: loginData.permissions ?? [] }
  }
  const verifyUi = async (identity, expectedVisible) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      if (!expectedVisible && message.text().includes('status of 403')) explainedLegacyDenials.push(message.text())
      else canonicalConsoleErrors.push(message.text())
    })
    page.on('response', (response) => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`) })
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(identity.username)
    await page.locator('#password').fill(identity.password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/cmdb/instances/by-model/${identity.modelCode}`)
    await expect(page.getByRole('button', { name: '导入 CSV', exact: true })).toHaveCount(expectedVisible ? 1 : 0)
    await page.goto(`${baseURL}/cmdb/instances/by-model/${identity.modelCode}/${identity.instanceId}`)
    await expect(page.getByRole('link', { name: '影响分析', exact: true })).toHaveCount(expectedVisible ? 1 : 0)
    await expect(page.getByRole('link', { name: '拓扑对比', exact: true })).toHaveCount(expectedVisible ? 1 : 0)
    await expect(page.getByRole('button', { name: '拓扑图', exact: true })).toHaveCount(expectedVisible ? 1 : 0)
    await context.close()
  }

  try {
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).objects).toEqual([])
    adminHeaders = (await login('superadmin', process.env.FQA_SUPERADMIN_PASSWORD)).headers
    const permissions = await dataOf(await api.get('/api/rbac/permissions', { headers: adminHeaders }))
    const permissionId = (code) => {
      const permission = permissions.find((candidate) => candidate.code === code)
      expect(permission, code).toBeTruthy()
      return permission.id
    }

    const groupCode = `g_remp1076_${suffix}`
    modelCode = `m_remp1076_${suffix}`
    modelGroupId = (await dataOf(await api.post('/api/cmdb/model-groups', { headers: adminHeaders, data: { code: groupCode, name: runId, sortOrder: 1 } }))).id
    add({ type: 'cmdb-model-group', id: modelGroupId })
    const model = await dataOf(await api.post('/api/cmdb/models', { headers: adminHeaders, data: { modelId: modelCode, name: runId, groupCode } }))
    modelId = model.id
    add({ type: 'cmdb-model', id: modelId })
    instanceId = (await dataOf(await api.post('/api/cmdb/instances', { headers: adminHeaders, data: { modelId: modelCode, name: `${runId}_target`, status: 'online', owner: 'FQA', description: runId, fieldsData: {} } }))).id
    add({ type: 'cmdb-instance', id: instanceId })

    const specs = [
      { key: 'canonical', codes: ['cmdb_model:read', 'cmdb_instance:read', 'cmdb_relation:read', 'cmdb_import:read', 'cmdb_import:execute', 'cmdb_impact:read', 'cmdb_topology:read'] },
      { key: 'legacy', codes: ['cmdb_model:read', 'cmdb_instance:read', 'cmdb_relation:read', 'cmdb_instance:create', 'cmdb_instance:update', 'cmdb_instance:impact', 'cmdb_instance:import'] },
    ]
    for (const spec of specs) {
      const role = await dataOf(await api.post('/api/rbac/roles', { headers: adminHeaders, data: { name: `REM-P1-076 ${spec.key}`, code: `remp1076_${spec.key}_${suffix}`, description: runId, permissionIds: spec.codes.map(permissionId) } }))
      roles.push(role.id)
      add({ type: 'role', id: role.id })
      const username = `remp1076_${spec.key}_${suffix}`
      const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
      const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
      const user = await dataOf(await api.post('/api/users', { headers: adminHeaders, data: { username, password: initialPassword, realName: `REM-P1-076 ${spec.key}`, email: `${username}@example.test`, phone: '13800138000', groupId: 1 } }))
      users.push(user.id)
      add({ type: 'user', id: user.id })
      expect((await api.post(`/api/users/${user.id}/role-assignments`, { headers: adminHeaders, data: { roleId: role.id, scopeType: 'tenant' } })).status()).toBe(200)
      const assignment = (await dataOf(await api.get(`/api/users/${user.id}/role-assignments`, { headers: adminHeaders }))).find((candidate) => candidate.roleId === role.id)
      assignments.push({ id: assignment.id, userId: user.id })
      add({ type: 'role-assignment', id: assignment.id, userId: user.id })
      const setup = await login(username, initialPassword)
      expect((await api.post('/api/account/setup', { headers: setup.headers, data: { currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword, email: `${username}@example.test`, phone: '13800138000' } })).status()).toBe(200)
      identities[spec.key] = { ...(await login(username, finalPassword)), username, password: finalPassword, modelCode, instanceId }
      expect(identities[spec.key].permissions).toEqual(expect.arrayContaining(spec.codes))
    }

    const templatePath = `/api/cmdb/instances/import/template?model=${modelCode}`
    expect((await api.get(templatePath, { headers: identities.canonical.headers })).status()).toBe(200)
    expect((await api.get(templatePath, { headers: identities.legacy.headers })).status()).toBe(403)

    const csvPreview = await api.post('/api/cmdb/instances/import/preview', {
      headers: identities.canonical.headers,
      multipart: { file: { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(`name,status,owner,description\n${runId}_csv,online,FQA,${runId}\n`) }, model: modelCode, conflictStrategy: 'override' },
    })
    const csvBatch = await dataOf(csvPreview)
    expect((await api.post('/api/cmdb/instances/import/execute', { headers: identities.canonical.headers, data: { batchId: csvBatch.batchId } })).status()).toBe(200)
    expect((await api.get(`/api/cmdb/instances/import/${csvBatch.batchId}/progress`, { headers: identities.canonical.headers })).status()).toBe(200)
    expect((await api.get(`/api/cmdb/instances/import/${csvBatch.batchId}/failed-rows`, { headers: identities.canonical.headers })).status()).toBe(200)
    expect((await api.post('/api/cmdb/instances/import/preview', { headers: identities.legacy.headers, multipart: { file: { name: 'denied.csv', mimeType: 'text/csv', buffer: Buffer.from('name\ndenied\n') }, model: modelCode } })).status()).toBe(403)

    const rawPath = `/api/cmdb/instances/import/json/preview-raw?model=${modelCode}&mode=merge`
    const jsonPreview = await dataOf(await api.post(rawPath, { headers: { ...identities.canonical.headers, 'Content-Type': 'application/json' }, data: JSON.stringify([{ name: `${runId}_json`, status: 'online', owner: 'FQA', description: runId }]) }))
    expect((await api.post('/api/cmdb/instances/import/json/execute', { headers: identities.canonical.headers, data: { batchId: jsonPreview.batchId } })).status()).toBe(200)
    expect((await api.post(rawPath, { headers: { ...identities.legacy.headers, 'Content-Type': 'application/json' }, data: '[]' })).status()).toBe(403)

    expect((await api.post(`/api/cmdb/instances/${instanceId}/impact`, { headers: identities.canonical.headers, data: { direction: 'downstream', maxDepth: 1 } })).status()).toBe(200)
    expect((await api.post(`/api/cmdb/instances/${instanceId}/impact`, { headers: identities.legacy.headers, data: { direction: 'downstream', maxDepth: 1 } })).status()).toBe(403)
    expect((await api.get(`/api/cmdb/topology/${instanceId}?depth=1`, { headers: identities.canonical.headers })).status()).toBe(200)
    expect((await api.get(`/api/cmdb/topology/${instanceId}?depth=1`, { headers: identities.legacy.headers })).status()).toBe(403)
    const now = new Date().toISOString()
    expect((await api.get(`/api/cmdb/topology/${instanceId}/compare?fromTime=${encodeURIComponent(now)}&toTime=${encodeURIComponent(now)}&depth=1`, { headers: identities.canonical.headers })).status()).toBe(200)
    expect((await api.get(`/api/cmdb/topology/${instanceId}/compare?fromTime=${encodeURIComponent(now)}&toTime=${encodeURIComponent(now)}&depth=1`, { headers: identities.legacy.headers })).status()).toBe(403)

    await verifyUi(identities.canonical, true)
    await verifyUi(identities.legacy, false)
    expect(canonicalConsoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
    expect(serverErrors).toEqual([])
    fs.mkdirSync(evidenceDir, { recursive: true })
    fs.writeFileSync(path.join(evidenceDir, 'result.json'), `${JSON.stringify({ eventRunId, runId, status: 'PASS', canonicalApi: 'allow', legacyApi: '403', uiParity: 'PASS', canonicalConsoleErrors, explainedLegacyDenials, pageErrors, serverErrors }, null, 2)}\n`)
  } finally {
    if (adminHeaders) {
      const list = await api.get(`/api/cmdb/instances?page=1&size=100&model=${encodeURIComponent(modelCode || '')}`, { headers: adminHeaders })
      if (list.status() === 200) {
        for (const instance of (await list.json()).data?.records ?? []) await cleanup(`instance:${instance.id}`, () => api.delete(`/api/cmdb/instances/${instance.id}`, { headers: adminHeaders }), 'cmdb-instance', instance.id)
      }
      await cleanup(`instance:${instanceId}`, () => api.delete(`/api/cmdb/instances/${instanceId}`, { headers: adminHeaders }), 'cmdb-instance', instanceId)
      for (const assignment of [...assignments].reverse()) await cleanup(`assignment:${assignment.id}`, () => api.delete(`/api/users/${assignment.userId}/role-assignments/${assignment.id}`, { headers: adminHeaders }), 'role-assignment', assignment.id)
      for (const userId of [...users].reverse()) await cleanup(`user:${userId}`, () => api.delete(`/api/users/${userId}`, { headers: adminHeaders }), 'user', userId)
      for (const roleId of [...roles].reverse()) await cleanup(`role:${roleId}`, () => api.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders }), 'role', roleId)
      await cleanup(`model:${modelId}`, () => api.delete(`/api/cmdb/models/${modelId}`, { headers: adminHeaders }), 'cmdb-model', modelId)
      await cleanup(`model-group:${modelGroupId}`, () => api.delete(`/api/cmdb/model-groups/${modelGroupId}`, { headers: adminHeaders }), 'cmdb-model-group', modelGroupId)
    }
    sync()
    await api.dispose()
    expect(cleanupErrors).toEqual([])
    expect(objects).toEqual([])
  }
})
