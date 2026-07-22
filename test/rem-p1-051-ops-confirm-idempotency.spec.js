const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const eventRunId = process.env.FQA_EVENT_RUN_ID || `REM_P1_051_${Date.now()}`
const suffix = Date.now()
const manifestPath = path.join(
  __dirname, '..', 'docs', 'plan', 'full-platform-remediation', '06-ops-collaboration',
  'REM-P1-051-ops-confirm-idempotency', 'test-data-manifest.json',
)

function updateManifest(objects) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(manifest.runId).toBe('REM_P1_051_20260719')
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ ...manifest, objects }, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(temporaryPath, manifestPath)
}

async function data(response, status = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(status)
  return body.data
}

async function login(api, username, password) {
  const result = await data(await api.post('/api/auth/login', { data: { username, password } }))
  return { headers: { Authorization: `Bearer ${result.token}` }, username, password }
}

test('confirm is idempotent for concurrent API and real UI double-click', async ({ browser }) => {
  test.setTimeout(120_000)
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const tasks = []
  let admin
  let assignment
  let userId
  let roleId
  try {
    updateManifest([])
    admin = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)
    const permissions = await data(await api.get('/api/rbac/permissions', { headers: admin.headers }))
    const permissionIds = ['ops_calendar:read', 'ops_calendar:create', 'ops_calendar:complete']
      .map(code => permissions.find(permission => permission.code === code).id)
    roleId = (await data(await api.post('/api/rbac/roles', { headers: admin.headers, data: {
      name: `${eventRunId} operator`, code: `rem_p1_051_operator_${suffix}`.toLowerCase(),
      description: eventRunId, permissionIds,
    } }))).id
    objects.push({ type: 'role', id: roleId, runId: eventRunId }); updateManifest(objects)

    const username = `rem_p1_051_operator_${suffix}`.toLowerCase()
    const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
    const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
    userId = (await data(await api.post('/api/users', { headers: admin.headers, data: {
      username, password: initialPassword, realName: `${eventRunId}_operator`,
      email: `${username}@example.test`, phone: '13800138000', groupId: 2,
    } }))).id
    objects.push({ type: 'user', id: userId, runId: eventRunId }); updateManifest(objects)
    expect((await api.post(`/api/users/${userId}/role-assignments`, { headers: admin.headers, data: {
      roleId, scopeType: 'group', scopeId: 2,
    } })).status()).toBe(200)
    assignment = (await data(await api.get(`/api/users/${userId}/role-assignments`, { headers: admin.headers })))
      .find(candidate => candidate.roleId === roleId)
    objects.push({ type: 'role-assignment', id: assignment.id, userId, runId: eventRunId }); updateManifest(objects)

    const setup = await login(api, username, initialPassword)
    expect((await api.post('/api/account/setup', { headers: setup.headers, data: {
      currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword,
      email: `${username}@example.test`, phone: '13800138000',
    } })).status()).toBe(200)
    const operator = await login(api, username, finalPassword)
    const createTask = async (name) => {
      const taskId = await data(await api.post('/api/ops-calendar/tasks', { headers: operator.headers, data: {
        title: `${eventRunId}_${name}`, content: `remediationRunId=${eventRunId}`,
        taskType: 'inspection', visibility: 'private', assigneeId: userId,
      } }))
      tasks.push(taskId)
      objects.push({ type: 'ops-task', id: taskId, runId: eventRunId }); updateManifest(objects)
      return taskId
    }
    const detail = async taskId => data(await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers: operator.headers }))
    const confirmAudits = async taskId => {
      const result = await data(await api.get('/api/audit-logs', { headers: admin.headers, params: {
        module: 'ops_calendar', action: 'confirm', keyword: String(taskId), page: 1, size: 100,
      } }))
      return (result.records ?? result).filter(audit => audit.action === 'confirm' && audit.targetId === taskId)
    }

    const apiTaskId = await createTask('api_concurrent')
    const apiResponses = await Promise.all([
      api.post(`/api/ops-calendar/tasks/${apiTaskId}/confirm`, { headers: operator.headers }),
      api.post(`/api/ops-calendar/tasks/${apiTaskId}/confirm`, { headers: operator.headers }),
    ])
    expect(apiResponses.map(response => response.status()).sort()).toEqual([200, 400])
    const apiDetail = await detail(apiTaskId)
    expect(apiDetail.task.status).toBe('not_started')
    expect(apiDetail.logs.filter(log => log.action === 'confirm'))
      .toEqual([expect.objectContaining({ operatorId: userId })])
    expect(await confirmAudits(apiTaskId))
      .toEqual([expect.objectContaining({ operatorId: userId })])

    const uiTaskId = await createTask('ui_double_click')
    const context = await browser.newContext()
    const page = await context.newPage()
    const pageErrors = []
    const serverErrors = []
    const confirmRequests = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('request', outgoing => {
      if (outgoing.method() === 'POST' && new URL(outgoing.url()).pathname === `/api/ops-calendar/tasks/${uiTaskId}/confirm`) {
        confirmRequests.push(outgoing.url())
      }
    })
    page.on('response', response => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
    })
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(username)
    await page.locator('#password').fill(finalPassword)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/ops-calendar?taskId=${uiTaskId}`)
    await page.getByRole('button', { name: '确认收到', exact: true }).dblclick()
    await expect(page.getByRole('button', { name: '开始执行', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: '确认收到', exact: true })).toHaveCount(0)
    expect(confirmRequests.length).toBeGreaterThanOrEqual(1)
    expect(confirmRequests.length).toBeLessThanOrEqual(2)
    expect(serverErrors).toEqual([])
    expect(pageErrors).toEqual([])
    await context.close()
    const uiDetail = await detail(uiTaskId)
    expect(uiDetail.logs.filter(log => log.action === 'confirm')).toHaveLength(1)
    expect(await confirmAudits(uiTaskId)).toHaveLength(1)
  } finally {
    if (admin) {
      for (const taskId of [...tasks].reverse()) {
        const response = await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
          headers: admin.headers, params: { remediationRunId: eventRunId },
        })
        expect(response.status(), `cleanup task ${taskId}`).toBe(200)
        expect((await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers: admin.headers })).status()).toBe(400)
        objects.splice(objects.findIndex(object => object.type === 'ops-task' && object.id === taskId), 1); updateManifest(objects)
      }
      if (assignment) {
        expect((await api.delete(`/api/users/${userId}/role-assignments/${assignment.id}`, { headers: admin.headers })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'role-assignment' && object.id === assignment.id), 1); updateManifest(objects)
      }
      if (userId) {
        expect((await api.delete(`/api/users/${userId}`, { headers: admin.headers })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'user' && object.id === userId), 1); updateManifest(objects)
      }
      if (roleId) {
        expect((await api.delete(`/api/rbac/roles/${roleId}`, { headers: admin.headers })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'role' && object.id === roleId), 1); updateManifest(objects)
      }
    }
    updateManifest(objects)
    expect(objects).toEqual([])
    await api.dispose()
  }
})
