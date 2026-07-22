const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const eventRunId = process.env.FQA_EVENT_RUN_ID || `REM_P1_049_${Date.now()}`
const manifestRunId = process.env.FQA_TEST_MANIFEST_RUN_ID || 'REM_P1_049_20260719'
const suffix = Date.now()
const manifestPath = process.env.FQA_TEST_MANIFEST_PATH || path.join(
  __dirname, '..', 'docs', 'plan', 'full-platform-remediation', '06-ops-collaboration',
  'REM-P1-049-ops-task-detail-scope', 'test-data-manifest.json',
)
const range = { startDate: '2099-12-01', endDate: '2099-12-31' }

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

function writeManifest(objects) {
  const manifest = readManifest()
  expect(manifest.runId).toBe(manifestRunId)
  const temporaryPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ ...manifest, objects }, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(temporaryPath, manifestPath)
}

function register(objects, object) {
  objects.push(object)
  writeManifest(objects)
}

function unregister(objects, predicate) {
  const index = objects.findIndex(predicate)
  expect(index).toBeGreaterThanOrEqual(0)
  objects.splice(index, 1)
  writeManifest(objects)
}

async function responseData(response, status = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(status)
  return body.data
}

async function login(api, username, password) {
  const data = await responseData(await api.post('/api/auth/login', { data: { username, password } }))
  return { headers: { Authorization: `Bearer ${data.token}` }, userId: data.userId, username, password }
}

async function createIdentity(api, adminHeaders, permissions, objects, created, spec) {
  const permissionIds = spec.codes.map((code) => {
    const permission = permissions.find((candidate) => candidate.code === code)
    expect(permission, code).toBeTruthy()
    return permission.id
  })
  const role = await responseData(await api.post('/api/rbac/roles', {
    headers: adminHeaders,
    data: {
      name: `${eventRunId} ${spec.key}`,
      code: `rem_p1_049_${spec.key}_${suffix}`.toLowerCase(),
      description: eventRunId,
      permissionIds,
    },
  }))
  created.roles.push(role.id)
  register(objects, { type: 'role', id: role.id, runId: eventRunId })

  const username = `rem_p1_049_${spec.key}_${suffix}`.toLowerCase()
  const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
  const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
  const realName = `${eventRunId}_${spec.key}`
  const email = `${username}@example.test`
  const user = await responseData(await api.post('/api/users', {
    headers: adminHeaders,
    data: {
      username,
      password: initialPassword,
      realName,
      email,
      phone: '13800138000',
      groupId: spec.groupId,
    },
  }))
  created.users.push(user.id)
  register(objects, { type: 'user', id: user.id, runId: eventRunId })

  expect((await api.post(`/api/users/${user.id}/role-assignments`, {
    headers: adminHeaders,
    data: {
      roleId: role.id,
      scopeType: spec.scopeType,
      scopeId: spec.scopeType === 'group' ? spec.groupId : undefined,
    },
  })).status()).toBe(200)
  const assignments = await responseData(await api.get(`/api/users/${user.id}/role-assignments`, {
    headers: adminHeaders,
  }))
  const assignment = assignments.find((candidate) => candidate.roleId === role.id)
  expect(assignment).toBeTruthy()
  created.assignments.push({ id: assignment.id, userId: user.id })
  register(objects, { type: 'role-assignment', id: assignment.id, userId: user.id, runId: eventRunId })

  const setup = await login(api, username, initialPassword)
  expect((await api.post('/api/account/setup', {
    headers: setup.headers,
    data: {
      currentPassword: initialPassword,
      newPassword: finalPassword,
      confirmPassword: finalPassword,
      email,
      phone: '13800138000',
    },
  })).status()).toBe(200)
  return { ...(await login(api, username, finalPassword)), userId: user.id, realName }
}

async function createTask(api, creator, objects, created, name, overrides = {}) {
  const id = await responseData(await api.post('/api/ops-calendar/tasks', {
    headers: creator.headers,
    data: {
      title: `${eventRunId}_${name}`,
      content: `${eventRunId}_SECRET_${name}`,
      publicSummary: `${eventRunId}_PUBLIC_${name}`,
      taskType: 'inspection',
      plannedStartAt: '2099-12-15T09:00:00',
      dueAt: '2099-12-15T10:00:00',
      priority: 'normal',
      visibility: 'private',
      ...overrides,
    },
  }))
  created.tasks.push(id)
  register(objects, { type: 'ops-task', id, runId: eventRunId })
  return id
}

async function listIds(api, identity, scope) {
  const tasks = await responseData(await api.get('/api/ops-calendar/tasks', {
    headers: identity.headers,
    params: { ...range, scope },
  }))
  return tasks.map((task) => task.id)
}

async function detail(api, identity, taskId) {
  return responseData(await api.get(`/api/ops-calendar/tasks/${taskId}`, { headers: identity.headers }))
}

async function browserSession(browser, identity) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors = []
  const failedResponses = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(`${baseURL}/login`)
  await page.locator('#username').fill(identity.username)
  await page.locator('#password').fill(identity.password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(`${baseURL}/`)
  return { context, page, pageErrors, failedResponses }
}

