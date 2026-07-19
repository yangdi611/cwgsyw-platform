const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const eventRunId = process.env.FQA_EVENT_RUN_ID || `REM_P1_050_${Date.now()}`
const suffix = Date.now()
const manifestPath = path.join(
  __dirname, '..', 'docs', 'plan', 'full-platform-remediation', '06-ops-collaboration',
  'REM-P1-050-ops-cross-group-assignee-candidates', 'test-data-manifest.json',
)

function updateManifest(objects) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(manifest.runId).toBe('REM_P1_050_20260719')
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

test('cross-group assignee candidates align UI and API with exact cleanup', async ({ browser }) => {
  test.setTimeout(120_000)
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')
  const api = await request.newContext({ baseURL })
  const objects = []
  const roles = []
  const users = []
  const assignments = []
  const tasks = []
  let admin
  try {
    updateManifest([])
    admin = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)
    const permissions = await data(await api.get('/api/rbac/permissions', { headers: admin.headers }))
    const createIdentity = async (key, groupId, codes) => {
      const role = await data(await api.post('/api/rbac/roles', { headers: admin.headers, data: {
        name: `${eventRunId} ${key}`, code: `rem_p1_050_${key}_${suffix}`.toLowerCase(), description: eventRunId,
        permissionIds: codes.map(code => permissions.find(permission => permission.code === code).id),
      } }))
      roles.push(role.id); objects.push({ type: 'role', id: role.id, runId: eventRunId }); updateManifest(objects)
      const username = `rem_p1_050_${key}_${suffix}`.toLowerCase()
      const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
      const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
      const realName = `${eventRunId}_${key}`
      const user = await data(await api.post('/api/users', { headers: admin.headers, data: {
        username, password: initialPassword, realName, email: `${username}@example.test`, phone: '13800138000', groupId,
      } }))
      users.push(user.id); objects.push({ type: 'user', id: user.id, runId: eventRunId }); updateManifest(objects)
      expect((await api.post(`/api/users/${user.id}/role-assignments`, { headers: admin.headers, data: {
        roleId: role.id, scopeType: 'group', scopeId: groupId,
      } })).status()).toBe(200)
      const assignment = (await data(await api.get(`/api/users/${user.id}/role-assignments`, { headers: admin.headers })))
        .find(candidate => candidate.roleId === role.id)
      assignments.push({ id: assignment.id, userId: user.id })
      objects.push({ type: 'role-assignment', id: assignment.id, userId: user.id, runId: eventRunId }); updateManifest(objects)
      const setup = await login(api, username, initialPassword)
      expect((await api.post('/api/account/setup', { headers: setup.headers, data: {
        currentPassword: initialPassword, newPassword: finalPassword, confirmPassword: finalPassword,
        email: `${username}@example.test`, phone: '13800138000',
      } })).status()).toBe(200)
      return { ...(await login(api, username, finalPassword)), id: user.id, realName }
    }

    const creator = await createIdentity('creator2', 2, ['ops_calendar:read', 'ops_calendar:create'])
    const crossGroup = await createIdentity('candidate3', 3, ['ops_calendar:read'])
    const reader = await createIdentity('reader2', 2, ['ops_calendar:read'])

    const candidates = await data(await api.get('/api/ops-calendar/tasks/assignee-candidates', { headers: creator.headers }))
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: creator.id, groupId: 2 }),
      expect.objectContaining({ id: crossGroup.id, groupId: 3, realName: crossGroup.realName }),
    ]))
    expect(Object.keys(candidates.find(candidate => candidate.id === crossGroup.id)).sort())
      .toEqual(['groupId', 'id', 'realName', 'username'])
    expect((await api.get('/api/ops-calendar/tasks/assignee-candidates', { headers: reader.headers })).status()).toBe(403)
    expect((await api.post('/api/ops-calendar/tasks', { headers: creator.headers, data: {
      title: `${eventRunId}_invalid`, taskType: 'inspection', visibility: 'private', assigneeId: 999999999,
    } })).status()).toBe(400)

    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    const failures = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`) })
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(creator.username)
    await page.locator('#password').fill(creator.password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/ops-calendar`)
    await page.getByRole('button', { name: '新建任务', exact: true }).click()
    await page.getByPlaceholder('如：节前数据库巡检').fill(`${eventRunId}_ui`)
    await page.getByText('负责人', { exact: true }).locator('..').getByRole('combobox').click()
    await page.getByText(crossGroup.realName, { exact: true }).click()
    const createResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST' && response.url().endsWith('/api/ops-calendar/tasks'))
    await page.getByRole('button', { name: '创建', exact: true }).click()
    const createdTaskId = await data(await createResponsePromise)
    tasks.push(createdTaskId)
    objects.push({ type: 'ops-task', id: createdTaskId, runId: eventRunId })
    updateManifest(objects)
    await expect(page.getByText('任务已创建')).toBeVisible()
    expect(errors).toEqual([])
    expect(failures).toEqual([])
    await context.close()

    const created = (await data(await api.get('/api/ops-calendar/tasks', { headers: creator.headers, params: {
      startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), scope: 'mine',
    } }))).find(task => task.title === `${eventRunId}_ui`)
    expect(created).toMatchObject({ id: createdTaskId, assigneeId: crossGroup.id })
  } finally {
    if (admin) {
      for (const taskId of [...tasks].reverse()) {
        expect((await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, { headers: admin.headers, params: { remediationRunId: eventRunId } })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'ops-task' && object.id === taskId), 1); updateManifest(objects)
      }
      for (const assignment of [...assignments].reverse()) {
        expect((await api.delete(`/api/users/${assignment.userId}/role-assignments/${assignment.id}`, { headers: admin.headers })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'role-assignment' && object.id === assignment.id), 1); updateManifest(objects)
      }
      for (const userId of [...users].reverse()) {
        expect((await api.delete(`/api/users/${userId}`, { headers: admin.headers })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'user' && object.id === userId), 1); updateManifest(objects)
      }
      for (const roleId of [...roles].reverse()) {
        expect((await api.delete(`/api/rbac/roles/${roleId}`, { headers: admin.headers })).status()).toBe(200)
        objects.splice(objects.findIndex(object => object.type === 'role' && object.id === roleId), 1); updateManifest(objects)
      }
    }
    updateManifest(objects)
    expect(objects).toEqual([])
    await api.dispose()
  }
})
