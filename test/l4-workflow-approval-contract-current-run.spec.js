const { test, expect, request } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const baseURL = process.env.FQA_BASE_URL || 'http://127.0.0.1'
const l4RunId = process.env.FQA_L4_RUN_ID
const suffix = Date.now()
const runId = `${l4RunId}_flow002_${suffix}`
const manifestPath = process.env.FQA_MANIFEST_PATH || path.join(__dirname, '..', 'docs', 'acceptance', 'full-platform-exhaustive-functional-test-v1.0', 'runs', l4RunId || '', 'test-data-manifest.json')

function updateManifest(objects, cleanupFailures = 0) {
  const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  expect(current.runId).toBe(l4RunId)
  const temporaryPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ ...current, objects, cleanupFailures }, null, 2)}\n`, { flag: 'wx' })
  fs.renameSync(temporaryPath, manifestPath)
}

async function responseData(response, expectedStatus = 200) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body.data
}

async function login(api, username, password) {
  const data = await responseData(await api.post('/api/auth/login', { data: { username, password } }))
  return { username, password, headers: { Authorization: `Bearer ${data.token}` } }
}

function historicalDate(offset) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() - 700 - offset)
  return value.toISOString().slice(0, 10)
}

test('flow002ApprovalAllowDenyCommentBoundariesAndBusinessCallbacks', async ({ page }) => {
  test.skip(!l4RunId, 'FQA_L4_RUN_ID is required')
  test.skip(!process.env.FQA_SUPERADMIN_PASSWORD, 'FQA_SUPERADMIN_PASSWORD is required')

  const api = await request.newContext({ baseURL })
  const objects = []
  const reportIds = []
  let admin
  let roleId
  let userId
  let assignmentId
  let deniedIdentity
  let cleanupFailures = 0

  try {
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).objects).toEqual([])
    admin = await login(api, 'superadmin', process.env.FQA_SUPERADMIN_PASSWORD)
    const permissions = await responseData(await api.get('/api/rbac/permissions', { headers: admin.headers }))
    const readPermission = permissions.find((permission) => permission.code === 'workflow:read')
    expect(readPermission).toBeTruthy()

    roleId = (await responseData(await api.post('/api/rbac/roles', {
      headers: admin.headers,
      data: {
        name: `${runId} no approve`,
        code: `fqa_flow002_noapprove_${suffix}`,
        description: runId,
        permissionIds: [readPermission.id],
      },
    }))).id
    objects.push({ caseId: 'FLOW-002', type: 'role', id: roleId, runId }); updateManifest(objects)

    const username = `fqa_flow002_noapprove_${suffix}`
    const initialPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}A9`
    const finalPassword = `Fqa!${Math.random().toString(36).slice(2, 10)}B8`
    userId = (await responseData(await api.post('/api/users', {
      headers: admin.headers,
      data: {
        username,
        password: initialPassword,
        realName: `${runId} no approve`,
        email: `${username}@example.test`,
        phone: '13800138000',
        groupId: 1,
      },
    }))).id
    objects.push({ caseId: 'FLOW-002', type: 'user', id: userId, runId }); updateManifest(objects)

    expect((await api.post(`/api/users/${userId}/role-assignments`, {
      headers: admin.headers,
      data: { roleId, scopeType: 'tenant' },
    })).status()).toBe(200)
    assignmentId = (await responseData(await api.get(`/api/users/${userId}/role-assignments`, { headers: admin.headers })))
      .find((assignment) => assignment.roleId === roleId).id
    objects.push({ caseId: 'FLOW-002', type: 'role-assignment', id: assignmentId, userId, runId }); updateManifest(objects)

    const setupIdentity = await login(api, username, initialPassword)
    expect((await api.post('/api/account/setup', {
      headers: setupIdentity.headers,
      data: {
        currentPassword: initialPassword,
        newPassword: finalPassword,
        confirmPassword: finalPassword,
        email: `${username}@example.test`,
        phone: '13800138000',
      },
    })).status()).toBe(200)
    deniedIdentity = await login(api, username, finalPassword)

    async function createSubmittedReport(label, offset) {
      const created = await api.post('/api/daily-reports', {
        headers: admin.headers,
        data: {
          reportDate: historicalDate(offset),
          groupId: 1,
          completedItems: `${runId} ${label}`,
          issues: `${runId} issues`,
          tomorrowPlan: `${runId} plan`,
          workHours: 1,
        },
      })
      const report = await responseData(created)
      reportIds.push(report.id)
      objects.push({ caseId: 'FLOW-002', type: 'daily-report', id: report.id, runId }); updateManifest(objects)
      expect((await api.post(`/api/daily-reports/${report.id}/submit`, { headers: admin.headers })).status()).toBe(200)
      const tasks = await responseData(await api.get('/api/workflow/center/tasks/group', { headers: admin.headers }))
      const task = tasks.find((candidate) => candidate.businessType === 'daily_report' && String(candidate.businessId) === String(report.id))
      expect(task).toBeTruthy()
      return { reportId: report.id, taskId: task.taskId }
    }

    const approved = await createSubmittedReport('empty comment approval', 0)
    const deniedStatusBefore = (await responseData(await api.get(`/api/daily-reports/${approved.reportId}`, { headers: admin.headers }))).status
    expect(deniedStatusBefore).toBe('SUBMITTED')
    expect((await api.post('/api/workflow/center/tasks/complete', {
      headers: deniedIdentity.headers,
      data: { taskId: approved.taskId, approved: true, comment: '' },
    })).status()).toBe(403)
    expect((await responseData(await api.get(`/api/daily-reports/${approved.reportId}`, { headers: admin.headers }))).status).toBe('SUBMITTED')
    expect((await api.post('/api/workflow/center/tasks/complete', {
      headers: admin.headers,
      data: { taskId: approved.taskId, approved: true, comment: '' },
    })).status()).toBe(200)
    expect((await responseData(await api.get(`/api/daily-reports/${approved.reportId}`, { headers: admin.headers }))).status).toBe('APPROVED')

    const rejected = await createSubmittedReport('long unicode rejection', 1)
    const longComment = `${runId}驳回意见`.padEnd(4096, '界')
    expect((await api.post('/api/workflow/center/tasks/complete', {
      headers: admin.headers,
      data: { taskId: rejected.taskId, approved: false, comment: longComment },
    })).status()).toBe(200)
    expect((await responseData(await api.get(`/api/daily-reports/${rejected.reportId}`, { headers: admin.headers }))).status).toBe('REJECTED')
    const auditPage = await responseData(await api.get('/api/audit-logs', {
      headers: admin.headers,
      params: { module: 'daily_report', action: 'reject', keyword: runId, page: 1, size: 20 },
    }))
    const rejectionAudit = auditPage.records.find((record) => record.targetId === rejected.reportId)
    expect(rejectionAudit).toBeTruthy()
    expect([...rejectionAudit.remark]).toHaveLength(512)
    expect(rejectionAudit.remark).toMatch(/^流程结束回写: SUBMITTED -> REJECTED \(/)
    expect(rejectionAudit.remark).toMatch(/\.\.\.$/)

    const pageErrors = []
    const serverFailures = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => { if (response.status() >= 500) serverFailures.push(`${response.status()} ${response.url()}`) })
    await page.goto(`${baseURL}/login`)
    await page.locator('#username').fill(deniedIdentity.username)
    await page.locator('#password').fill(deniedIdentity.password)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(`${baseURL}/`)
    await page.goto(`${baseURL}/workflow/todo`)
    await expect(page.getByText(`${runId} empty comment approval`, { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /通过|驳回/ })).toHaveCount(0)
    expect(pageErrors).toEqual([])
    expect(serverFailures).toEqual([])
  } finally {
    if (admin) {
      for (const reportId of [...reportIds].reverse()) {
        const response = await api.delete(`/api/daily-reports/${reportId}/remediation-test`, {
          headers: admin.headers,
          params: { remediationRunId: runId },
        })
        if (response.status() === 200) objects.splice(objects.findIndex((object) => object.type === 'daily-report' && object.id === reportId), 1)
        else cleanupFailures += 1
        updateManifest(objects, cleanupFailures)
      }
      if (assignmentId) {
        const response = await api.delete(`/api/users/${userId}/role-assignments/${assignmentId}`, { headers: admin.headers })
        if (response.status() === 200) objects.splice(objects.findIndex((object) => object.type === 'role-assignment' && object.id === assignmentId), 1)
        else cleanupFailures += 1
        updateManifest(objects, cleanupFailures)
      }
      if (userId) {
        const response = await api.delete(`/api/users/${userId}`, { headers: admin.headers })
        if (response.status() === 200) objects.splice(objects.findIndex((object) => object.type === 'user' && object.id === userId), 1)
        else cleanupFailures += 1
        updateManifest(objects, cleanupFailures)
      }
      if (roleId) {
        const response = await api.delete(`/api/rbac/roles/${roleId}`, { headers: admin.headers })
        if (response.status() === 200) objects.splice(objects.findIndex((object) => object.type === 'role' && object.id === roleId), 1)
        else cleanupFailures += 1
      }
    }
    updateManifest(objects, cleanupFailures)
    await api.dispose()
    expect(objects).toEqual([])
    expect(cleanupFailures).toBe(0)
  }
})
