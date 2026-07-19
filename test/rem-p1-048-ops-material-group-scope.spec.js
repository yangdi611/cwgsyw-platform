const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const XLSX = require('../frontend/node_modules/xlsx')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID || 'FQA_20260718_2050_remp1038'
const suffix = Date.now()
const runId = `REM_P1_048_${suffix}`
const range = { startDate: '2099-11-01', endDate: '2099-11-30' }
const manifestPath = path.join(
  __dirname,
  '..',
  'docs',
  'plan',
  'full-platform-remediation',
  '06-ops-collaboration',
  'REM-P1-048-ops-material-group-scope',
  'test-data-manifest.json',
)

function updateManifest(ownedObjects) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const objects = manifest.objects.filter((object) => object.runId !== runId)
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    ...manifest,
    objects: [...objects, ...ownedObjects],
  }, null, 2)}\n`, { mode: 0o600 })
}

async function responseData(response, expectedStatus = 200) {
  expect(response.status()).toBe(expectedStatus)
  return (await response.json()).data
}

function aggregate(tasks) {
  const statusBreakdown = {}
  const typeBreakdown = {}
  let completed = 0
  let overdue = 0
  let exceptionClosed = 0
  let cancelled = 0

  for (const task of tasks) {
    statusBreakdown[task.status] = (statusBreakdown[task.status] || 0) + 1
    typeBreakdown[task.taskType || 'other'] = (typeBreakdown[task.taskType || 'other'] || 0) + 1
    if (task.status === 'completed') completed += 1
    if (task.status === 'overdue') overdue += 1
    if (task.status === 'exception_closed') exceptionClosed += 1
    if (task.status === 'cancelled') cancelled += 1
  }

  const expected = Math.max(0, tasks.length - cancelled)
  return {
    total: tasks.length,
    completed,
    overdue,
    exceptionClosed,
    cancelled,
    completionRate: expected === 0 ? 0 : Math.round((completed * 1000) / expected) / 10,
    overdueRate: expected === 0 ? 0 : Math.round((overdue * 1000) / expected) / 10,
    statusBreakdown,
    typeBreakdown,
  }
}

function expectStats(stats, tasks) {
  expect(stats).toMatchObject(aggregate(tasks))
  expect(stats.dailyTrend.reduce((sum, item) => sum + item.created, 0)).toBe(tasks.length)
}

function exportedTaskTitles(bytes) {
  const workbook = XLSX.read(bytes, { type: 'buffer' })
  const detail = workbook.Sheets['任务明细']
  expect(detail).toBeTruthy()
  return XLSX.utils.sheet_to_json(detail, { header: 1 })
    .slice(2)
    .map((row) => row[1])
    .filter((title) => typeof title === 'string')
}

async function exportTitles(apiContext, headers, groupId) {
  const exported = await apiContext.get('/api/ops-calendar/report-materials/export', {
    headers,
    params: { periodType: 'quarter', ...range, groupId },
  })
  expect(exported.status()).toBe(200)
  expect(exported.headers()['content-disposition']).toContain('attachment')
  expect(exported.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const bytes = await exported.body()
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  return exportedTaskTitles(bytes)
}

test.describe.serial('REM-P1-048 OPS material group scope', () => {
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  const api = request.newContext({ baseURL })
  const objects = []
  const roles = []
  const users = []
  const assignments = []
  const tasks = []
  const identities = {}
  let adminHeaders
  let groupA
  let groupB

  test.beforeAll(async () => {
    const apiContext = await api
    const login = await apiContext.post('/api/auth/login', {
      data: { username: 'superadmin', password: process.env.FQA_SUPERADMIN_PASSWORD },
    })
    adminHeaders = { Authorization: `Bearer ${(await responseData(login)).token}` }

    const groupsBody = await responseData(await apiContext.get('/api/groups?page=1&size=100', { headers: adminHeaders }))
    const groups = (groupsBody.records ?? groupsBody)
      .filter((group) => group.groupType === 'business' || group.group_type === 'business')
    expect(groups.length).toBeGreaterThanOrEqual(2)
    ;[groupA, groupB] = groups

    const permissions = await responseData(await apiContext.get('/api/rbac/permissions', { headers: adminHeaders }))
    const permissionId = (code) => {
      const permission = permissions.find((candidate) => candidate.code === code)
      expect(permission, code).toBeTruthy()
      return permission.id
    }
    const roleSpecs = [
      { key: 'leader', scopeType: 'group', scopeId: groupA.id, codes: ['ops_calendar:read', 'ops_calendar:read_group', 'ops_calendar:export'] },
      { key: 'tenant', scopeType: 'tenant', codes: ['ops_calendar:read', 'ops_calendar:read_all', 'ops_calendar:export'] },
      { key: 'reader', scopeType: 'group', scopeId: groupA.id, codes: ['ops_calendar:read'] },
    ]

    for (const spec of roleSpecs) {
      const role = await responseData(await apiContext.post('/api/rbac/roles', {
        headers: adminHeaders,
        data: {
          name: `REM P1 048 ${spec.key} ${suffix}`,
          code: `fqa_ops_scope_${spec.key}_${suffix}`,
          description: runId,
          permissionIds: spec.codes.map(permissionId),
        },
      }))
      roles.push(role.id)
      objects.push({ caseIds: ['OPS-017', 'OPS-018', 'OPS-019'], type: 'role', id: role.id, runId })
      updateManifest(objects)

      const username = `fqa_ops_scope_${spec.key}_${suffix}`
      const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
      const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
      const user = await responseData(await apiContext.post('/api/users', {
        headers: adminHeaders,
        data: {
          username,
          password: initialPassword,
          realName: `${runId}_${spec.key}`,
          email: `${username}@example.test`,
          phone: '13800138000',
          groupId: groupA.id,
        },
      }))
      users.push(user.id)
      objects.push({ caseIds: ['OPS-017', 'OPS-018', 'OPS-019'], type: 'user', id: user.id, runId })
      updateManifest(objects)

      await responseData(await apiContext.post(`/api/users/${user.id}/role-assignments`, {
        headers: adminHeaders,
        data: { roleId: role.id, scopeType: spec.scopeType, scopeId: spec.scopeId },
      }))
      const assignment = (await responseData(await apiContext.get(`/api/users/${user.id}/role-assignments`, {
        headers: adminHeaders,
      }))).find((candidate) => candidate.roleId === role.id)
      assignments.push({ id: assignment.id, userId: user.id })
      objects.push({ caseIds: ['OPS-017', 'OPS-018', 'OPS-019'], type: 'role-assignment', id: assignment.id, userId: user.id, runId })
      updateManifest(objects)

      const setupLogin = await responseData(await apiContext.post('/api/auth/login', {
        data: { username, password: initialPassword },
      }))
      await responseData(await apiContext.post('/api/account/setup', {
        headers: { Authorization: `Bearer ${setupLogin.token}` },
        data: {
          currentPassword: initialPassword,
          newPassword: finalPassword,
          confirmPassword: finalPassword,
          email: `${username}@example.test`,
          phone: '13800138000',
        },
      }))
      const identityLogin = await responseData(await apiContext.post('/api/auth/login', {
        data: { username, password: finalPassword },
      }))
      identities[spec.key] = {
        username,
        password: finalPassword,
        headers: { Authorization: `Bearer ${identityLogin.token}` },
      }
    }

    for (const [key, groupId] of [['group_a', groupA.id], ['group_b', groupB.id]]) {
      const taskId = await responseData(await apiContext.post('/api/ops-calendar/tasks', {
        headers: adminHeaders,
        data: {
          title: `${runId}_${key}`,
          content: `${runId} ${key}`,
          taskType: 'inspection',
          plannedStartAt: '2099-11-15T09:00:00',
          dueAt: '2099-11-15T10:00:00',
          priority: 'normal',
          visibility: 'private',
          groupId,
        },
      }))
      tasks.push(taskId)
      objects.push({ caseIds: ['OPS-017', 'OPS-018'], type: 'ops-task', id: taskId, runId })
      updateManifest(objects)
    }
  })

  test.afterAll(async () => {
    const apiContext = await api
    const failures = []
    const clean = async (label, action) => {
      try {
        const response = await action()
        expect(response.status(), label).toBe(200)
      } catch (error) {
        failures.push(new Error(`${label}: ${error.message}`, { cause: error }))
      }
    }

    for (const taskId of [...tasks].reverse()) {
      await clean(`task ${taskId}`, () => apiContext.delete(`/api/ops-calendar/tasks/${taskId}/remediation-test`, {
        headers: adminHeaders,
        params: { remediationRunId: runId },
      }))
    }
    for (const assignment of [...assignments].reverse()) {
      await clean(`assignment ${assignment.id}`, () => apiContext.delete(
        `/api/users/${assignment.userId}/role-assignments/${assignment.id}`,
        { headers: adminHeaders },
      ))
    }
    for (const userId of [...users].reverse()) {
      await clean(`user ${userId}`, () => apiContext.delete(`/api/users/${userId}`, { headers: adminHeaders }))
    }
    for (const roleId of [...roles].reverse()) {
      await clean(`role ${roleId}`, () => apiContext.delete(`/api/rbac/roles/${roleId}`, { headers: adminHeaders }))
    }
    if (failures.length === 0) updateManifest([])
    await apiContext.dispose()
    if (failures.length) throw new AggregateError(failures, `Cleanup failed for ${failures.length} OPS fixture(s)`)
  })

  test('ops019AuthenticatedNoExportIdentityHasNoApiOrUiEntry', async ({ browser }) => {
    const apiContext = await api
    for (const endpoint of ['/api/ops-calendar/report-materials', '/api/ops-calendar/report-materials/export']) {
      expect((await apiContext.get(endpoint, {
        headers: identities.reader.headers,
        params: { periodType: 'quarter', ...range },
      })).status(), endpoint).toBe(403)
    }
    expect((await apiContext.get('/api/ops-calendar/stats', {
      headers: identities.reader.headers,
      params: range,
    })).status()).toBe(403)

    const context = await browser.newContext()
    const page = await context.newPage()
    const pageErrors = []
    const consoleErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(identities.reader.username)
    await page.locator('#password').fill(identities.reader.password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/ops-calendar`)
    await expect(page.getByRole('heading', { name: '运维日历', exact: true })).toBeVisible()
    await expect(page.getByText('统计复盘', { exact: true })).toHaveCount(0)
    await expect(page.getByText('素材归集', { exact: true })).toHaveCount(0)
    await page.goto(`${baseURL}/ops-calendar/materials`)
    await page.waitForURL(`${baseURL}/ops-calendar`)
    const statsResponses = []
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/api/ops-calendar/stats') statsResponses.push(response.status())
    })
    await page.goto(`${baseURL}/ops-calendar/stats`)
    await expect(page.getByRole('heading', { name: '统计与复盘', exact: true })).toBeVisible()
    await expect(page.getByText('统计加载失败，请检查日期范围后重试。', { exact: true })).toBeVisible()
    expect(statsResponses).toContain(403)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toHaveLength(1)
    expect(consoleErrors[0]).toContain('403')
    await context.close()
  })

  test('ops018TenantStatisticsMatchAllAndPerGroupTaskAggregates', async () => {
    const apiContext = await api
    const allTasks = await responseData(await apiContext.get('/api/ops-calendar/tasks', {
      headers: identities.tenant.headers,
      params: { ...range, scope: 'all' },
    }))
    const allStats = await responseData(await apiContext.get('/api/ops-calendar/stats', {
      headers: identities.tenant.headers,
      params: range,
    }))
    expectStats(allStats, allTasks)
    expect(allTasks.map((task) => task.id)).toEqual(expect.arrayContaining(tasks))

    for (const group of [groupA, groupB]) {
      const groupTasks = await responseData(await apiContext.get('/api/ops-calendar/tasks', {
        headers: identities.tenant.headers,
        params: { ...range, scope: 'group', groupId: group.id },
      }))
      const groupStats = await responseData(await apiContext.get('/api/ops-calendar/stats', {
        headers: identities.tenant.headers,
        params: { ...range, groupId: group.id },
      }))
      expect(groupTasks.every((task) => task.groupId === group.id)).toBe(true)
      expectStats(groupStats, groupTasks)
    }

    const emptyRange = { startDate: '1900-01-01', endDate: '1900-01-02' }
    const emptyStats = await responseData(await apiContext.get('/api/ops-calendar/stats', {
      headers: identities.tenant.headers,
      params: emptyRange,
    }))
    expectStats(emptyStats, [])
  })

  test('ops017GroupLeaderTasksStatsAndMaterialsRemainInOwnGroup', async ({ browser }) => {
    const apiContext = await api
    const ownTasks = await responseData(await apiContext.get('/api/ops-calendar/tasks', {
      headers: identities.leader.headers,
      params: { ...range, scope: 'group' },
    }))
    const forgedTasks = await responseData(await apiContext.get('/api/ops-calendar/tasks', {
      headers: identities.leader.headers,
      params: { ...range, scope: 'group', groupId: groupB.id },
    }))
    expect(ownTasks.every((task) => task.groupId === groupA.id)).toBe(true)
    expect(forgedTasks.map((task) => task.id)).toEqual(ownTasks.map((task) => task.id))

    const ownStats = await responseData(await apiContext.get('/api/ops-calendar/stats', {
      headers: identities.leader.headers,
      params: range,
    }))
    const forgedStats = await responseData(await apiContext.get('/api/ops-calendar/stats', {
      headers: identities.leader.headers,
      params: { ...range, groupId: groupB.id },
    }))
    expectStats(ownStats, ownTasks)
    expect(forgedStats).toEqual(ownStats)

    const ownMaterials = await responseData(await apiContext.get('/api/ops-calendar/report-materials', {
      headers: identities.leader.headers,
      params: { periodType: 'quarter', ...range },
    }))
    const forgedMaterials = await responseData(await apiContext.get('/api/ops-calendar/report-materials', {
      headers: identities.leader.headers,
      params: { periodType: 'quarter', ...range, groupId: groupB.id },
    }))
    expect(ownMaterials.items.every((item) => ownTasks.some((task) => task.id === item.taskId))).toBe(true)
    expect(forgedMaterials.items.map((item) => item.taskId).sort((a, b) => a - b))
      .toEqual(ownMaterials.items.map((item) => item.taskId).sort((a, b) => a - b))

    const ownTitle = `${runId}_group_a`
    const otherTitle = `${runId}_group_b`
    for (const groupId of [undefined, groupB.id]) {
      const titles = await exportTitles(apiContext, identities.leader.headers, groupId)
      expect(titles).toContain(ownTitle)
      expect(titles).not.toContain(otherTitle)
    }
    const tenantTitles = await exportTitles(apiContext, identities.tenant.headers)
    expect(tenantTitles).toEqual(expect.arrayContaining([ownTitle, otherTitle]))
    const tenantGroupBTitles = await exportTitles(apiContext, identities.tenant.headers, groupB.id)
    expect(tenantGroupBTitles).toContain(otherTitle)
    expect(tenantGroupBTitles).not.toContain(ownTitle)

    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    const failedApi = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(identities.leader.username)
    await page.locator('#password').fill(identities.leader.password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/ops-calendar/materials`)
    page.on('requestfailed', (request) => failedApi.push(`${request.method()} ${request.url()}`))
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) {
        failedApi.push(`${response.request().method()} ${response.url()} ${response.status()}`)
      }
    })
    await page.locator('input[type="date"]').nth(0).fill(range.startDate)
    await page.locator('input[type="date"]').nth(1).fill(range.endDate)
    await page.getByRole('button', { name: '归集', exact: true }).click()
    await expect(page.getByText(`${runId}_group_a`, { exact: true })).toBeVisible()
    await expect(page.getByText(`${runId}_group_b`, { exact: true })).toHaveCount(0)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 Excel', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(`运维素材_${range.startDate}_${range.endDate}.xlsx`)
    const downloadPath = await download.path()
    const downloadedTitles = exportedTaskTitles(fs.readFileSync(downloadPath))
    expect(downloadedTitles).toContain(ownTitle)
    expect(downloadedTitles).not.toContain(otherTitle)
    expect(errors).toEqual([])
    expect(failedApi).toEqual([])
    await context.close()
  })
})