test.describe.serial('REM-P1-049 ops task detail scope', () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  test('role matrix, masked public detail, direct-id UI, and cleanup', async ({ browser }) => {
    const api = await request.newContext({ baseURL })
    const objects = []
    const created = { roles: [], users: [], assignments: [], tasks: [] }
    let admin
    try {
      expect(readManifest()).toMatchObject({ runId: manifestRunId, objects: [], cleanupFailures: 0 })
      admin = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)
      const permissions = await responseData(await api.get('/api/rbac/permissions', { headers: admin.headers }))
      const identities = {}
      for (const spec of [
        { key: 'creator2', groupId: 2, scopeType: 'group', codes: ['ops_calendar:read', 'ops_calendar:create'] },
        { key: 'reader3', groupId: 3, scopeType: 'group', codes: ['ops_calendar:read'] },
        { key: 'participant3', groupId: 3, scopeType: 'group', codes: ['ops_calendar:read'] },
        { key: 'leader2', groupId: 2, scopeType: 'group', codes: ['ops_calendar:read', 'ops_calendar:read_group'] },
        { key: 'tenantReader', groupId: 3, scopeType: 'tenant', codes: ['ops_calendar:read', 'ops_calendar:read_all'] },
      ]) identities[spec.key] = await createIdentity(api, admin.headers, permissions, objects, created, spec)

      const privateId = await createTask(api, identities.creator2, objects, created, 'private')
      const groupId = await createTask(api, identities.creator2, objects, created, 'group_sensitive', {
        visibility: 'group',
        sensitive: true,
      })
      const publicId = await createTask(api, identities.creator2, objects, created, 'public', {
        visibility: 'public',
        sensitive: false,
      })
      const participantId = await createTask(api, identities.creator2, objects, created, 'participant', {
        participantIds: [identities.participant3.userId],
      })

      const readerMine = await listIds(api, identities.reader3, 'mine')
      expect(readerMine).toContain(publicId)
      expect(readerMine).not.toContain(privateId)
      expect(readerMine).not.toContain(groupId)
      expect((await api.get(`/api/ops-calendar/tasks/${privateId}`, { headers: identities.reader3.headers })).status()).toBe(400)
      expect((await api.get(`/api/ops-calendar/tasks/${groupId}`, { headers: identities.reader3.headers })).status()).toBe(400)

      const publicDetail = await detail(api, identities.reader3, publicId)
      expect(publicDetail.task.title).toBe(`${eventRunId}_public`)
      expect(publicDetail.content).toBeUndefined()
      expect(publicDetail.resultSummary).toBeUndefined()
      expect(publicDetail.participants).toEqual([])
      expect(publicDetail.checklist).toEqual([])
      expect(publicDetail.links).toEqual([])
      expect(publicDetail.logs).toEqual([])

      expect((await detail(api, identities.creator2, privateId)).content).toContain(`${eventRunId}_SECRET_private`)
      expect((await detail(api, identities.participant3, participantId)).content).toContain(`${eventRunId}_SECRET_participant`)
      expect((await detail(api, identities.leader2, groupId)).content).toContain(`${eventRunId}_SECRET_group_sensitive`)
      expect((await detail(api, identities.tenantReader, privateId)).content).toContain(`${eventRunId}_SECRET_private`)

      const denied = await browserSession(browser, identities.reader3)
      await denied.page.goto(`${baseURL}/ops-calendar?taskId=${privateId}`)
      await denied.page.waitForLoadState('networkidle')
      await expect(denied.page.getByText(`${eventRunId}_private`, { exact: true })).toHaveCount(0)
      await expect(denied.page.getByText(`${eventRunId}_SECRET_private`, { exact: false })).toHaveCount(0)
      expect(denied.pageErrors).toEqual([])
      expect(denied.failedResponses).toEqual([])
      await denied.context.close()

      const publicSession = await browserSession(browser, identities.reader3)
      await publicSession.page.goto(`${baseURL}/ops-calendar?taskId=${publicId}`)
      await expect(publicSession.page.getByRole('heading', { name: `${eventRunId}_public`, exact: true })).toBeVisible()
      await expect(publicSession.page.getByText(`${eventRunId}_SECRET_public`, { exact: false })).toHaveCount(0)
      expect(publicSession.pageErrors).toEqual([])
      expect(publicSession.failedResponses).toEqual([])
      await publicSession.context.close()
    } finally {
      if (admin) {
        for (const taskId of [...created.tasks].reverse()) {
          const cleanup = await api.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
            headers: admin.headers,
            params: { remediationRunId: eventRunId },
          })
          expect(cleanup.status(), `cleanup task ${taskId}`).toBe(200)
          unregister(objects, (object) => object.type === 'ops-task' && object.id === taskId)
        }
        for (const assignment of [...created.assignments].reverse()) {
          expect((await api.delete(`/api/users/${assignment.userId}/role-assignments/${assignment.id}`, {
            headers: admin.headers,
          })).status()).toBe(200)
          unregister(objects, (object) => object.type === 'role-assignment' && object.id === assignment.id)
        }
        for (const userId of [...created.users].reverse()) {
          expect((await api.delete(`/api/users/${userId}`, { headers: admin.headers })).status()).toBe(200)
          unregister(objects, (object) => object.type === 'user' && object.id === userId)
        }
        for (const roleId of [...created.roles].reverse()) {
          expect((await api.delete(`/api/rbac/roles/${roleId}`, { headers: admin.headers })).status()).toBe(200)
          unregister(objects, (object) => object.type === 'role' && object.id === roleId)
        }
      }
      writeManifest(objects)
      expect(objects).toEqual([])
      expect(readManifest()).toMatchObject({ runId: manifestRunId, objects: [], cleanupFailures: 0 })
      await api.dispose()
    }
  })
})
